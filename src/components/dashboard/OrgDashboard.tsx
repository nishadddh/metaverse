import React, { useState } from 'react';
import type { Office, UserProfile, UserRoleName } from '../../types/office';
import { dbService } from '../../services/database';
import { 
  Building2, 
  Users, 
  Plus, 
  ShieldCheck, 
  Edit3, 
  Trash2, 
  ArrowRight, 
  History,
  Lock,
  Mail,
  UserPlus,
  X,
  ShieldAlert
} from 'lucide-react';

interface OrgDashboardProps {
  currentUser: UserProfile;
  offices: Office[];
  onSelectOffice: (office: Office) => void;
  onOpenBuilder: (office: Office) => void;
  onOpenSuperAdmin: () => void;
  onRefreshData: () => void;
}

export const OrgDashboard: React.FC<OrgDashboardProps> = ({
  currentUser,
  offices,
  onSelectOffice,
  onOpenBuilder,
  onOpenSuperAdmin,
  onRefreshData
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOfficeName, setNewOfficeName] = useState('');
  const [newOfficeDesc, setNewOfficeDesc] = useState('');

  const [selectedOfficeForPermission, setSelectedOfficeForPermission] = useState<Office | null>(null);
  const [grantEmailInput, setGrantEmailInput] = useState('');

  const usersList = dbService.getUsers();
  const auditLogs = dbService.getAuditLogs();
  const isOwner = currentUser.role === 'Owner';
  const isBuilder = currentUser.role === 'Owner' || currentUser.role === 'Office Builder';

  const handleCreateOffice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOfficeName) return;

    const orgs = dbService.getOrganizations();
    const newOffice: Office = {
      id: 'off_' + Math.random().toString(36).substr(2, 9),
      organizationId: currentUser.organizationId || orgs[0]?.id || 'org_acme_corp',
      name: newOfficeName,
      description: newOfficeDesc || 'Custom virtual workspace layout.',
      icon: '🏢',
      allowedEmails: [currentUser.email.toLowerCase()],
      layout: {
        version: 1,
        updatedAt: Date.now(),
        updatedBy: currentUser.id,
        dimensions: { width: 1600, height: 1000, gridSize: 32 },
        backgroundColor: '#0f172a',
        walls: [
          { x1: 64, y1: 64, x2: 1536, y2: 64 },
          { x1: 1536, y1: 64, x2: 1536, y2: 936 },
          { x1: 1536, y1: 936, x2: 64, y2: 936 },
          { x1: 64, y1: 936, x2: 64, y2: 64 }
        ],
        rooms: [],
        doors: [],
        objects: []
      },
      createdBy: currentUser.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    dbService.saveOffice(newOffice);
    dbService.logAction(currentUser.id, currentUser.fullName, 'CREATE_OFFICE', `Created office ${newOffice.name}`);
    onRefreshData();
    setShowCreateModal(false);
    setNewOfficeName('');
  };

  const handleGrantEmailAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficeForPermission || !grantEmailInput) return;

    dbService.grantOfficeEmailAccess(selectedOfficeForPermission.id, grantEmailInput);
    dbService.logAction(currentUser.id, currentUser.fullName, 'GRANT_EMAIL_ACCESS', `Granted office access to email ${grantEmailInput} for ${selectedOfficeForPermission.name}`);
    
    setGrantEmailInput('');
    onRefreshData();
    const refreshed = dbService.getOfficeById(selectedOfficeForPermission.id);
    if (refreshed) setSelectedOfficeForPermission(refreshed);
  };

  const handleRevokeEmailAccess = (officeId: string, email: string) => {
    dbService.revokeOfficeEmailAccess(officeId, email);
    dbService.logAction(currentUser.id, currentUser.fullName, 'REVOKE_EMAIL_ACCESS', `Revoked office access for email ${email}`);
    onRefreshData();
    const refreshed = dbService.getOfficeById(officeId);
    if (refreshed) setSelectedOfficeForPermission(refreshed);
  };

  const handleRoleChange = (targetUserId: string, newRole: UserRoleName) => {
    if (!isOwner) return;
    dbService.updateUserRole(targetUserId, newRole);
    dbService.logAction(currentUser.id, currentUser.fullName, 'ROLE_CHANGE', `Updated role of user ${targetUserId} to ${newRole}`);
    onRefreshData();
  };

  const handleDeleteOffice = (officeId: string, name: string) => {
    if (!isOwner) return;
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      dbService.deleteOffice(officeId);
      dbService.logAction(currentUser.id, currentUser.fullName, 'DELETE_OFFICE', `Deleted office ${name}`);
      onRefreshData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏢</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Acme Metaverse Corp
                {currentUser.isSuperAdmin && (
                  <span className="text-[11px] rounded-full bg-pink-500/20 px-2.5 py-0.5 font-bold text-pink-400 border border-pink-500/30">
                    SUPER ADMIN VIEW
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">Multi-tenant Isolation • Email-based Access Guard</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentUser.isSuperAdmin && (
            <button
              onClick={onOpenSuperAdmin}
              className="inline-flex items-center gap-2 rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-2.5 text-xs font-bold text-pink-300 hover:bg-pink-500/20 transition"
            >
              <ShieldAlert className="w-4 h-4 text-pink-400" /> Platform Developer Console
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition"
            >
              <Plus className="w-4 h-4" /> Create Virtual Office
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Accessible Offices</span>
            <Building2 className="w-5 h-5 text-blue-400" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{offices.length}</p>
          <p className="text-[11px] text-emerald-400 mt-1">Filtered by Email Access</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Logged In Account</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="mt-3 text-sm font-bold text-white truncate">{currentUser.email}</p>
          <p className="text-[11px] text-indigo-400 mt-1">{currentUser.fullName}</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Active Role</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="mt-3 text-2xl font-bold text-white">{currentUser.role}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {isOwner ? 'Full Workspace Governance' : 'Standard Member'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Email Security Guard</span>
            <Mail className="w-5 h-5 text-sky-400" />
          </div>
          <p className="mt-3 text-2xl font-bold text-sky-300">Enforced</p>
          <p className="text-[11px] text-slate-400 mt-1">Explicit Email Whitelisting</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" /> Virtual Office Workspaces
          </h2>
        </div>

        {offices.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 md:p-12 text-center space-y-4 max-w-xl mx-auto my-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 mx-auto text-3xl">
              🔒
            </div>
            <h3 className="text-xl font-bold text-white">No Office Assigned to Your Account</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              There are currently no virtual offices registered for your email address (<span className="font-mono font-bold text-amber-300">{currentUser.email}</span>).
            </p>
            <p className="text-xs text-slate-400">
              Please contact your workspace manager or company administrator to add your email address to the authorized access list.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
              {isOwner && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create Virtual Office
                </button>
              )}
              <button
                onClick={onRefreshData}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                Refresh Office List
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {offices.map(off => (
              <div 
                key={off.id}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-xl hover:border-slate-700 transition space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2 rounded-xl bg-slate-800/80">{off.icon}</span>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition">{off.name}</h3>
                      <p className="text-xs text-slate-400">{off.description}</p>
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleDeleteOffice(off.id, off.name)}
                      className="text-slate-500 hover:text-red-400 p-1 transition"
                      title="Delete Office"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-400" /> Authorized Email Access List
                    </span>
                    {isOwner && (
                      <button
                        onClick={() => setSelectedOfficeForPermission(off)}
                        className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Manage Emails
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {off.allowedEmails && off.allowedEmails.length > 0 ? (
                      off.allowedEmails.map(em => (
                        <span key={em} className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-mono">
                          {em}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-slate-500 italic">No emails explicitly granted yet.</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => onSelectOffice(off)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 transition shadow-md shadow-blue-600/20"
                  >
                    Enter Office <ArrowRight className="w-4 h-4" />
                  </button>

                  {isBuilder ? (
                    <button
                      onClick={() => onOpenBuilder(off)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                    >
                      <Edit3 className="w-4 h-4 text-amber-400" /> Edit Layout
                    </button>
                  ) : (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> View Only
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Registered Accounts
            </h2>
            <span className="text-xs text-slate-400">
              {isOwner ? '⚡ You can update member roles' : 'Registered Users'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 font-medium">
                <tr>
                  <th className="pb-3">MEMBER</th>
                  <th className="pb-3">EMAIL ADDRESS</th>
                  <th className="pb-3">ROLE</th>
                  <th className="pb-3 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usersList.map(m => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 flex items-center gap-2.5">
                      <span className="text-lg">{m.avatar}</span>
                      <span className="font-semibold text-slate-100">{m.fullName}</span>
                    </td>
                    <td className="py-3 text-slate-300 font-mono">{m.email}</td>
                    <td className="py-3">
                      {isOwner && m.id !== currentUser.id ? (
                        <select
                          value={m.role}
                          onChange={e => handleRoleChange(m.id, e.target.value as UserRoleName)}
                          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="Owner">Owner</option>
                          <option value="Office Builder">Office Builder</option>
                          <option value="Manager">Manager</option>
                          <option value="Employee">Employee</option>
                          <option value="Guest">Guest</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                          m.role === 'Owner' ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
                          m.role === 'Office Builder' ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' :
                          m.role === 'Manager' ? 'border-purple-500/40 bg-purple-500/10 text-purple-300' :
                          'border-slate-700 bg-slate-800 text-slate-300'
                        }`}>
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <span className="text-emerald-400 font-mono text-[10px]">ACTIVE</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" /> Audit Log Stream
          </h2>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {auditLogs.map(log => (
              <div key={log.id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold text-blue-400">{log.actorName}</span>
                  <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="text-slate-200 font-medium">{log.action}</p>
                <p className="text-[11px] text-slate-400">{log.target}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedOfficeForPermission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Email Access Controls: {selectedOfficeForPermission.name}</h3>
              <button onClick={() => setSelectedOfficeForPermission(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGrantEmailAccess} className="flex gap-2">
              <input
                type="email"
                required
                value={grantEmailInput}
                onChange={e => setGrantEmailInput(e.target.value)}
                placeholder="user@gmail.com or employee@company.com"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
              >
                Grant Access
              </button>
            </form>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase">Currently Permitted Email Accounts</label>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {selectedOfficeForPermission.allowedEmails?.map(em => (
                  <div key={em} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                    <span>{em}</span>
                    <button
                      onClick={() => handleRevokeEmailAccess(selectedOfficeForPermission.id, em)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold">Create Virtual Office</h3>
            <form onSubmit={handleCreateOffice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Office Name</label>
                <input
                  type="text"
                  required
                  value={newOfficeName}
                  onChange={e => setNewOfficeName(e.target.value)}
                  placeholder="e.g. Bangalore Tech Hub"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <input
                  type="text"
                  value={newOfficeDesc}
                  onChange={e => setNewOfficeDesc(e.target.value)}
                  placeholder="e.g. R&D office space for engineering teams"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
