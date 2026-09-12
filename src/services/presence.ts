import type { UserPosition, PresenceStatus } from '../types/office';
import { 
  syncFirebasePlayerPosition, 
  subscribeFirebasePresence, 
  removeFirebasePresence 
} from './firebase';

type PositionCallback = (positions: UserPosition[]) => void;
type ChatCallback = (msg: any) => void;

class RealtimePresenceService {
  private channel: BroadcastChannel | null = null;
  private officeId: string = '';
  private myUserId: string = '';
  private positions: Map<string, UserPosition> = new Map();
  private positionSubscribers: Set<PositionCallback> = new Set();
  private chatSubscribers: Set<ChatCallback> = new Set();

  private myPosition: UserPosition | null = null;
  private syncInterval: any = null;
  private unsubFirebasePresence: (() => void) | null = null;

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('meta_office_realtime_bus_v3');
      this.channel.onmessage = (event) => this.handleIncomingMessage(event.data);
    }
  }

  joinOffice(officeId: string, userId: string, initialX: number = 300, initialY: number = 300) {
    this.officeId = officeId;
    this.myUserId = userId;

    this.myPosition = {
      userId,
      officeId,
      x: initialX,
      y: initialY,
      vx: 0,
      vy: 0,
      direction: 'down',
      status: 'active',
      isMicOn: false,
      isCamOn: false,
      isScreenSharing: false,
      updatedAt: Date.now()
    };

    // Reset positions map for new office session
    this.positions.clear();
    this.positions.set(userId, { ...this.myPosition });

    // 1. Sync & Subscribe to Firebase Realtime DB Presence across ALL devices & computers
    if (this.unsubFirebasePresence) this.unsubFirebasePresence();
    this.unsubFirebasePresence = subscribeFirebasePresence(officeId, (remotePositions) => {
      if (remotePositions && Array.isArray(remotePositions)) {
        remotePositions.forEach(p => {
          if (p && p.userId) {
            this.positions.set(p.userId, p);
          }
        });
        this.notifySubscribers();
      }
    });

    syncFirebasePlayerPosition(officeId, userId, this.myPosition);

    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => this.broadcastMyPosition(), 80);

    // Announce join via local bus & Firebase
    this.broadcast({ type: 'JOIN', position: this.myPosition });
    this.broadcastMyPosition();
    this.notifySubscribers();
  }

  leaveOffice() {
    if (this.myPosition && this.officeId) {
      this.broadcast({ type: 'LEAVE', userId: this.myUserId });
      removeFirebasePresence(this.officeId, this.myUserId);
    }
    if (this.unsubFirebasePresence) {
      this.unsubFirebasePresence();
      this.unsubFirebasePresence = null;
    }
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.positions.clear();
  }

  updateMyPosition(x: number, y: number, vx: number, vy: number, direction: 'up' | 'down' | 'left' | 'right', roomId?: string) {
    if (!this.myPosition) return;
    this.myPosition.x = x;
    this.myPosition.y = y;
    this.myPosition.vx = vx;
    this.myPosition.vy = vy;
    this.myPosition.direction = direction;
    this.myPosition.currentRoomId = roomId;
    this.myPosition.updatedAt = Date.now();

    this.positions.set(this.myUserId, { ...this.myPosition });
    this.broadcastMyPosition();
    this.notifySubscribers();
  }

  updateMyStatus(status: PresenceStatus) {
    if (!this.myPosition) return;
    this.myPosition.status = status;
    this.positions.set(this.myUserId, { ...this.myPosition });
    this.broadcastMyPosition();
    this.notifySubscribers();
  }

  updateMediaState(isMicOn: boolean, isCamOn: boolean, isScreenSharing: boolean) {
    if (!this.myPosition) return;
    this.myPosition.isMicOn = isMicOn;
    this.myPosition.isCamOn = isCamOn;
    this.myPosition.isScreenSharing = isScreenSharing;
    this.positions.set(this.myUserId, { ...this.myPosition });
    this.broadcastMyPosition();
    this.notifySubscribers();
  }

  sendChatMessage(msg: any) {
    this.broadcast({ type: 'CHAT_MSG', payload: msg });
  }

  subscribePositions(cb: PositionCallback) {
    this.positionSubscribers.add(cb);
    cb(Array.from(this.positions.values()));
    return () => { this.positionSubscribers.delete(cb); };
  }

  subscribeChat(cb: ChatCallback) {
    this.chatSubscribers.add(cb);
    return () => { this.chatSubscribers.delete(cb); };
  }

  private broadcastMyPosition() {
    if (!this.myPosition || !this.officeId) return;
    this.broadcast({
      type: 'POS_UPDATE',
      position: this.myPosition
    });
    // Multi-device Firebase RTDB sync
    syncFirebasePlayerPosition(this.officeId, this.myUserId, this.myPosition);
  }

  private broadcast(data: any) {
    if (this.channel) {
      this.channel.postMessage({ ...data, officeId: this.officeId, senderId: this.myUserId });
    }
  }

  private handleIncomingMessage(msg: any) {
    if (msg.officeId !== this.officeId || msg.senderId === this.myUserId) return;

    if (msg.type === 'JOIN' && msg.position) {
      this.positions.set(msg.position.userId, msg.position);
      this.broadcastMyPosition();
      this.notifySubscribers();
    } else if (msg.type === 'POS_UPDATE' && msg.position) {
      this.positions.set(msg.position.userId, msg.position);
      this.notifySubscribers();
    } else if (msg.type === 'LEAVE' && msg.userId) {
      this.positions.delete(msg.userId);
      this.notifySubscribers();
    } else if (msg.type === 'CHAT_MSG' && msg.payload) {
      this.chatSubscribers.forEach(cb => cb(msg.payload));
    }
  }

  private notifySubscribers() {
    const list = Array.from(this.positions.values());
    this.positionSubscribers.forEach(cb => cb(list));
  }
}

export const realtimeService = new RealtimePresenceService();
