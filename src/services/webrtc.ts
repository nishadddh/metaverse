import { ref, push, onValue, remove } from 'firebase/database';
import { realtimeDb } from './firebase';

export interface WebRTCPeerStream {
  userId: string;
  stream: MediaStream;
}

type StreamCallback = (streams: Map<string, MediaStream>) => void;

class WebRTCManager {
  public officeId: string = '';
  public roomId: string = '';
  public userId: string = '';
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private callbacks: Set<StreamCallback> = new Set();
  private signalingUnsub: (() => void) | null = null;

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  public async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;

    // Update all active peer connections with new tracks
    for (const [peerUserId, pc] of this.peerConnections.entries()) {
      if (pc.signalingState === 'closed') continue;

      const senders = pc.getSenders();
      let needsOffer = false;

      if (stream) {
        const newTracks = stream.getTracks();
        for (const track of newTracks) {
          const existingSender = senders.find(s => s.track?.kind === track.kind);
          if (existingSender) {
            await existingSender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
            needsOffer = true;
          }
        }
        // Remove senders for tracks no longer in stream
        for (const sender of senders) {
          if (sender.track && !newTracks.some(t => t.kind === sender.track?.kind)) {
            pc.removeTrack(sender);
            needsOffer = true;
          }
        }
      } else {
        // Remove all senders if local stream is null
        for (const sender of senders) {
          pc.removeTrack(sender);
          needsOffer = true;
        }
      }

      // If tracks were added or removed, send a new WebRTC offer to peer
      if (needsOffer && pc.signalingState === 'stable') {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          this.sendSignal(peerUserId, {
            type: 'offer',
            sdp: pc.localDescription
          });
        } catch (err) {
          console.warn(`Renegotiation failed for ${peerUserId}:`, err);
        }
      }
    }
  }

  public joinRoomSession(officeId: string, roomId: string, userId: string, localStream?: MediaStream | null) {
    this.officeId = officeId;
    this.roomId = roomId || 'open_area';
    this.userId = userId;
    if (localStream !== undefined) this.localStream = localStream;

    this.listenSignaling();
  }

  public leaveRoomSession() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.pendingCandidates.clear();
    if (this.signalingUnsub) {
      this.signalingUnsub();
      this.signalingUnsub = null;
    }
    this.notifySubscribers();
  }

  public connectToPeer(remoteUserId: string) {
    if (this.peerConnections.has(remoteUserId) || remoteUserId === this.userId) return;

    const pc = this.createPeerConnection(remoteUserId);
    this.peerConnections.set(remoteUserId, pc);

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        this.sendSignal(remoteUserId, {
          type: 'offer',
          sdp: pc.localDescription
        });
      })
      .catch(err => console.warn('WebRTC Offer Error:', err));
  }

  public subscribeRemoteStreams(cb: StreamCallback) {
    this.callbacks.add(cb);
    cb(new Map(this.remoteStreams));
    return () => { this.callbacks.delete(cb); };
  }

  private createPeerConnection(remoteUserId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(this.iceServers);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
    }

    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(remoteUserId);
      if (!stream) {
        stream = new MediaStream();
        this.remoteStreams.set(remoteUserId, stream);
      }

      if (event.track) {
        const existing = stream.getTracks().filter(t => t.kind === event.track.kind);
        existing.forEach(t => stream!.removeTrack(t));
        stream.addTrack(event.track);
      } else if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(t => {
          const existing = stream!.getTracks().filter(ex => ex.kind === t.kind);
          existing.forEach(ex => stream!.removeTrack(ex));
          stream!.addTrack(t);
        });
      }

      this.notifySubscribers();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(remoteUserId, {
          type: 'candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.remoteStreams.delete(remoteUserId);
        this.notifySubscribers();
      }
    };

    return pc;
  }

  private sendSignal(targetUserId: string, signal: any) {
    if (!this.officeId || !this.userId || !targetUserId) return;
    const path = `offices/${this.officeId}/signaling/${targetUserId}/${this.userId}`;
    const listRef = ref(realtimeDb, path);
    push(listRef, {
      ...signal,
      senderId: this.userId,
      timestamp: Date.now()
    }).catch(err => console.warn('WebRTC Signal Send Error:', err));
  }

  private listenSignaling() {
    if (!this.officeId || !this.userId) return;
    const path = `offices/${this.officeId}/signaling/${this.userId}`;
    const signalingRef = ref(realtimeDb, path);

    if (this.signalingUnsub) this.signalingUnsub();

    this.signalingUnsub = onValue(signalingRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      Object.entries(data).forEach(([senderId, signalsObj]: [string, any]) => {
        if (!signalsObj) return;

        let pc = this.peerConnections.get(senderId);
        if (!pc || pc.signalingState === 'closed') {
          pc = this.createPeerConnection(senderId);
          this.peerConnections.set(senderId, pc);
        }

        const signalsList = typeof signalsObj === 'object' && !signalsObj.type
          ? Object.entries(signalsObj).map(([pushId, sig]: [string, any]) => ({ pushId, ...sig })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
          : [signalsObj];

        signalsList.forEach(async (signalData: any) => {
          if (!signalData || !signalData.type) return;

          try {
            if (signalData.type === 'offer' && signalData.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));

              const queued = this.pendingCandidates.get(senderId) || [];
              for (const cand of queued) {
                await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
              }
              this.pendingCandidates.delete(senderId);

              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              this.sendSignal(senderId, {
                type: 'answer',
                sdp: pc.localDescription
              });
            } else if (signalData.type === 'answer' && signalData.sdp) {
              if (pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));

                const queued = this.pendingCandidates.get(senderId) || [];
                for (const cand of queued) {
                  await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                }
                this.pendingCandidates.delete(senderId);
              }
            } else if (signalData.type === 'candidate' && signalData.candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)).catch(() => {});
              } else {
                const list = this.pendingCandidates.get(senderId) || [];
                list.push(signalData.candidate);
                this.pendingCandidates.set(senderId, list);
              }
            }
          } catch (e) {
            console.warn(`Signaling processing error from ${senderId}:`, e);
          }
        });

        const senderSignalRef = ref(realtimeDb, `offices/${this.officeId}/signaling/${this.userId}/${senderId}`);
        remove(senderSignalRef);
      });
    });
  }

  private notifySubscribers() {
    this.callbacks.forEach(cb => cb(new Map(this.remoteStreams)));
  }
}

export const webrtcService = new WebRTCManager();
