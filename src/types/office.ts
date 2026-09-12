export type UserRoleName = 'Owner' | 'Office Builder' | 'Manager' | 'Employee' | 'Guest';

export type PermissionCode = 
  | 'org:manage'
  | 'org:invite'
  | 'office:create'
  | 'office:edit_layout'
  | 'office:delete'
  | 'room:create'
  | 'room:manage'
  | 'room:access_restricted'
  | 'user:manage_roles'
  | 'meeting:create'
  | 'chat:send';

export interface Role {
  id: string;
  name: UserRoleName;
  permissions: PermissionCode[];
  isSystem?: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  avatar: string; // Emoji fallback
  avatarUrl?: string; // Custom uploaded profile photo (data URL / image link)
  color: string;
  role: UserRoleName;
  organizationId?: string;
  isSuperAdmin?: boolean;
  customPermissions?: PermissionCode[];
  createdAt: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  ownerId: string;
  ownerEmail: string;
  createdAt: number;
}

export type RoomType = 'meeting' | 'manager_cabin' | 'team_room' | 'tea_area' | 'reception' | 'garden' | 'restroom';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  maxOccupancy?: number;
  isPrivate?: boolean;
  allowedRoles?: UserRoleName[];
  allowedEmails?: string[];
  voiceEnabled: boolean;
  videoEnabled: boolean;
}

export interface Door {
  id: string;
  roomId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical';
  requiresPermission?: boolean;
  allowedRoles?: UserRoleName[];
  allowedEmails?: string[];
  isOpen?: boolean; // Dynamic door opening state
}

export type ObjectType = 
  | 'desk' 
  | 'chair' 
  | 'table' 
  | 'sofa' 
  | 'computer' 
  | 'plant' 
  | 'coffee_machine' 
  | 'whiteboard' 
  | 'door' 
  | 'wall' 
  | 'tree'
  | 'bench'
  | 'reception_desk'
  | 'restroom_sink'
  | 'tv_screen';

export interface OfficeObject {
  id: string;
  type: ObjectType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  isSolid: boolean;
  interactive?: boolean;
  interactionType?: 'workspace' | 'whiteboard' | 'coffee' | 'meeting' | 'cosmetic' | 'chair';
  icon: string;
  layer: number;
  color?: string;
}

export interface OfficeLayout {
  version: number;
  updatedAt: number;
  updatedBy: string;
  dimensions: {
    width: number;
    height: number;
    gridSize: number;
  };
  backgroundColor: string;
  walls: { x1: number; y1: number; x2: number; y2: number }[];
  rooms: Room[];
  doors: Door[];
  objects: OfficeObject[];
}

export interface Office {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  icon: string;
  layout: OfficeLayout;
  allowedEmails: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type PresenceStatus = 'active' | 'away' | 'busy' | 'offline';

export interface UserPosition {
  userId: string;
  officeId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  direction: 'up' | 'down' | 'left' | 'right';
  currentRoomId?: string;
  status: PresenceStatus;
  isMicOn: boolean;
  isCamOn: boolean;
  isScreenSharing: boolean;
  updatedAt: number;
}

export interface PublicChannel {
  id: string;
  officeId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: number;
  isDefault?: boolean;
}

export interface ChatMessage {
  id: string;
  officeId: string;
  scope: 'office' | 'room' | 'direct' | 'channel';
  channelId?: string;
  roomId?: string;
  recipientId?: string;
  recipientEmail?: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderAvatar: string;
  content: string;
  timestamp: number;
}

export interface MeetingSession {
  id: string;
  officeId: string;
  roomId: string;
  title: string;
  hostId: string;
  participants: string[];
  startedAt: number;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  timestamp: number;
}
