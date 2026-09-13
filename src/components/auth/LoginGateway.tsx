import React, { useState } from 'react';
import type { UserProfile } from '../../types/office';
import { dbService, extractNameFromEmail } from '../../services/database';
import { loginWithFirebase } from '../../services/firebase';
import { 
  Lock, 
  Mail, 
  User, 
  ShieldAlert, 
  Upload, 
  Sparkles,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface LoginGatewayProps {
  onLoginSuccess: (user: UserProfile) => void;
}

const AVATAR_OPTIONS = [
  '👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '👨‍🔬', '👩‍🔬', '🧙‍♂️', '🦸‍♀️', 
  '🦊', '🦁', '🐼', '🤖', '👾', '🚀', '⭐', '☕'
];

export const LoginGateway: React.FC<LoginGatewayProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatar, setAvatar] = useState('👨‍💻');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!fullName || mode === 'register') {
      const derived = extractNameFromEmail(val);
      if (derived) setFullName(derived);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAvatarUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email) return;
    setLoading(true);

    try {
      const user = await loginWithFirebase(email, password || '123456');
      dbService.addUser(user);
      dbService.setCurrentUser(user);
      dbService.logAction(user.id, user.fullName, 'FIREBASE_LOGIN', `Authenticated via Firebase for ${user.email}`);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Firebase login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email) return;
    setLoading(true);

    try {
      const user = await loginWithFirebase(email, password || '123456');
      if (fullName && !user.isSuperAdmin) {
        user.fullName = fullName;
      }
      if (avatarUrl) {
        user.avatarUrl = avatarUrl;
      }
      user.avatar = avatar;

      dbService.addUser(user);
      dbService.setCurrentUser(user);
      dbService.logAction(user.id, user.fullName, 'FIREBASE_REGISTER', `Registered via Firebase for ${user.email}`);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Firebase registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-2xl shadow-xl shadow-blue-500/20 mb-2">
            N
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            Nishad Metaverse
            <Sparkles className="w-5 h-5 text-amber-400" />
          </h1>
          <p className="text-xs text-slate-400">
            Mandatory Security Gateway • Enter your registered email ID to unlock office spaces.
          </p>
        </div>



        {/* Tab Toggle */}
        <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            Sign In with Email
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'register' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
          >
            Register Account
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/50 bg-red-950/80 p-3 text-xs text-red-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> Registered Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                placeholder="e.g. john.doe@gmail.com"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-400" /> Account Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-bold text-white hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating via Firebase...' : 'Log In & Access Registered Offices'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                placeholder="e.g. alex.smith@gmail.com"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-blue-400" /> Full Name (Extracted from Email)
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Alex Smith"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-400" /> Choose Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Create password"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Custom Avatar Upload */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Profile Photo / Avatar Image (Optional Upload)
              </label>
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Uploaded Avatar" className="h-12 w-12 rounded-full object-cover border-2 border-blue-500 shadow-md" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">
                    {avatar}
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition">
                  <Upload className="w-4 h-4 text-blue-400" /> Choose File
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Or Choose Emoji Icon</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {AVATAR_OPTIONS.map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => { setAvatar(av); setAvatarUrl(undefined); }}
                    className={`h-8 w-8 rounded-lg border text-base flex items-center justify-center transition ${
                      avatar === av && !avatarUrl ? 'border-blue-500 bg-blue-500/20 scale-105' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-xs font-bold text-white hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Registering via Firebase...' : 'Register & Sign In'} <CheckCircle2 className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>

      {/* Subtle Support Contact Footer */}
      <div className="text-center text-xs text-slate-500 font-sans mt-4">
        Login issue? Contact: <span className="font-mono text-slate-400 font-semibold">nishadnisha2001@gmail.com</span>
      </div>
    </div>
  );
};
