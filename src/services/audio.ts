import type { UserPosition } from '../types/office';

export interface ProximityPeer {
  userId: string;
  distance: number;
  volume: number;
  inRange: boolean;
}

class SpatialAudioService {
  private ctx: AudioContext | null = null;
  private proximityRadius: number = 280;
  private fullVolumeRadius: number = 80;
  private peerStates: Map<string, ProximityPeer> = new Map();
  private subscribers: Set<(peers: ProximityPeer[]) => void> = new Set();

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setProximityRadius(radius: number) {
    this.proximityRadius = Math.max(80, Math.min(600, radius));
    this.fullVolumeRadius = Math.round(this.proximityRadius * 0.3);
  }

  getProximityRadius(): number {
    return this.proximityRadius;
  }

  calculateProximity(myPos: UserPosition, allPositions: UserPosition[]): ProximityPeer[] {
    const results: ProximityPeer[] = [];
    const myRoomId = myPos.currentRoomId || 'open_workspace';

    for (const peer of allPositions) {
      if (peer.userId === myPos.userId) continue;

      const peerRoomId = peer.currentRoomId || 'open_workspace';

      // 1. CRITICAL ROOM ISOLATION REQUIREMENT:
      // If User A is in Open Workspace and User B is in Private Meeting Room (or different rooms),
      // communication MUST be 100% ISOLATED (volume = 0)! Soundproof boundary enforced.
      if (myRoomId !== peerRoomId) {
        const item: ProximityPeer = {
          userId: peer.userId,
          distance: 9999,
          volume: 0,
          inRange: false
        };
        results.push(item);
        this.peerStates.set(peer.userId, item);
        continue;
      }

      // 2. SAME-ROOM COMMUNICATION MODE:
      // If users are inside the SAME room, distance inside the room does NOT block audio.
      // All authorized room participants belong to the room session (volume = 1.0)!
      let volume = 0;
      let inRange = false;
      let distance = 0;

      if (myRoomId !== 'open_workspace') {
        volume = peer.isMicOn ? 1.0 : 0;
        inRange = true;
        distance = Math.round(Math.hypot(peer.x - myPos.x, peer.y - myPos.y));
      } else {
        // 3. OPEN WORKSPACE PROXIMITY MODE:
        // Proximity audio active ONLY within the open area zone.
        const dx = peer.x - myPos.x;
        const dy = peer.y - myPos.y;
        distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= this.fullVolumeRadius) {
          volume = 1.0;
          inRange = true;
        } else if (distance <= this.proximityRadius) {
          volume = 1.0 - (distance - this.fullVolumeRadius) / (this.proximityRadius - this.fullVolumeRadius);
          volume = Math.max(0, Math.min(1.0, volume));
          inRange = true;
        }
        if (!peer.isMicOn) volume = 0;
      }

      const item: ProximityPeer = {
        userId: peer.userId,
        distance: Math.round(distance),
        volume: Number(volume.toFixed(2)),
        inRange
      };

      results.push(item);
      this.peerStates.set(peer.userId, item);
    }

    this.notifySubscribers(results);
    return results;
  }

  subscribeProximity(cb: (peers: ProximityPeer[]) => void) {
    this.subscribers.add(cb);
    return () => { this.subscribers.delete(cb); };
  }

  private notifySubscribers(peers: ProximityPeer[]) {
    this.subscribers.forEach(cb => cb(peers));
  }
}

export const spatialAudio = new SpatialAudioService();
