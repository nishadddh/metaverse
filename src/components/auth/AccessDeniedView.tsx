import React from 'react';
import type { Office, UserProfile } from '../../types/office';
import { 
  Lock, 
  ArrowLeft, 
  UserCheck, 
  Mail, 
  Building2, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface AccessDeniedViewProps {
  office: Office;
  currentUser: UserProfile;
  onSwitchAccount: () => void;
  onGoDashboard: () => void;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  office,
  currentUser,
  onSwitchAccount,
  onGoDashboard
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Glow Orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative w-full max-w-xl rounded-3xl border border-red-500/30 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-2xl space-y-6">
        <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30 shrink-0">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Access Denied: Unregistered Office Access
              <span className="text-[10px] rounded-md bg-red-500/20 px-2 py-0.5 text-red-400 font-bold uppercase border border-red-500/30">
                Restricted Space
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              You are not registered to enter this specific virtual office space.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5 space-y-3">
          <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-400" /> Target Virtual Office
            </span>
            <span className="font-bold text-white flex items-center gap-1">
              <span className="text-lg">{office.icon}</span> {office.name}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-amber-400" /> Your Current Email Account
            </span>
            <span className="font-mono font-bold text-amber-300">
              {currentUser.email}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-400" /> Current Role
            </span>
            <span className="font-semibold text-slate-200">
              {currentUser.role}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2 text-xs text-amber-200">
          <p className="font-bold flex items-center gap-1.5 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Why are you seeing this?
          </p>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Each virtual office requires users to be registered or explicitly granted access by the office owner. Your email address (<span className="font-mono font-bold text-amber-300">{currentUser.email}</span>) is not present in the allowed email whitelist for <span className="font-semibold text-white">{office.name}</span>.
          </p>
          {office.allowedEmails && office.allowedEmails.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                Authorized Emails for this Office:
              </span>
              <div className="flex flex-wrap gap-1">
                {office.allowedEmails.map(em => (
                  <span key={em} className="rounded bg-slate-900 border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                    {em}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={onSwitchAccount}
            className="flex-1 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Switch Email / Log In with Registered Account
          </button>
          
          <button
            onClick={onGoDashboard}
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
