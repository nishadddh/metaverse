import React, { useState } from 'react';
import type { UserProfile, Organization, Office } from '../../types/office';
import { dbService } from '../../services/database';
import { 
  ShieldAlert, 
  Building2, 
  Users, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  History, 
  CheckCircle2
} from 'lucide-react';

interface SuperAdminPortalProps {
  currentUser: UserProfile;
  onBackToDashboard: () => void;
  onRefreshData: () => void;
}

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  currentUser,
  onBackToDashboard,
  onRefreshData
}) => {
  const [orgs, setOrgs] = useState<Organization[]>(dbService.getOrganizations());
  const [offices, setOffices] = useState<Office[]>(dbService.getOffices());
  const [users, setUsers] = useState<UserProfile[]>(dbService.getUsers());
  const [logs] = useState(dbService.getAuditLogs());

  // Create Company Form
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !ownerEmail) return;

    const newOrg: Organization = {
      id: 'org_' + Math.random().toString(36).substr(2, 9),
      name: orgName,
      slug: orgName.toLowerCase().replace(/\s+/g, '-'),
      logoUrl: '🏢',
      ownerId: 'usr_' + Math.random().toString(36).substr(2, 9),
      ownerEmail: ownerEmail.trim().toLowerCase(),
      createdAt: Date.now()
    };

    dbService.saveOrganization(newOrg);

    // Auto-create owner user profile if doesn't exist
    const existingUser = users.find(u => u.email.toLowerCase() === ownerEmail.toLowerCase());
    if (!existingUser) {
      const ownerProfile: UserProfile = {
        id: newOrg.ownerId,
        email: ownerEmail.trim().toLowerCase(),
        password: '123',
        fullName: orgName + ' Owner',
        avatar: '👨‍💼',
        color: '#3b82f6',
        role: 'Owner',
        organizationId: newOrg.id,
        createdAt: Date.now()
      };
      dbService.addUser(ownerProfile);
    }

    dbService.logAction(currentUser.id, currentUser.fullName, 'PLATFORM_CREATE_ORG', `Developer created organization ${newOrg.name} for owner ${ownerEmail}`);
    
    setOrgs(dbService.getOrganizations());
    setUsers(dbService.getUsers());
    setShowCreateOrg(false);
    setOrgName('');
    setOwnerEmail('');
    onRefreshData();
  };

  const handleDeleteCompany = (id: string, name: string) => {
    if (confirm(`Platform Admin Action: Are you sure you want to delete customer company "${name}"?`)) {
      dbService.deleteOrganization(id);
      dbService.logAction(currentUser.id, currentUser.fullName, 'PLATFORM_DELETE_ORG', `Deleted organization ${name}`);
      setOrgs(dbService.getOrganizations());
      setOffices(dbService.getOffices());
      onRefreshData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8 font-sans">
      {/* Top Console Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-pink-500/30 pb-6 bg-gradient-to-r from-pink-950/20 via-slate-900 to-slate-950 p-6 rounded-3xl border">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToDashboard}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-pink-400" />
              <h1 className="text-2xl font-black text-white tracking-tight">Developer & System Admin Console</h1>
            </div>
            <p className="text-xs text-pink-300/80">Manage Customer Companies, Multi-tenant Workspaces & Platform Access</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateOrg(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-pink-500 shadow-lg shadow-pink-600/30 transition"
        >
          <Plus className="w-4 h-4" /> Provision New Company
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Customer Companies</span>
            <Building2 className="w-5 h-5 text-pink-400" />
          </div>
          <p className="mt-3 text-3xl font-black text-white">{orgs.length}</p>
          <p className="text-[11px] text-pink-400 mt-1">Multi-tenant Segregated</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Virtual Offices</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="mt-3 text-3xl font-black text-white">{offices.length}</p>
          <p className="text-[11px] text-emerald-400 mt-1">Global Active Spaces</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Registered Platform Accounts</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="mt-3 text-3xl font-black text-white">{users.length}</p>
          <p className="text-[11px] text-indigo-400 mt-1">Real Email Profiles</p>
        </div>
      </div>

      {/* Customer Companies Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-pink-400" /> Customer Organizations (Companies)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 font-semibold uppercase">
              <tr>
                <th className="pb-3">COMPANY NAME</th>
                <th className="pb-3">ORGANIZATION ID</th>
                <th className="pb-3">ASSIGNED OWNER EMAIL</th>
                <th className="pb-3">OFFICES</th>
                <th className="pb-3 text-right">DEVELOPER ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {orgs.map(o => {
                const companyOffices = offices.filter(off => off.organizationId === o.id);
                return (
                  <tr key={o.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 font-bold text-slate-100 flex items-center gap-2">
                      <span>{o.logoUrl || '🏢'}</span> {o.name}
                    </td>
                    <td className="py-3 text-slate-400 font-mono">{o.id}</td>
                    <td className="py-3 text-pink-300 font-mono">{o.ownerEmail || 'admin@company.com'}</td>
                    <td className="py-3 text-slate-300">{companyOffices.length} Spaces</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDeleteCompany(o.id, o.name)}
                        className="text-slate-500 hover:text-red-400 p-1.5 transition"
                        title="Delete Organization"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Security Audit Stream */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" /> Platform Security & Audit Event Stream
        </h2>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {logs.map(log => (
            <div key={log.id} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-pink-400">{log.actorName}</span>
                <span className="text-slate-400 ml-2 font-mono">[{log.action}]</span>
                <p className="text-slate-300 mt-0.5">{log.target}</p>
              </div>
              <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Create Company Modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl border border-pink-500/40 bg-slate-900 p-6 text-slate-100 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Provision New Customer Company</h3>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Company / Organization Name</label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Tech Solutions"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Assign Owner Email Address</label>
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={e => setOwnerEmail(e.target.value)}
                  placeholder="owner@acmetech.com"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateOrg(false)}
                  className="w-1/2 rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 rounded-lg bg-pink-600 py-2 text-xs font-semibold text-white hover:bg-pink-500 shadow-lg shadow-pink-600/30"
                >
                  Provision Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
