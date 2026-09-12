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

    for (const peer of allPositions) {
      if (peer.userId === myPos.userId) continue;

      const dx = peer.x - myPos.x;
      const dy = peer.y - myPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let volume = 0;
      let inRange = false;

      if (distance <= this.fullVolumeRadius) {
        volume = 1.0;
        inRange = true;
      } else if (distance <= this.proximityRadius) {
        volume = 1.0 - (distance - this.fullVolumeRadius) / (this.proximityRadius - this.fullVolumeRadius);
        volume = Math.max(0, Math.min(1.0, volume));
        inRange = true;
      }

      const effectiveVolume = peer.isMicOn ? volume : 0;

      const item: ProximityPeer = {
        userId: peer.userId,
        distance: Math.round(distance),
        volume: Number(effectiveVolume.toFixed(2)),
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
