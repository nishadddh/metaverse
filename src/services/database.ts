import type { 
  Organization, 
  Office, 
  UserProfile, 
  AuditLog, 
  UserRoleName, 
  OfficeLayout 
} from '../types/office';
import { syncUserToFirebase, syncOfficeAccessToFirebase } from './firebase';

// Helper function to extract a clean First Name & Last Name from any email address
export const extractNameFromEmail = (email: string): string => {
  if (!email) return 'User';
  const prefix = email.split('@')[0] || 'User';
  // Replace dots, underscores, hyphens with spaces
  const clean = prefix.replace(/[\._\-]/g, ' ');
  // Capitalize each word
  return clean
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const KEYS = {
  USERS: 'meta_office_users_v3',
  ORGS: 'meta_office_orgs_v3',
  OFFICES: 'meta_office_offices_v3',
  AUDIT: 'meta_office_audit_v3',
  CURRENT_USER: 'meta_office_current_user_v3'
};

const DEFAULT_SUPER_ADMIN: UserProfile = {
  id: 'usr_dev_superadmin',
  email: 'developer@metaverse.com',
  password: 'admin',
  fullName: 'Developer (Super Admin)',
  avatar: '⚡',
  color: '#ec4899',
  role: 'Owner',
  isSuperAdmin: true,
  createdAt: Date.now() - 86400000 * 365
};

const DEFAULT_NISHAD_SUPER_ADMIN: UserProfile = {
  id: 'usr_nishad_superadmin',
  email: 'nishadnisha2001@gmail.com',
  password: 'admin',
  fullName: 'Nishad (Platform Super Admin)',
  avatar: '👑',
  color: '#ec4899',
  role: 'Owner',
  isSuperAdmin: true,
  createdAt: Date.now() - 86400000 * 365
};

const DEFAULT_ACME_OWNER: UserProfile = {
  id: 'usr_acme_owner',
  email: 'owner@acme.com',
  password: '123',
  fullName: extractNameFromEmail('owner@acme.com'),
  avatar: '👨‍💼',
  color: '#3b82f6',
  role: 'Owner',
  organizationId: 'org_acme_corp',
  isSuperAdmin: false,
  createdAt: Date.now() - 86400000 * 30
};

const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_acme_corp',
    name: 'Acme Metaverse Corp',
    slug: 'acme-corp',
    logoUrl: '🏢',
    ownerId: 'usr_acme_owner',
    ownerEmail: 'owner@acme.com',
    createdAt: Date.now() - 86400000 * 30
  },
  {
    id: 'org_nexus_inc',
    name: 'Nexus Global Tech',
    slug: 'nexus-tech',
    logoUrl: '🚀',
    ownerId: 'usr_dev_superadmin',
    ownerEmail: 'developer@metaverse.com',
    createdAt: Date.now() - 86400000 * 10
  }
];

const DEFAULT_KOCHI_LAYOUT: OfficeLayout = {
  version: 1,
  updatedAt: Date.now(),
  updatedBy: 'usr_acme_owner',
  dimensions: { width: 1600, height: 1000, gridSize: 32 },
  backgroundColor: '#0f172a',
  walls: [
    { x1: 64, y1: 64, x2: 1536, y2: 64 },
    { x1: 1536, y1: 64, x2: 1536, y2: 936 },
    { x1: 1536, y1: 936, x2: 64, y2: 936 },
    { x1: 64, y1: 936, x2: 64, y2: 64 },
    { x1: 64, y1: 400, x2: 500, y2: 400 },
    { x1: 500, y1: 64, x2: 500, y2: 400 },
    { x1: 1100, y1: 64, x2: 1100, y2: 400 },
    { x1: 1100, y1: 400, x2: 1536, y2: 400 },
    { x1: 64, y1: 650, x2: 450, y2: 650 },
    { x1: 450, y1: 650, x2: 450, y2: 936 }
  ],
  rooms: [
    {
      id: 'room_meeting_01',
      name: 'Marketing Meeting Room',
      type: 'meeting',
      x: 64,
      y: 64,
      width: 436,
      height: 336,
      color: 'rgba(59, 130, 246, 0.15)',
      maxOccupancy: 8,
      voiceEnabled: true,
      videoEnabled: true
    },
    {
      id: 'room_manager_01',
      name: 'CEO Manager Cabin',
      type: 'manager_cabin',
      x: 1100,
      y: 64,
      width: 436,
      height: 336,
      color: 'rgba(139, 92, 246, 0.15)',
      isPrivate: true,
      allowedRoles: ['Owner', 'Manager'],
      voiceEnabled: true,
      videoEnabled: true
    },
    {
      id: 'room_tea_01',
      name: 'Tea & Coffee Lounge',
      type: 'tea_area',
      x: 64,
      y: 650,
      width: 386,
      height: 286,
      color: 'rgba(16, 185, 129, 0.15)',
      voiceEnabled: true,
      videoEnabled: false
    },
    {
      id: 'room_dev_zone',
      name: 'Main Engineering Workspace',
      type: 'team_room',
      x: 550,
      y: 100,
      width: 500,
      height: 500,
      color: 'rgba(245, 158, 11, 0.08)',
      voiceEnabled: true,
      videoEnabled: false
    }
  ],
  doors: [
    { id: 'door_meet', roomId: 'room_meeting_01', x: 250, y: 400, width: 64, height: 16, orientation: 'horizontal' },
    { id: 'door_mgr', roomId: 'room_manager_01', x: 1280, y: 400, width: 64, height: 16, orientation: 'horizontal', requiresPermission: true, allowedRoles: ['Owner', 'Manager'] },
    { id: 'door_tea', roomId: 'room_tea_01', x: 450, y: 780, width: 16, height: 64, orientation: 'vertical' }
  ],
  objects: [
    { id: 'obj_meet_table', type: 'table', name: 'Conference Table', x: 180, y: 180, width: 180, height: 100, rotation: 0, isSolid: true, interactive: true, interactionType: 'meeting', icon: '🗣️', layer: 1, color: '#1e293b' },
    { id: 'obj_chair_1', type: 'chair', name: 'Meeting Chair', x: 140, y: 215, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_chair_2', type: 'chair', name: 'Meeting Chair', x: 370, y: 215, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_wb_1', type: 'whiteboard', name: 'Strategy Whiteboard', x: 220, y: 80, width: 100, height: 32, rotation: 0, isSolid: true, interactive: true, interactionType: 'whiteboard', icon: '📋', layer: 1 },
    { id: 'obj_mgr_desk', type: 'desk', name: 'Executive Desk', x: 1250, y: 160, width: 140, height: 80, rotation: 0, isSolid: true, interactive: true, interactionType: 'workspace', icon: '🖥️', layer: 1, color: '#334155' },
    { id: 'obj_mgr_chair', type: 'chair', name: 'Executive Swivel Chair', x: 1304, y: 250, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_mgr_sofa', type: 'sofa', name: 'VIP Sofa', x: 1150, y: 280, width: 120, height: 48, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🛋️', layer: 1 },
    { id: 'obj_dev_desk_1', type: 'desk', name: 'Dev Workstation 1', x: 600, y: 200, width: 96, height: 64, rotation: 0, isSolid: true, interactive: true, interactionType: 'workspace', icon: '💻', layer: 1 },
    { id: 'obj_dev_chair_1', type: 'chair', name: 'Ergonomic Dev Chair 1', x: 632, y: 272, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_dev_desk_2', type: 'desk', name: 'Dev Workstation 2', x: 750, y: 200, width: 96, height: 64, rotation: 0, isSolid: true, interactive: true, interactionType: 'workspace', icon: '💻', layer: 1 },
    { id: 'obj_dev_chair_2', type: 'chair', name: 'Ergonomic Dev Chair 2', x: 782, y: 272, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_dev_desk_3', type: 'desk', name: 'Dev Workstation 3', x: 900, y: 200, width: 96, height: 64, rotation: 0, isSolid: true, interactive: true, interactionType: 'workspace', icon: '💻', layer: 1 },
    { id: 'obj_dev_chair_3', type: 'chair', name: 'Ergonomic Dev Chair 3', x: 932, y: 272, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_coffee_1', type: 'coffee_machine', name: 'Espresso Maker', x: 120, y: 700, width: 48, height: 48, rotation: 0, isSolid: true, interactive: true, interactionType: 'coffee', icon: '☕', layer: 1 },
    { id: 'obj_lounge_chair_1', type: 'chair', name: 'Tea Lounge Chair 1', x: 160, y: 760, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_lounge_chair_2', type: 'chair', name: 'Tea Lounge Chair 2', x: 240, y: 760, width: 32, height: 32, rotation: 0, isSolid: false, interactive: true, interactionType: 'chair', icon: '🪑', layer: 1 },
    { id: 'obj_plant_1', type: 'plant', name: 'Monstera Plant', x: 380, y: 680, width: 40, height: 40, rotation: 0, isSolid: false, icon: '🪴', layer: 2 }
  ]
};

const DEFAULT_OFFICES: Office[] = [
  {
    id: 'off_kochi_01',
    organizationId: 'org_acme_corp',
    name: 'Kochi Development HQ',
    description: 'Main engineering & executive virtual workspace for Acme Corp.',
    icon: '🌴',
    layout: DEFAULT_KOCHI_LAYOUT,
    allowedEmails: ['owner@acme.com', 'developer@metaverse.com'],
    createdBy: 'usr_acme_owner',
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now()
  },
  {
    id: 'off_nexus_01',
    organizationId: 'org_nexus_inc',
    name: 'Nexus Research Lab',
    description: 'R&D office space for Nexus Global Tech.',
    icon: '🚀',
    layout: {
      ...DEFAULT_KOCHI_LAYOUT,
      version: 1,
      dimensions: { width: 1400, height: 900, gridSize: 32 }
    },
    allowedEmails: ['developer@metaverse.com'],
    createdBy: 'usr_dev_superadmin',
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now()
  }
];

class StorageService {
  constructor() {
    this.init();
  }

  private init() {
    if (!localStorage.getItem(KEYS.ORGS)) {
      localStorage.setItem(KEYS.ORGS, JSON.stringify(DEFAULT_ORGANIZATIONS));
    }
    if (!localStorage.getItem(KEYS.USERS)) {
      localStorage.setItem(KEYS.USERS, JSON.stringify([DEFAULT_SUPER_ADMIN, DEFAULT_NISHAD_SUPER_ADMIN, DEFAULT_ACME_OWNER]));
    }
    if (!localStorage.getItem(KEYS.OFFICES)) {
      localStorage.setItem(KEYS.OFFICES, JSON.stringify(DEFAULT_OFFICES));
    }
  }

  getUsers(): UserProfile[] {
    return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
  }

  getCurrentUser(): UserProfile | null {
    const raw = localStorage.getItem(KEYS.CURRENT_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  setCurrentUser(user: UserProfile) {
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    syncUserToFirebase(user);
  }

  logout() {
    localStorage.removeItem(KEYS.CURRENT_USER);
  }

  authenticate(email: string): UserProfile | null {
    const users = this.getUsers();
    const clean = email.trim().toLowerCase();
    const isSuperAdminEmail = clean === 'nishadnisha2001@gmail.com' || clean === 'developer@metaverse.com';
    let found = users.find(u => u.email.toLowerCase() === clean);

    // If user is logging in with an email for the first time, auto-create their account!
    if (!found) {
      found = {
        id: 'usr_' + Math.random().toString(36).substr(2, 9),
        email: clean,
        fullName: isSuperAdminEmail ? 'Nishad (Platform Super Admin)' : extractNameFromEmail(clean),
        avatar: isSuperAdminEmail ? '👑' : '👨‍💻',
        color: isSuperAdminEmail ? '#ec4899' : '#3b82f6',
        role: isSuperAdminEmail ? 'Owner' : 'Employee',
        isSuperAdmin: isSuperAdminEmail,
        createdAt: Date.now()
      };
      this.addUser(found);
    } else if (isSuperAdminEmail) {
      found.isSuperAdmin = true;
      found.role = 'Owner';
      if (!found.avatar || found.avatar === '👨‍💻') found.avatar = '👑';
      this.addUser(found);
    }

    this.setCurrentUser(found);
    return found;
  }

  addUser(user: UserProfile) {
    const users = this.getUsers();
    const existingIdx = users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (existingIdx !== -1) {
      users[existingIdx] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
    syncUserToFirebase(user);
  }

  updateUserProfile(userId: string, updates: Partial<UserProfile>) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      Object.assign(users[idx], updates);
      localStorage.setItem(KEYS.USERS, JSON.stringify(users));
      const curr = this.getCurrentUser();
      if (curr && curr.id === userId) {
        this.setCurrentUser(users[idx]);
      }
    }
  }

  updateUserRole(userId: string, role: UserRoleName) {
    this.updateUserProfile(userId, { role });
  }

  getOrganizations(): Organization[] {
    return JSON.parse(localStorage.getItem(KEYS.ORGS) || '[]');
  }

  saveOrganization(org: Organization) {
    const orgs = this.getOrganizations();
    const idx = orgs.findIndex(o => o.id === org.id);
    if (idx !== -1) {
      orgs[idx] = org;
    } else {
      orgs.push(org);
    }
    localStorage.setItem(KEYS.ORGS, JSON.stringify(orgs));
  }

  deleteOrganization(id: string) {
    const orgs = this.getOrganizations().filter(o => o.id !== id);
    localStorage.setItem(KEYS.ORGS, JSON.stringify(orgs));

    const offices = this.getOffices().filter(o => o.organizationId !== id);
    localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
  }

  getOffices(): Office[] {
    return JSON.parse(localStorage.getItem(KEYS.OFFICES) || '[]');
  }

  isUserAllowedInOffice(user: UserProfile | null, office: Office): boolean {
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    if (office.createdBy === user.id) return true;
    
    // Check if email is directly in allowedEmails
    if (office.allowedEmails && office.allowedEmails.some(e => e.toLowerCase() === user.email.toLowerCase())) {
      return true;
    }

    // Check if user belongs to the office's organization
    if (user.organizationId && office.organizationId === user.organizationId) {
      return true;
    }

    return false;
  }

  getOfficesForUser(user: UserProfile | null): Office[] {
    if (!user) return [];
    const allOffices = this.getOffices();
    return allOffices.filter(office => this.isUserAllowedInOffice(user, office));
  }

  getOfficeById(id: string): Office | undefined {
    return this.getOffices().find(o => o.id === id);
  }

  saveOffice(office: Office) {
    const offices = this.getOffices();
    const idx = offices.findIndex(o => o.id === office.id);
    if (idx !== -1) {
      offices[idx] = office;
    } else {
      offices.push(office);
    }
    localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
  }

  saveOfficeLayout(officeId: string, layout: OfficeLayout) {
    const offices = this.getOffices();
    const office = offices.find(o => o.id === officeId);
    if (office) {
      office.layout = {
        ...layout,
        version: (office.layout.version || 1) + 1,
        updatedAt: Date.now()
      };
      office.updatedAt = Date.now();
      localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
    }
  }

  grantOfficeEmailAccess(officeId: string, email: string) {
    const offices = this.getOffices();
    const office = offices.find(o => o.id === officeId);
    if (office) {
      if (!office.allowedEmails) office.allowedEmails = [];
      const cleanEmail = email.trim().toLowerCase();
      if (!office.allowedEmails.includes(cleanEmail)) {
        office.allowedEmails.push(cleanEmail);
        localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
        syncOfficeAccessToFirebase(officeId, office.allowedEmails);
      }
    }
  }

  revokeOfficeEmailAccess(officeId: string, email: string) {
    const offices = this.getOffices();
    const office = offices.find(o => o.id === officeId);
    if (office && office.allowedEmails) {
      office.allowedEmails = office.allowedEmails.filter(e => e.toLowerCase() !== email.trim().toLowerCase());
      localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
      syncOfficeAccessToFirebase(officeId, office.allowedEmails);
    }
  }

  deleteOffice(id: string) {
    const offices = this.getOffices().filter(o => o.id !== id);
    localStorage.setItem(KEYS.OFFICES, JSON.stringify(offices));
  }

  getAuditLogs(): AuditLog[] {
    return JSON.parse(localStorage.getItem(KEYS.AUDIT) || '[]');
  }

  logAction(actorId: string, actorName: string, action: string, target: string) {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: 'log_' + Math.random().toString(36).substr(2, 9),
      organizationId: 'system',
      actorId,
      actorName,
      action,
      target,
      timestamp: Date.now()
    };
    logs.unshift(newLog);
    localStorage.setItem(KEYS.AUDIT, JSON.stringify(logs.slice(0, 100)));
  }
}

export const dbService = new StorageService();
