import { ref, set, onValue, remove } from 'firebase/database';
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
  private callbacks: Set<StreamCallback> = new Set();
  private signalingUnsub: (() => void) | null = null;

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    // Replace tracks on existing peer connections if active
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      if (stream) {
        stream.getTracks().forEach((track) => {
          const existingSender = senders.find(s => s.track?.kind === track.kind);
          if (existingSender) {
            existingSender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
          }
        });
      }
    });
  }

  public joinRoomSession(officeId: string, roomId: string, userId: string, localStream?: MediaStream | null) {
    this.officeId = officeId;
    this.roomId = roomId || 'open_area';
    this.userId = userId;
    if (localStream) this.localStream = localStream;

    this.listenSignaling();
  }

  public leaveRoomSession() {
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    if (this.signalingUnsub) {
      this.signalingUnsub();
      this.signalingUnsub = null;
    }
    this.notifySubscribers();
  }

  public connectToPeer(remoteUserId: string) {
    if (this.peerConnections.has(remoteUserId) || remoteUserId === this.userId) return;

    const pc = new RTCPeerConnection(this.iceServers);
    this.peerConnections.set(remoteUserId, pc);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream!));
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStreams.set(remoteUserId, event.streams[0]);
        this.notifySubscribers();
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(remoteUserId, {
          type: 'candidate',
          candidate: event.candidate.toJSON()
        });
      }
    };

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
    cb(this.remoteStreams);
    return () => { this.callbacks.delete(cb); };
  }

  private sendSignal(targetUserId: string, signal: any) {
    if (!this.officeId || !this.userId || !targetUserId) return;
    const path = `offices/${this.officeId}/signaling/${targetUserId}/${this.userId}`;
    const signalRef = ref(realtimeDb, path);
    set(signalRef, {
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

      Object.entries(data).forEach(async ([senderId, signalData]: [string, any]) => {
        if (!signalData || !signalData.type) return;

        let pc = this.peerConnections.get(senderId);
        if (!pc) {
          pc = new RTCPeerConnection(this.iceServers);
          this.peerConnections.set(senderId, pc);

          if (this.localStream) {
            this.localStream.getTracks().forEach(track => pc!.addTrack(track, this.localStream!));
          }

          pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              this.remoteStreams.set(senderId, event.streams[0]);
              this.notifySubscribers();
            }
          };

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              this.sendSignal(senderId, {
                type: 'candidate',
                candidate: event.candidate.toJSON()
              });
            }
          };
        }

        if (signalData.type === 'offer' && signalData.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignal(senderId, {
            type: 'answer',
            sdp: pc.localDescription
          });
        } else if (signalData.type === 'answer' && signalData.sdp) {
          if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          }
        } else if (signalData.type === 'candidate' && signalData.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          } catch (e) {
            console.warn('Error adding ICE candidate:', e);
          }
        }

        // Clean processed signal
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
