import React from 'react';
import type { UserProfile } from '../../types/office';
import { Shield, Building, LogOut } from 'lucide-react';

interface HeaderProps {
  currentUser: UserProfile;
  onOpenAuth: () => void;
  activeView: 'dashboard' | 'office' | 'builder' | 'superadmin';
  onNavigateDashboard: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuth,
  activeView,
  onNavigateDashboard,
  onLogout
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl px-6 flex items-center justify-between font-sans text-slate-100 sticky top-0 z-40">
      <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigateDashboard}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-lg shadow-lg shadow-blue-500/20">
          V
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
            Antigravity Virtual Office <span className="text-[10px] rounded-md bg-blue-500/20 px-2 py-0.5 text-blue-400 font-bold uppercase">SaaS Enterprise</span>
          </h1>
          <p className="text-[10px] text-slate-400">Spatial Workspace • Proximity Communication</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {activeView !== 'dashboard' && (
          <button
            onClick={onNavigateDashboard}
            className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
          >
            <Building className="w-4 h-4 text-blue-400" /> Dashboard
          </button>
        )}

        <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-1.5 hover:border-slate-700 transition"
          >
            <span className="text-xl">{currentUser.avatar}</span>
            <div className="text-left text-xs">
              <p className="font-semibold text-slate-200">{currentUser.fullName}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-400" /> {currentUser.role}
              </p>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition"
            title="Log Out / Switch Account"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
