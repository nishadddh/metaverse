import type { 
  OfficeLayout, 
  UserPosition, 
  UserProfile, 
  Room, 
  OfficeObject,
  UserRoleName 
} from '../types/office';

export interface CanvasEngineCallbacks {
  onPositionChange: (x: number, y: number, vx: number, vy: number, direction: 'up' | 'down' | 'left' | 'right', roomId?: string) => void;
  onRoomEnter: (room: Room) => void;
  onRoomLeave: (room: Room) => void;
  onAccessDenied: (room: Room, requiredRoles: UserRoleName[]) => void;
  onObjectInteract: (obj: OfficeObject) => void;
}

export class CanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layout: OfficeLayout;
  private currentUser: UserProfile;
  private callbacks: CanvasEngineCallbacks;

  // Player state
  private playerX: number = 600;
  private playerY: number = 450;
  private playerVx: number = 0;
  private playerVy: number = 0;
  private speed: number = 4;
  private playerDirection: 'up' | 'down' | 'left' | 'right' = 'down';
  private playerRadius: number = 18;
  private currentRoom: Room | null = null;

  // Camera & Zoom State (Mouse Wheel / 2-finger Touchpad Scroll)
  public zoomLevel: number = 1.0;
  private minZoom: number = 0.4;
  private maxZoom: number = 2.5;

  // Seated Chair state
  public isSitting: boolean = false;
  public sittingChair: OfficeObject | null = null;
  public targetChair: OfficeObject | null = null;

  // Target Destination Pathing (Click / Double Tap Movement)
  private targetX: number | null = null;
  private targetY: number | null = null;
  private targetPulseRadius: number = 0;

  // Key state
  private keys: { [key: string]: boolean } = {};
  
  // Remote players
  private remotePositions: UserPosition[] = [];
  private allUsers: Map<string, UserProfile> = new Map();
  private loadedImages: Map<string, HTMLImageElement> = new Map();

  public showProximityCircle: boolean = true;
  public proximityRadius: number = 280;
  public showGrid: boolean = true;

  public isMicOn: boolean = false;
  public isCamOn: boolean = false;

  private animFrameId: number | null = null;
  private isRunning: boolean = false;

  constructor(
    canvas: HTMLCanvasElement, 
    layout: OfficeLayout, 
    currentUser: UserProfile, 
    callbacks: CanvasEngineCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.layout = layout;
    this.currentUser = currentUser;
    this.callbacks = callbacks;

    this.initEventListeners();
  }

  public updateLayout(newLayout: OfficeLayout) {
    this.layout = newLayout;
  }

  public updateRemotePlayers(positions: UserPosition[], usersList: UserProfile[]) {
    this.remotePositions = positions;
    usersList.forEach(u => {
      this.allUsers.set(u.id, u);
      if (u.avatarUrl && !this.loadedImages.has(u.avatarUrl)) {
        const img = new Image();
        img.src = u.avatarUrl;
        img.onload = () => this.loadedImages.set(u.avatarUrl!, img);
      }
    });
  }

  public setZoom(level: number) {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
  }

  public zoomIn() {
    this.setZoom(this.zoomLevel + 0.15);
  }

  public zoomOut() {
    this.setZoom(this.zoomLevel - 0.15);
  }

  public resetZoom() {
    this.setZoom(1.0);
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  public destroy() {
    this.stop();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('click', this.handleCanvasClick);
    this.canvas.removeEventListener('dblclick', this.handleCanvasDblClick);
    this.canvas.removeEventListener('wheel', this.handleWheel);
  }

  private isChairObject(obj: OfficeObject): boolean {
    const type = (obj.type || '').toLowerCase();
    const icon = obj.icon || '';
    const name = (obj.name || '').toLowerCase();
    const interaction = (obj.interactionType || '').toLowerCase();
    return (
      type === 'chair' || 
      type === 'sofa' || 
      icon === '🪑' || 
      icon === '🛋️' || 
      name.includes('chair') || 
      name.includes('sofa') || 
      interaction === 'chair'
    );
  }

  public sitOnChair(obj: OfficeObject) {
    this.isSitting = true;
    this.sittingChair = obj;
    this.targetChair = null;
    this.targetX = null;
    this.targetY = null;
    this.playerX = obj.x + obj.width / 2;
    this.playerY = obj.y + obj.height / 2;
    this.playerVx = 0;
    this.playerVy = 0;

    this.callbacks.onPositionChange(
      Math.round(this.playerX),
      Math.round(this.playerY),
      0,
      0,
      this.playerDirection,
      this.currentRoom?.id
    );
  }

  public standUp() {
    if (!this.isSitting) return;
    this.isSitting = false;
    this.sittingChair = null;
    this.targetChair = null;
  }

  public setVirtualDirection(dir: 'up' | 'down' | 'left' | 'right' | null) {
    if (this.isSitting && dir) {
      this.standUp();
    }
    this.keys['arrowup'] = dir === 'up';
    this.keys['w'] = dir === 'up';
    this.keys['arrowdown'] = dir === 'down';
    this.keys['s'] = dir === 'down';
    this.keys['arrowleft'] = dir === 'left';
    this.keys['a'] = dir === 'left';
    this.keys['arrowright'] = dir === 'right';
    this.keys['d'] = dir === 'right';
  }

  private initEventListeners = () => {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.canvas.addEventListener('click', this.handleCanvasClick);
    this.canvas.addEventListener('dblclick', this.handleCanvasDblClick);
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  };

  private handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;

      const screenX = (touch.clientX - rect.left) * scaleX;
      const screenY = (touch.clientY - rect.top) * scaleY;

      const w = this.canvas.width;
      const h = this.canvas.height;

      const clickX = (screenX - w / 2) / this.zoomLevel + this.playerX;
      const clickY = (screenY - h / 2) / this.zoomLevel + this.playerY;

      if (this.isSitting) this.standUp();
      this.targetX = clickX;
      this.targetY = clickY;
      this.targetPulseRadius = 24;
    }
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.0015;
    const delta = -e.deltaY * zoomSensitivity;
    this.setZoom(this.zoomLevel + delta);
  };

  private getCanvasCoordinates(e: MouseEvent): { clickX: number; clickY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // Convert Screen Space coordinates to Camera World Space coordinates
    const clickX = (screenX - w / 2) / this.zoomLevel + this.playerX;
    const clickY = (screenY - h / 2) / this.zoomLevel + this.playerY;

    return { clickX, clickY };
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(key)) {
      if (document.activeElement === this.canvas || document.activeElement === document.body) {
        e.preventDefault();
      }
      if (this.isSitting && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        this.standUp();
      }
      this.keys[key] = true;
      this.targetX = null;
      this.targetY = null;
      this.targetChair = null;
    }
    if (key === 'e') {
      if (this.isSitting) {
        this.standUp();
      } else {
        this.triggerNearbyInteraction();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private handleCanvasClick = (e: MouseEvent) => {
    const { clickX, clickY } = this.getCanvasCoordinates(e);

    if (this.isSitting) {
      this.standUp();
    }

    let interacted = false;
    for (const obj of this.layout.objects) {
      const chairCenterX = obj.x + obj.width / 2;
      const chairCenterY = obj.y + obj.height / 2;

      if (this.isChairObject(obj)) {
        if (
          clickX >= obj.x - 12 && clickX <= obj.x + obj.width + 12 &&
          clickY >= obj.y - 12 && clickY <= obj.y + obj.height + 12
        ) {
          const dist = Math.hypot(this.playerX - chairCenterX, this.playerY - chairCenterY);
          if (dist <= 75) {
            this.sitOnChair(obj);
          } else {
            this.targetChair = obj;
            this.setMoveTarget(chairCenterX, chairCenterY);
          }
          interacted = true;
          break;
        }
      } else if (obj.interactive) {
        if (
          clickX >= obj.x && clickX <= obj.x + obj.width &&
          clickY >= obj.y && clickY <= obj.y + obj.height
        ) {
          const dist = Math.hypot(this.playerX - chairCenterX, this.playerY - chairCenterY);
          if (dist <= 120) {
            this.callbacks.onObjectInteract(obj);
            interacted = true;
            break;
          }
        }
      }
    }

    if (!interacted) {
      this.targetChair = null;
      this.setMoveTarget(clickX, clickY);
    }
  };

  private handleCanvasDblClick = (e: MouseEvent) => {
    const { clickX, clickY } = this.getCanvasCoordinates(e);
    if (this.isSitting) {
      this.standUp();
    }
    this.targetChair = null;
    this.setMoveTarget(clickX, clickY);
  };

  private setMoveTarget(x: number, y: number) {
    const mapW = this.layout.dimensions.width;
    const mapH = this.layout.dimensions.height;
    this.targetX = Math.max(this.playerRadius + 10, Math.min(mapW - this.playerRadius - 10, x));
    this.targetY = Math.max(this.playerRadius + 10, Math.min(mapH - this.playerRadius - 10, y));
    this.targetPulseRadius = 6;
  }

  private loop = () => {
    if (!this.isRunning) return;

    this.update();
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update() {
    let dx = 0;
    let dy = 0;

    if (this.keys['w'] || this.keys['arrowup']) { dy -= 1; this.playerDirection = 'up'; }
    if (this.keys['s'] || this.keys['arrowdown']) { dy += 1; this.playerDirection = 'down'; }
    if (this.keys['a'] || this.keys['arrowleft']) { dx -= 1; this.playerDirection = 'left'; }
    if (this.keys['d'] || this.keys['arrowright']) { dx += 1; this.playerDirection = 'right'; }

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    // If standing up and moving
    if (this.isSitting && (dx !== 0 || dy !== 0)) {
      this.standUp();
    }

    if (this.isSitting && this.sittingChair) {
      this.playerX = this.sittingChair.x + this.sittingChair.width / 2;
      this.playerY = this.sittingChair.y + this.sittingChair.height / 2;
      this.playerVx = 0;
      this.playerVy = 0;
      this.updateDoorSensors();
      return;
    }

    if (dx === 0 && dy === 0 && this.targetX !== null && this.targetY !== null) {
      const distToTarget = Math.hypot(this.targetX - this.playerX, this.targetY - this.playerY);

      if (distToTarget <= 4) {
        if (this.targetChair) {
          this.sitOnChair(this.targetChair);
        } else {
          this.targetX = null;
          this.targetY = null;
          this.playerVx = 0;
          this.playerVy = 0;
        }
      } else {
        const angle = Math.atan2(this.targetY - this.playerY, this.targetX - this.playerX);
        dx = Math.cos(angle);
        dy = Math.sin(angle);

        if (Math.abs(dx) > Math.abs(dy)) {
          this.playerDirection = dx > 0 ? 'right' : 'left';
        } else {
          this.playerDirection = dy > 0 ? 'down' : 'up';
        }
      }
    }

    this.playerVx = dx * this.speed;
    this.playerVy = dy * this.speed;

    let nextX = this.playerX + this.playerVx;
    let nextY = this.playerY + this.playerVy;

    const mapW = this.layout.dimensions.width;
    const mapH = this.layout.dimensions.height;
    nextX = Math.max(this.playerRadius + 10, Math.min(mapW - this.playerRadius - 10, nextX));
    nextY = Math.max(this.playerRadius + 10, Math.min(mapH - this.playerRadius - 10, nextY));

    // Update Door Proximity Sensors
    this.updateDoorSensors();

    if (!this.checkSolidCollision(nextX, this.playerY)) {
      this.playerX = nextX;
    } else {
      this.targetX = null;
    }

    if (!this.checkSolidCollision(this.playerX, nextY)) {
      this.playerY = nextY;
    } else {
      this.targetY = null;
    }

    // Auto sit when walking onto a target chair
    if (this.targetChair && !this.isSitting) {
      const chairCenterX = this.targetChair.x + this.targetChair.width / 2;
      const chairCenterY = this.targetChair.y + this.targetChair.height / 2;
      const distToChair = Math.hypot(this.playerX - chairCenterX, this.playerY - chairCenterY);
      if (distToChair <= 20) {
        this.sitOnChair(this.targetChair);
      }
    }

    const detectedRoom = this.getRoomAtPosition(this.playerX, this.playerY);

    if (detectedRoom !== this.currentRoom) {
      if (detectedRoom) {
        if (detectedRoom.isPrivate && detectedRoom.allowedRoles && detectedRoom.allowedRoles.length > 0) {
          const hasAccess = detectedRoom.allowedRoles.includes(this.currentUser.role);
          if (!hasAccess) {
            this.playerX -= this.playerVx * 3;
            this.playerY -= this.playerVy * 3;
            this.targetX = null;
            this.targetY = null;
            this.callbacks.onAccessDenied(detectedRoom, detectedRoom.allowedRoles);
            return;
          }
        }
        this.currentRoom = detectedRoom;
        this.callbacks.onRoomEnter(detectedRoom);
      } else {
        if (this.currentRoom) {
          this.callbacks.onRoomLeave(this.currentRoom);
        }
        this.currentRoom = null;
      }
    }

    if (this.playerVx !== 0 || this.playerVy !== 0) {
      this.callbacks.onPositionChange(
        Math.round(this.playerX),
        Math.round(this.playerY),
        this.playerVx,
        this.playerVy,
        this.playerDirection,
        this.currentRoom?.id
      );
    }
  }

  private updateDoorSensors() {
    this.layout.doors.forEach(door => {
      const doorCenterX = door.x + door.width / 2;
      const doorCenterY = door.y + door.height / 2;
      const dist = Math.hypot(this.playerX - doorCenterX, this.playerY - doorCenterY);

      if (dist <= 75) {
        if (door.requiresPermission && door.allowedRoles && door.allowedRoles.length > 0) {
          const hasAccess = door.allowedRoles.includes(this.currentUser.role);
          door.isOpen = hasAccess;
        } else {
          door.isOpen = true;
        }
      } else {
        door.isOpen = false;
      }
    });
  }

  private checkSolidCollision(x: number, y: number): boolean {
    // 1. OPEN DOORWAY PASS ZONE
    for (const door of this.layout.doors) {
      if (door.isOpen) {
        const padding = 20;
        if (
          x >= door.x - padding && x <= door.x + door.width + padding &&
          y >= door.y - padding && y <= door.y + door.height + padding
        ) {
          return false;
        }
      }
    }

    // 2. Solid Objects Collision (Chairs are not solid so avatar can walk onto/sit on them!)
    for (const obj of this.layout.objects) {
      if (!obj.isSolid || this.isChairObject(obj)) continue;
      if (
        x + this.playerRadius > obj.x &&
        x - this.playerRadius < obj.x + obj.width &&
        y + this.playerRadius > obj.y &&
        y - this.playerRadius < obj.y + obj.height
      ) {
        return true;
      }
    }

    // 3. Closed / Locked Doors Collision
    for (const door of this.layout.doors) {
      if (!door.isOpen) {
        if (
          x + this.playerRadius > door.x &&
          x - this.playerRadius < door.x + door.width &&
          y + this.playerRadius > door.y &&
          y - this.playerRadius < door.y + door.height
        ) {
          return true;
        }
      }
    }

    // 4. Solid Wall Lines Collision
    for (const wall of this.layout.walls) {
      if (this.lineCircleIntersect(wall.x1, wall.y1, wall.x2, wall.y2, x, y, this.playerRadius)) {
        return true;
      }
    }

    return false;
  }

  private lineCircleIntersect(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
    const l2 = (x2 - x1)**2 + (y2 - y1)**2;
    if (l2 === 0) return Math.hypot(cx - x1, cy - y1) < r;
    let t = ((cx - x1) * (x2 - x1) + (cy - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(cx - projX, cy - projY) < r;
  }

  private getRoomAtPosition(x: number, y: number): Room | null {
    for (const room of this.layout.rooms) {
      if (
        x >= room.x && x <= room.x + room.width &&
        y >= room.y && y <= room.y + room.height
      ) {
        return room;
      }
    }
    return null;
  }

  private triggerNearbyInteraction() {
    if (this.isSitting) {
      this.standUp();
      return;
    }

    // Check chairs first
    for (const obj of this.layout.objects) {
      if (this.isChairObject(obj)) {
        const chairCenterX = obj.x + obj.width / 2;
        const chairCenterY = obj.y + obj.height / 2;
        const dist = Math.hypot(this.playerX - chairCenterX, this.playerY - chairCenterY);
        if (dist <= 80) {
          this.sitOnChair(obj);
          return;
        }
      }
    }

    // Check other interactive objects
    for (const obj of this.layout.objects) {
      if (obj.interactive) {
        const dist = Math.hypot(this.playerX - (obj.x + obj.width/2), this.playerY - (obj.y + obj.height/2));
        if (dist <= 80) {
          this.callbacks.onObjectInteract(obj);
          break;
        }
      }
    }
  }

  private render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background
    ctx.fillStyle = this.layout.backgroundColor || '#0f172a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();

    // Apply Camera Center Follow & Touchpad/Wheel Zoom Scale Transform!
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoomLevel, this.zoomLevel);
    ctx.translate(-this.playerX, -this.playerY);

    // Grid
    if (this.showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = this.layout.dimensions.gridSize || 32;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    // Room Zones
    this.layout.rooms.forEach(room => {
      ctx.fillStyle = room.color || 'rgba(59, 130, 246, 0.1)';
      ctx.fillRect(room.x, room.y, room.width, room.height);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(room.x, room.y, room.width, room.height);
      ctx.setLineDash([]);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 14px Outfit, Inter, sans-serif';
      ctx.fillText(room.name, room.x + 12, room.y + 24);

      if (room.isPrivate) {
        ctx.fillStyle = '#ef4444';
        ctx.font = '500 11px sans-serif';
        ctx.fillText('🔒 RESTRICTED', room.x + 12, room.y + 42);
      }
    });

    // Solid Walls
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    this.layout.walls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    });

    // Animated Interactive Doors
    this.layout.doors.forEach(door => {
      ctx.save();
      if (door.isOpen) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.fillRect(door.x - 4, door.y - 4, door.width + 8, door.height + 8);

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(door.x - 4, door.y - 4, door.width + 8, door.height + 8);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🚪 OPEN PASSAGE', door.x + door.width / 2, door.y - 8);
      } else {
        ctx.fillStyle = door.requiresPermission ? '#ef4444' : '#f59e0b';
        ctx.fillRect(door.x, door.y, door.width, door.height);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(door.x, door.y, door.width, door.height);

        if (door.requiresPermission) {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🔒 LOCKED', door.x + door.width / 2, door.y - 6);
        }
      }
      ctx.restore();
    });

    // Furniture Objects
    this.layout.objects.forEach(obj => {
      ctx.save();
      ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
      ctx.rotate((obj.rotation * Math.PI) / 180);

      const isChair = this.isChairObject(obj);
      const isOccupied = this.isSitting && this.sittingChair?.id === obj.id;

      if (isChair) {
        ctx.fillStyle = isOccupied ? '#10b981' : (obj.color || '#334155');
        ctx.strokeStyle = isOccupied ? '#34d399' : 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = isOccupied ? 2 : 1.5;
      } else {
        ctx.fillStyle = obj.color || '#1e293b';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
      }

      ctx.fillRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
      ctx.strokeRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);

      ctx.font = `${Math.min(obj.width, obj.height) * 0.55}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.icon, 0, 0);

      // Chair Hover Prompt
      if (isChair && !this.isSitting) {
        const dist = Math.hypot(this.playerX - (obj.x + obj.width/2), this.playerY - (obj.y + obj.height/2));
        if (dist <= 80) {
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('[E] Sit Down', 0, -obj.height/2 - 10);
        }
      } else if (obj.interactive && !isChair) {
        const dist = Math.hypot(this.playerX - (obj.x + obj.width/2), this.playerY - (obj.y + obj.height/2));
        if (dist <= 80) {
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('[E] Interact', 0, -obj.height/2 - 10);
        }
      }

      ctx.restore();
    });

    // Target Destination Marker Animation
    if (this.targetX !== null && this.targetY !== null) {
      this.targetPulseRadius = (this.targetPulseRadius + 0.3) % 18;
      ctx.beginPath();
      ctx.arc(this.targetX, this.targetY, 8 + this.targetPulseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = this.targetChair ? '#10b981' : '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(this.targetX, this.targetY, 4, 0, Math.PI * 2);
      ctx.fillStyle = this.targetChair ? '#10b981' : '#38bdf8';
      ctx.fill();
    }

    // Proximity Spatial Circle
    if (this.showProximityCircle) {
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY, this.proximityRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.03)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Remote Players
    this.remotePositions.forEach(p => {
      if (p.userId === this.currentUser.id) return;
      const user = this.allUsers.get(p.userId);
      this.drawAvatar(
        p.x, 
        p.y, 
        user?.fullName || 'Teammate', 
        user?.avatar || '👤', 
        user?.avatarUrl,
        user?.color || '#94a3b8', 
        p.status,
        p.isMicOn,
        p.isCamOn,
        false
      );
    });

    // Local Player Avatar
    this.drawAvatar(
      this.playerX,
      this.playerY,
      `${this.currentUser.fullName} (You)`,
      this.currentUser.avatar || '👨‍💻',
      this.currentUser.avatarUrl,
      this.currentUser.color || '#3b82f6',
      'active',
      this.isMicOn,
      this.isCamOn,
      true
    );

    ctx.restore();

    // Screen-space Floating HUD Badges & Zoom Info
    this.renderHUD(w, h);
  }

  private renderHUD(w: number, h: number) {
    const ctx = this.ctx;

    // Zoom Indicator Badge
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(w - 250, 16, 230, 34);
    ctx.strokeRect(w - 250, 16, 230, 34);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const percent = Math.round(this.zoomLevel * 100);
    ctx.fillText(`🔍 Zoom: ${percent}% • 2-finger Scroll`, w - 135, 33);
    ctx.restore();

    // Seated HUD Prompt for Local Player
    if (this.isSitting) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.fillRect(w / 2 - 140, h - 50, 280, 32);
      ctx.strokeRect(w / 2 - 140, h - 50, 280, 32);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪑 SEATED • Press [WASD], [E] or Click to Stand Up', w / 2, h - 34);
      ctx.restore();
    }
  }

  private drawAvatar(
    x: number, 
    y: number, 
    name: string, 
    avatar: string, 
    avatarUrl: string | undefined,
    color: string, 
    status: string,
    isMicOn: boolean,
    isCamOn: boolean,
    isLocal: boolean
  ) {
    const ctx = this.ctx;

    if (isLocal) {
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fillStyle = this.isSitting ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.25)';
      ctx.fill();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = this.isSitting && isLocal ? '#10b981' : '#ffffff';
    ctx.lineWidth = this.isSitting && isLocal ? 3 : 2;
    ctx.stroke();

    const customImg = avatarUrl ? this.loadedImages.get(avatarUrl) : null;
    if (customImg && customImg.complete) {
      ctx.clip();
      ctx.drawImage(customImg, x - 18, y - 18, 36, 36);
    } else {
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(avatar, x, y);
    }
    ctx.restore();

    const statusColor = status === 'busy' ? '#ef4444' : status === 'away' ? '#f59e0b' : '#10b981';
    ctx.beginPath();
    ctx.arc(x + 12, y + 12, 5, 0, Math.PI * 2);
    ctx.fillStyle = statusColor;
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Overhead Camera & Mic Badge Pill
    if (isMicOn || isCamOn) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = isCamOn ? '#3b82f6' : '#10b981';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x - 26, y - 44, 52, 18);
      ctx.strokeRect(x - 26, y - 44, 52, 18);

      ctx.font = 'bold 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${isMicOn ? '🎙️ LIVE' : ''}${isMicOn && isCamOn ? ' ' : ''}${isCamOn ? '🎥 CAM' : ''}`, x, y - 35);
      ctx.restore();
    }

    ctx.font = '600 11px Inter, sans-serif';
    const textWidth = ctx.measureText(name).width;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(x - textWidth / 2 - 6, y + 24, textWidth + 12, 16);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(x - textWidth / 2 - 6, y + 24, textWidth + 12, 16);

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(name, x, y + 26);
  }
}
