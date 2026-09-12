import type { 
  OfficeLayout, 
  OfficeObject, 
  Room, 
  Door, 
  ObjectType, 
  RoomType 
} from '../types/office';

export type BuilderTool = 'select' | 'wall' | 'door' | 'room' | 'furniture' | 'eraser';

export interface BuilderEngineCallbacks {
  onSelectionChange: (selected: { type: 'object' | 'room' | 'door' | 'wall'; item: any } | null) => void;
  onLayoutChange: (layout: OfficeLayout) => void;
}

export class BuilderEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layout: OfficeLayout;
  private callbacks: BuilderEngineCallbacks;

  public activeTool: BuilderTool = 'select';
  public selectedFurnitureType: ObjectType = 'desk';
  public selectedFurnitureIcon: string = '💻';
  public selectedRoomType: RoomType = 'meeting';

  public selectedItem: { type: 'object' | 'room' | 'door' | 'wall'; id: string; item: any } | null = null;

  private isDragging: boolean = false;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  private isDrawingWall: boolean = false;
  private wallStartX: number = 0;
  private wallStartY: number = 0;
  private wallCurrentX: number = 0;
  private wallCurrentY: number = 0;

  private isDrawingRoom: boolean = false;
  private roomStartX: number = 0;
  private roomStartY: number = 0;
  private roomCurrentX: number = 0;
  private roomCurrentY: number = 0;

  constructor(canvas: HTMLCanvasElement, layout: OfficeLayout, callbacks: BuilderEngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.layout = JSON.parse(JSON.stringify(layout));
    this.callbacks = callbacks;

    this.initEvents();
    this.render();
  }

  public setTool(tool: BuilderTool) {
    this.activeTool = tool;
    this.selectedItem = null;
    this.callbacks.onSelectionChange(null);
    this.render();
  }

  public getLayout(): OfficeLayout {
    return this.layout;
  }

  public updateSelectedObjectProps(props: Partial<OfficeObject>) {
    if (this.selectedItem && this.selectedItem.type === 'object') {
      const obj = this.layout.objects.find(o => o.id === this.selectedItem!.id);
      if (obj) {
        Object.assign(obj, props);
        this.callbacks.onLayoutChange(this.layout);
        this.render();
      }
    }
  }

  public updateSelectedRoomProps(props: Partial<Room>) {
    if (this.selectedItem && this.selectedItem.type === 'room') {
      const rm = this.layout.rooms.find(r => r.id === this.selectedItem!.id);
      if (rm) {
        Object.assign(rm, props);
        this.callbacks.onLayoutChange(this.layout);
        this.render();
      }
    }
  }

  public rotateSelectedObject() {
    if (this.selectedItem && this.selectedItem.type === 'object') {
      const obj = this.layout.objects.find(o => o.id === this.selectedItem!.id);
      if (obj) {
        obj.rotation = (obj.rotation + 90) % 360;
        this.callbacks.onLayoutChange(this.layout);
        this.render();
      }
    }
  }

  public deleteSelected() {
    if (!this.selectedItem) return;
    const { type, id } = this.selectedItem;

    if (type === 'object') {
      this.layout.objects = this.layout.objects.filter(o => o.id !== id);
    } else if (type === 'room') {
      this.layout.rooms = this.layout.rooms.filter(r => r.id !== id);
    } else if (type === 'door') {
      this.layout.doors = this.layout.doors.filter(d => d.id !== id);
    }

    this.selectedItem = null;
    this.callbacks.onSelectionChange(null);
    this.callbacks.onLayoutChange(this.layout);
    this.render();
  }

  private snap(val: number, gridSize: number = 32): number {
    return Math.round(val / gridSize) * gridSize;
  }

  private initEvents() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
  }

  public destroy() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
  }

  private handleMouseDown = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const grid = this.layout.dimensions.gridSize || 32;

    if (this.activeTool === 'select') {
      let found = false;
      for (const obj of this.layout.objects) {
        if (x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height) {
          this.selectedItem = { type: 'object', id: obj.id, item: obj };
          this.isDragging = true;
          this.dragOffsetX = x - obj.x;
          this.dragOffsetY = y - obj.y;
          found = true;
          break;
        }
      }

      if (!found) {
        for (const room of this.layout.rooms) {
          if (x >= room.x && x <= room.x + room.width && y >= room.y && y <= room.y + room.height) {
            this.selectedItem = { type: 'room', id: room.id, item: room };
            found = true;
            break;
          }
        }
      }

      if (!found) {
        this.selectedItem = null;
      }

      this.callbacks.onSelectionChange(this.selectedItem ? { type: this.selectedItem.type, item: this.selectedItem.item } : null);
    } 
    else if (this.activeTool === 'furniture') {
      const snappedX = this.snap(x - 32, grid);
      const snappedY = this.snap(y - 32, grid);

      const newObj: OfficeObject = {
        id: 'obj_' + Math.random().toString(36).substr(2, 9),
        type: this.selectedFurnitureType,
        name: this.selectedFurnitureType.replace('_', ' ').toUpperCase(),
        x: snappedX,
        y: snappedY,
        width: 64,
        height: 64,
        rotation: 0,
        isSolid: true,
        interactive: true,
        icon: this.selectedFurnitureIcon,
        layer: 1
      };

      this.layout.objects.push(newObj);
      this.selectedItem = { type: 'object', id: newObj.id, item: newObj };
      this.callbacks.onSelectionChange({ type: 'object', item: newObj });
      this.callbacks.onLayoutChange(this.layout);
      this.activeTool = 'select';
    } 
    else if (this.activeTool === 'wall') {
      this.isDrawingWall = true;
      this.wallStartX = this.snap(x, grid);
      this.wallStartY = this.snap(y, grid);
      this.wallCurrentX = this.wallStartX;
      this.wallCurrentY = this.wallStartY;
    }
    else if (this.activeTool === 'door') {
      const snappedX = this.snap(x - 16, grid);
      const snappedY = this.snap(y - 16, grid);
      const newDoor: Door = {
        id: 'door_' + Math.random().toString(36).substr(2, 9),
        x: snappedX,
        y: snappedY,
        width: 64,
        height: 16,
        orientation: 'horizontal'
      };
      this.layout.doors.push(newDoor);
      this.callbacks.onLayoutChange(this.layout);
      this.activeTool = 'select';
    }
    else if (this.activeTool === 'room') {
      this.isDrawingRoom = true;
      this.roomStartX = this.snap(x, grid);
      this.roomStartY = this.snap(y, grid);
      this.roomCurrentX = this.roomStartX;
      this.roomCurrentY = this.roomStartY;
    }
    else if (this.activeTool === 'eraser') {
      this.layout.objects = this.layout.objects.filter(obj => 
        !(x >= obj.x && x <= obj.x + obj.width && y >= obj.y && y <= obj.y + obj.height)
      );
      this.callbacks.onLayoutChange(this.layout);
    }

    this.render();
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const grid = this.layout.dimensions.gridSize || 32;

    if (this.isDragging && this.selectedItem && this.selectedItem.type === 'object') {
      const obj = this.layout.objects.find(o => o.id === this.selectedItem!.id);
      if (obj) {
        obj.x = this.snap(x - this.dragOffsetX, grid);
        obj.y = this.snap(y - this.dragOffsetY, grid);
        this.callbacks.onLayoutChange(this.layout);
      }
    } else if (this.isDrawingWall) {
      this.wallCurrentX = this.snap(x, grid);
      this.wallCurrentY = this.snap(y, grid);
    } else if (this.isDrawingRoom) {
      this.roomCurrentX = this.snap(x, grid);
      this.roomCurrentY = this.snap(y, grid);
    }

    this.render();
  };

  private handleMouseUp = () => {
    if (this.isDrawingWall) {
      this.isDrawingWall = false;
      if (this.wallStartX !== this.wallCurrentX || this.wallStartY !== this.wallCurrentY) {
        this.layout.walls.push({
          x1: this.wallStartX,
          y1: this.wallStartY,
          x2: this.wallCurrentX,
          y2: this.wallCurrentY
        });
        this.callbacks.onLayoutChange(this.layout);
      }
    } else if (this.isDrawingRoom) {
      this.isDrawingRoom = false;
      const rx = Math.min(this.roomStartX, this.roomCurrentX);
      const ry = Math.min(this.roomStartY, this.roomCurrentY);
      const rw = Math.abs(this.roomCurrentX - this.roomStartX);
      const rh = Math.abs(this.roomCurrentY - this.roomStartY);

      if (rw >= 64 && rh >= 64) {
        const newRoom: Room = {
          id: 'room_' + Math.random().toString(36).substr(2, 9),
          name: `New ${this.selectedRoomType.replace('_', ' ')}`,
          type: this.selectedRoomType,
          x: rx,
          y: ry,
          width: rw,
          height: rh,
          color: 'rgba(59, 130, 246, 0.15)',
          voiceEnabled: true,
          videoEnabled: true
        };
        this.layout.rooms.push(newRoom);
        this.selectedItem = { type: 'room', id: newRoom.id, item: newRoom };
        this.callbacks.onSelectionChange({ type: 'room', item: newRoom });
        this.callbacks.onLayoutChange(this.layout);
      }
    }

    this.isDragging = false;
    this.render();
  };

  public render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = this.layout.backgroundColor || '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const grid = this.layout.dimensions.gridSize || 32;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    this.layout.rooms.forEach(room => {
      const isSelected = this.selectedItem?.id === room.id;
      ctx.fillStyle = room.color || 'rgba(59, 130, 246, 0.15)';
      ctx.fillRect(room.x, room.y, room.width, room.height);

      ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(room.x, room.y, room.width, room.height);
      ctx.setLineDash([]);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText(room.name, room.x + 8, room.y + 20);
    });

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    this.layout.walls.forEach(wall => {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    });

    if (this.isDrawingWall) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(this.wallStartX, this.wallStartY);
      ctx.lineTo(this.wallCurrentX, this.wallCurrentY);
      ctx.stroke();
    }

    if (this.isDrawingRoom) {
      const rx = Math.min(this.roomStartX, this.roomCurrentX);
      const ry = Math.min(this.roomStartY, this.roomCurrentY);
      const rw = Math.abs(this.roomCurrentX - this.roomStartX);
      const rh = Math.abs(this.roomCurrentY - this.roomStartY);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(rx, ry, rw, rh);
    }

    this.layout.doors.forEach(door => {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(door.x, door.y, door.width, door.height);
    });

    this.layout.objects.forEach(obj => {
      const isSelected = this.selectedItem?.id === obj.id;

      ctx.save();
      ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
      ctx.rotate((obj.rotation * Math.PI) / 180);

      ctx.fillStyle = obj.color || '#1e293b';
      ctx.fillRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);

      ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);

      ctx.font = `${Math.min(obj.width, obj.height) * 0.5}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.icon, 0, 0);

      ctx.restore();
    });
  }
}
