import React, { useState } from 'react';
import type { UserProfile } from '../../types/office';
import { dbService, extractNameFromEmail } from '../../services/database';
import { User, X, Mail, Lock, Upload, Image as ImageIcon } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout?: () => void;
}

const AVATAR_OPTIONS = [
  '👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '👨‍🔬', '👩‍🔬', '🧙‍♂️', '🦸‍♀️', 
  '🦊', '🦁', '🐼', '🤖', '👾', '🚀', '⭐', '☕'
];

const COLOR_OPTIONS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#64748b'
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'profile'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [avatar, setAvatar] = useState(currentUser.avatar || '👨‍💻');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatarUrl);
  const [color, setColor] = useState(currentUser.color || '#3b82f6');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto extract name when typing email
  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!fullName || mode === 'register') {
      const derived = extractNameFromEmail(val);
      if (derived) setFullName(derived);
    }
  };

  // Image Upload handler (convert file to base64 Data URL)
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const user = dbService.authenticate(email);
    if (user) {
      dbService.logAction(user.id, user.fullName, 'AUTHENTICATE', `Logged in via email ${user.email}`);
      onLoginSuccess(user);
      onClose();
    } else {
      setErrorMsg('No registered account found with this email. Please sign up first or check your email ID!');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email) return;

    const derivedName = fullName.trim() || extractNameFromEmail(email);

    const newUser: UserProfile = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      email: email.trim().toLowerCase(),
      password: password || '123',
      fullName: derivedName,
      avatar,
      avatarUrl,
      color,
      role: 'Employee',
      createdAt: Date.now()
    };

    dbService.addUser(newUser);
    dbService.setCurrentUser(newUser);
    dbService.logAction(newUser.id, newUser.fullName, 'REGISTER', `Registered real user account for ${newUser.email}`);
    onLoginSuccess(newUser);
    onClose();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    dbService.updateUserProfile(currentUser.id, {
      fullName,
      avatar,
      avatarUrl,
      color
    });
    dbService.logAction(currentUser.id, fullName, 'UPDATE_PROFILE', 'Updated profile picture & identity');
    const updated = dbService.getCurrentUser();
    if (updated) {
      onLoginSuccess(updated);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-700/60 bg-slate-900/95 p-6 text-slate-100 shadow-2xl backdrop-blur-xl space-y-5">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">Email Identity & Custom Avatar</h2>
            <p className="text-xs text-slate-400">Automatic first-name extraction from Email ID + Manual Photo Upload.</p>
          </div>
        </div>



        {/* Tab Toggle */}
        <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            Log In with Email
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            Register New Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('profile'); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-lg font-bold transition ${mode === 'profile' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
          >
            My Profile
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/50 bg-red-950/80 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                placeholder="user@gmail.com or employee@company.com"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-blue-400" /> Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition"
            >
              Sign In to Virtual Workspace
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-semibold text-slate-300">Email Address (Gmail / Company Email)</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                placeholder="john.doe@gmail.com"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Full Name (Auto-Extracted from Email)</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Choose password"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Manual Image Avatar Upload */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              <label className="text-xs font-semibold text-slate-300 block">
                Manual Profile Photo / Image Upload (Optional)
              </label>
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-12 w-12 rounded-full object-cover border-2 border-blue-500" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl">
                    {avatar}
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition">
                  <Upload className="w-4 h-4 text-blue-400" /> Upload Image File
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Or Select Avatar Emoji Icon</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {AVATAR_OPTIONS.map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => { setAvatar(av); setAvatarUrl(undefined); }}
                    className={`h-9 w-9 rounded-lg border text-lg flex items-center justify-center transition ${
                      avatar === av && !avatarUrl ? 'border-blue-500 bg-blue-500/20 scale-105' : 'border-slate-800 bg-slate-900'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition"
            >
              Register & Sign In
            </button>
          </form>
        )}

        {mode === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Display Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Upload Custom Profile Photo</label>
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-14 w-14 rounded-full object-cover border-2 border-blue-500" />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                    {avatar}
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition">
                  <ImageIcon className="w-4 h-4 text-blue-400" /> Upload Photo File
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Color Palette</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{ backgroundColor: c }}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      color === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition"
              >
                Save Profile Updates
              </button>

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-2.5 text-xs font-bold text-red-300 hover:bg-red-900/40 transition"
                >
                  Log Out
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
