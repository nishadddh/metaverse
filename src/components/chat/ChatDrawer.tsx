import React, { useState, useEffect } from 'react';
import type { ChatMessage, UserProfile, PublicChannel } from '../../types/office';
import { realtimeService } from '../../services/presence';
import { 
  pushChatMessageToFirebase, 
  subscribeFirebaseChatMessages,
  pushChannelToFirebase,
  subscribeFirebaseChannels
} from '../../services/firebase';
import { 
  X, 
  Send, 
  MessageSquare, 
  Hash, 
  User, 
  Plus, 
  Users, 
  Search, 
  PictureInPicture, 
  Minimize2, 
  Maximize2, 
  CheckCircle2
} from 'lucide-react';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  officeId: string;
  currentRoomName?: string;
  allUsers: UserProfile[];
}

export interface PipChatWindow {
  id: string; // unique conversation key (e.g. 'channel_general' or 'direct_usr_123')
  title: string;
  avatar: string;
  scope: 'channel' | 'direct' | 'room';
  channelId?: string;
  recipientId?: string;
  recipientEmail?: string;
  isMinimized?: boolean;
}

const DEFAULT_CHANNELS: PublicChannel[] = [
  { id: 'general', officeId: 'default', name: 'general', description: 'General office wide discussion for everyone', createdBy: 'System', createdAt: 0, isDefault: true },
  { id: 'announcements', officeId: 'default', name: 'announcements', description: 'Official office updates & announcements', createdBy: 'System', createdAt: 1, isDefault: true },
  { id: 'tech-team', officeId: 'default', name: 'tech-team', description: 'Engineering, product & project chat', createdBy: 'System', createdAt: 2, isDefault: true },
  { id: 'watercooler', officeId: 'default', name: 'watercooler', description: 'Casual lounge chat & coffee break banter', createdBy: 'System', createdAt: 3, isDefault: true },
];

// LocalStorage Persistence Helpers
const getLocalChannels = (officeId: string): PublicChannel[] => {
  try {
    const raw = localStorage.getItem(`meta_channels_${officeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalChannel = (officeId: string, channel: PublicChannel) => {
  try {
    const existing = getLocalChannels(officeId);
    if (!existing.some(c => c.id === channel.id)) {
      const updated = [...existing, channel];
      localStorage.setItem(`meta_channels_${officeId}`, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('LocalStorage Channel Save Error:', e);
  }
};

const getLocalMessages = (officeId: string): ChatMessage[] => {
  try {
    const raw = localStorage.getItem(`meta_chats_${officeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const saveLocalMessage = (officeId: string, msg: ChatMessage) => {
  try {
    const existing = getLocalMessages(officeId);
    if (!existing.some(m => m.id === msg.id)) {
      const updated = [...existing, msg];
      localStorage.setItem(`meta_chats_${officeId}`, JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('LocalStorage Message Save Error:', e);
  }
};

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  officeId,
  currentRoomName,
  allUsers
}) => {
  // Channels state
  const [channels, setChannels] = useState<PublicChannel[]>(() => {
    const local = getLocalChannels(officeId);
    const merged = [...DEFAULT_CHANNELS];
    local.forEach(lc => {
      if (!merged.some(m => m.id === lc.id)) merged.push(lc);
    });
    return merged;
  });

  // Active selection in main drawer
  const [activeChatTarget, setActiveChatTarget] = useState<{
    type: 'channel' | 'direct' | 'room';
    id: string; // channelId or recipientUserId
  }>({ type: 'channel', id: 'general' });

  const [messages, setMessages] = useState<ChatMessage[]>(() => getLocalMessages(officeId));
  const [text, setText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Picture-in-Picture (PiP) Floating Windows state
  const [pipWindows, setPipWindows] = useState<PipChatWindow[]>([]);
  const [pipTexts, setPipTexts] = useState<{ [pipId: string]: string }>({});

  // New Channel Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newChannelName, setNewChannelName] = useState<string>('');
  const [newChannelDesc, setNewChannelDesc] = useState<string>('');
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // 1. Synchronize Public Channels with LocalStorage & Firebase RTDB
  useEffect(() => {
    const unsubChannels = subscribeFirebaseChannels(officeId, (remoteChannels) => {
      setChannels(prev => {
        const local = getLocalChannels(officeId);
        const map = new Map<string, PublicChannel>();
        DEFAULT_CHANNELS.forEach(c => map.set(c.id, c));
        local.forEach(c => map.set(c.id, c));
        prev.forEach(c => map.set(c.id, c));
        (remoteChannels || []).forEach(c => map.set(c.id, c));
        return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
      });
    });

    return () => unsubChannels();
  }, [officeId]);

  // 2. Filter Coworkers for Direct Messages:
  // Strictly EXCLUDE Developer & Owner accounts from DM recipient selection for normal users
  const officeMembersForDM = allUsers.filter(u => {
    if (u.id === currentUser.id) return false;
    const cleanEmail = (u.email || '').toLowerCase();
    const isDevOrOwner = cleanEmail === 'nishadnisha2001@gmail.com' || 
                         cleanEmail === 'developer@metaverse.com' || 
                         u.role === 'Owner';
    if (!currentUser.isSuperAdmin && currentUser.role !== 'Owner') {
      return !isDevOrOwner;
    }
    return true;
  });

  const selectedRecipientUser = activeChatTarget.type === 'direct'
    ? officeMembersForDM.find(u => u.id === activeChatTarget.id)
    : undefined;

  const activeChannelObj = activeChatTarget.type === 'channel'
    ? (channels.find(c => c.id === activeChatTarget.id) || DEFAULT_CHANNELS[0])
    : DEFAULT_CHANNELS[0];

  // 3. Subscribe & Merge Chat Messages from LocalStorage, Local Bus, & Firebase RTDB
  useEffect(() => {
    let scope: 'office' | 'room' | 'direct' | 'channel' = 'channel';
    let targetOther: string | undefined = undefined;
    let roomId: string | undefined = undefined;
    let channelId: string | undefined = undefined;

    if (activeChatTarget.type === 'room') {
      scope = 'room';
      roomId = currentRoomName;
    } else if (activeChatTarget.type === 'direct') {
      scope = 'direct';
      targetOther = selectedRecipientUser?.email || activeChatTarget.id;
    } else {
      scope = 'channel';
      channelId = activeChatTarget.id;
    }

    const unsubFirebase = subscribeFirebaseChatMessages(
      officeId,
      scope,
      currentUser.email || currentUser.id,
      targetOther,
      roomId,
      channelId,
      (remoteMsgs) => {
        if (remoteMsgs && remoteMsgs.length > 0) {
          remoteMsgs.forEach(m => saveLocalMessage(officeId, m));
          setMessages(prev => {
            const map = new Map<string, ChatMessage>();
            getLocalMessages(officeId).forEach(m => map.set(m.id, m));
            prev.forEach(m => map.set(m.id, m));
            remoteMsgs.forEach(m => map.set(m.id, m));
            return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      }
    );

    const unsubBus = realtimeService.subscribeChat((newMsg) => {
      saveLocalMessage(officeId, newMsg);
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    return () => {
      unsubFirebase();
      unsubBus();
    };
  }, [officeId, activeChatTarget, currentRoomName, currentUser.email, currentUser.id, selectedRecipientUser]);

  const showToast = (msg: string) => {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(null), 3000);
  };

  // Dispatch message helper
  const sendMessageToTarget = (
    content: string, 
    scope: 'channel' | 'direct' | 'room', 
    targetId: string, 
    recipientEmail?: string
  ) => {
    if (!content.trim()) return;

    const newMsg: ChatMessage = {
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
      officeId,
      scope,
      channelId: scope === 'channel' ? targetId : undefined,
      roomId: scope === 'room' ? currentRoomName : undefined,
      recipientId: scope === 'direct' ? targetId : undefined,
      recipientEmail: scope === 'direct' ? recipientEmail : undefined,
      senderId: currentUser.id,
      senderName: currentUser.fullName,
      senderEmail: currentUser.email,
      senderAvatar: currentUser.avatar,
      content: content.trim(),
      timestamp: Date.now()
    };

    saveLocalMessage(officeId, newMsg);
    setMessages(prev => [...prev, newMsg]);

    realtimeService.sendChatMessage(newMsg);
    pushChatMessageToFirebase(newMsg);
  };

  const handleMainSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    sendMessageToTarget(
      text,
      activeChatTarget.type,
      activeChatTarget.id,
      selectedRecipientUser?.email
    );
    setText('');
  };

  const handlePipSend = (e: React.FormEvent, pip: PipChatWindow) => {
    e.preventDefault();
    const inputVal = pipTexts[pip.id] || '';
    if (!inputVal.trim()) return;

    sendMessageToTarget(
      inputVal,
      pip.scope,
      pip.channelId || pip.recipientId || pip.id,
      pip.recipientEmail
    );

    setPipTexts(prev => ({ ...prev, [pip.id]: '' }));
  };

  // Create Channel
  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newChannelName.trim().toLowerCase().replace(/[^a-z0-9\-]/g, '-');
    if (!cleanName) return;

    const newChan: PublicChannel = {
      id: 'chan_' + cleanName + '_' + Math.random().toString(36).substr(2, 5),
      officeId,
      name: cleanName,
      description: newChannelDesc.trim() || 'Public group channel',
      createdBy: currentUser.fullName,
      createdAt: Date.now()
    };

    saveLocalChannel(officeId, newChan);
    setChannels(prev => {
      if (prev.some(c => c.id === newChan.id)) return prev;
      return [...prev, newChan];
    });

    setActiveChatTarget({ type: 'channel', id: newChan.id });
    pushChannelToFirebase(officeId, newChan);

    showToast(`Created public group #${cleanName}!`);
    setNewChannelName('');
    setNewChannelDesc('');
    setShowCreateModal(false);
  };

  // Open / Toggle PiP Floating Window
  const openPipWindow = (
    id: string, 
    title: string, 
    avatar: string, 
    scope: 'channel' | 'direct' | 'room',
    channelId?: string,
    recipientId?: string,
    recipientEmail?: string
  ) => {
    const pipKey = `${scope}_${id}`;
    setPipWindows(prev => {
      if (prev.some(p => p.id === pipKey)) {
        // Bring to front / restore if minimized
        return prev.map(p => p.id === pipKey ? { ...p, isMinimized: false } : p);
      }
      return [
        ...prev,
        {
          id: pipKey,
          title,
          avatar,
          scope,
          channelId,
          recipientId,
          recipientEmail,
          isMinimized: false
        }
      ];
    });
    showToast(`Popped out PiP chat for ${title}`);
  };

  const closePipWindow = (pipId: string) => {
    setPipWindows(prev => prev.filter(p => p.id !== pipId));
  };

  const toggleMinimizePip = (pipId: string) => {
    setPipWindows(prev => prev.map(p => p.id === pipId ? { ...p, isMinimized: !p.isMinimized } : p));
  };

  // Get latest message preview for any chat target
  const getLastMessagePreview = (scope: 'channel' | 'direct' | 'room', targetId: string) => {
    const matched = messages.filter(m => {
      if (scope === 'channel') return m.scope === 'channel' && m.channelId === targetId;
      if (scope === 'direct') {
        const u = officeMembersForDM.find(mem => mem.id === targetId);
        const email = u?.email;
        return m.scope === 'direct' && (
          (m.senderId === currentUser.id && (m.recipientId === targetId || m.recipientEmail === email)) ||
          (m.recipientId === currentUser.id && (m.senderId === targetId || m.senderEmail === email)) ||
          (m.senderEmail === currentUser.email && m.recipientEmail === email) ||
          (m.recipientEmail === currentUser.email && m.senderEmail === email)
        );
      }
      return m.scope === 'room';
    });

    if (matched.length === 0) return null;
    const last = matched[matched.length - 1];
    return {
      content: last.content,
      sender: last.senderId === currentUser.id ? 'You' : last.senderName,
      time: new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Filter messages for active chat in main drawer
  const activeMessages = messages.filter(m => {
    if (activeChatTarget.type === 'channel') {
      return (m.scope === 'channel' && m.channelId === activeChatTarget.id) || 
             (m.scope === 'office' && (activeChatTarget.id === 'general' || !m.channelId));
    }
    if (activeChatTarget.type === 'room') {
      return m.scope === 'room';
    }
    if (activeChatTarget.type === 'direct') {
      const u = officeMembersForDM.find(mem => mem.id === activeChatTarget.id);
      const email = u?.email;
      return m.scope === 'direct' && (
        (m.senderId === currentUser.id && (m.recipientId === activeChatTarget.id || m.recipientEmail === email)) ||
        (m.recipientId === currentUser.id && (m.senderId === activeChatTarget.id || m.senderEmail === email)) ||
        (m.senderEmail === currentUser.email && m.recipientEmail === email) ||
        (m.recipientEmail === currentUser.email && m.senderEmail === email)
      );
    }
    return true;
  });

  // Search filter for Group channels and Direct members lists
  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = officeMembersForDM.filter(u => 
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* 1. MAIN WHATSAPP STYLE CHAT DRAWER */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl border-l border-slate-800 bg-[#0f172a] shadow-2xl flex font-sans text-slate-100 animate-slide-left overflow-hidden">
          {/* SIDEBAR: CONVERSATION LIST (GROUPS ON TOP, MEMBERS ONE BY ONE BELOW) */}
          <div className="w-80 border-r border-slate-800/80 bg-[#0b1329] flex flex-col">
            {/* WhatsApp Top Profile Header */}
            <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{currentUser.avatar}</span>
                <div className="truncate">
                  <h3 className="text-xs font-bold text-white truncate">{currentUser.fullName}</h3>
                  <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Box */}
            <div className="p-2.5 border-b border-slate-800/60 bg-slate-950/40">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search groups or members..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* CONVERSATION SCROLL LIST */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 scrollbar-thin">
              {/* --- SECTION 1: PUBLIC GROUPS ON TOP --- */}
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3" /> Public Groups & Channels ({filteredChannels.length})
                  </span>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-600 hover:text-white transition"
                    title="Create New Public Group Channel"
                  >
                    <Plus className="w-3 h-3" /> New Group
                  </button>
                </div>

                <div className="space-y-1">
                  {filteredChannels.map(chan => {
                    const isSelected = activeChatTarget.type === 'channel' && activeChatTarget.id === chan.id;
                    const preview = getLastMessagePreview('channel', chan.id);
                    return (
                      <div
                        key={chan.id}
                        onClick={() => setActiveChatTarget({ type: 'channel', id: chan.id })}
                        className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                          isSelected 
                            ? 'bg-emerald-950/40 border border-emerald-500/30' 
                            : 'hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold shrink-0">
                            #
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-slate-100 truncate">#{chan.name}</h4>
                              {preview && (
                                <span className="text-[9px] text-slate-400 font-mono">{preview.time}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">
                              {preview ? `${preview.sender}: ${preview.content}` : (chan.description || 'Public group channel')}
                            </p>
                          </div>
                        </div>

                        {/* Quick PiP Popout Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPipWindow(chan.id, `#${chan.name}`, '#', 'channel', chan.id);
                          }}
                          className="ml-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition"
                          title="PiP Float Chat"
                        >
                          <PictureInPicture className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* --- SECTION 2: DIRECT MESSAGES / MEMBERS LISTED ONE BY ONE BELOW --- */}
              <div className="p-2 pt-3">
                <div className="px-2 py-1 mb-1">
                  <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3" /> Direct Office Members ({filteredMembers.length})
                  </span>
                </div>

                <div className="space-y-1">
                  {filteredMembers.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic p-2 text-center">
                      No other registered office members present yet.
                    </p>
                  ) : (
                    filteredMembers.map(mem => {
                      const isSelected = activeChatTarget.type === 'direct' && activeChatTarget.id === mem.id;
                      const preview = getLastMessagePreview('direct', mem.id);
                      return (
                        <div
                          key={mem.id}
                          onClick={() => setActiveChatTarget({ type: 'direct', id: mem.id })}
                          className={`group relative flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                            isSelected 
                              ? 'bg-blue-950/40 border border-blue-500/30' 
                              : 'hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="relative shrink-0">
                              <span className="text-xl">{mem.avatar}</span>
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-100 truncate">{mem.fullName}</h4>
                                {preview && (
                                  <span className="text-[9px] text-slate-400 font-mono">{preview.time}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">
                                {preview ? `${preview.sender}: ${preview.content}` : `${mem.role} • Personal Chat`}
                              </p>
                            </div>
                          </div>

                          {/* Quick PiP Popout Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPipWindow(mem.id, mem.fullName, mem.avatar, 'direct', undefined, mem.id, mem.email);
                            }}
                            className="ml-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition"
                            title="PiP Float Chat"
                          >
                            <PictureInPicture className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CHAT PANE: WHATSAPP ACTIVE CONVERSATION THREAD */}
          <div className="flex-1 flex flex-col bg-[#0b141a]">
            {/* Active Header */}
            <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {activeChatTarget.type === 'channel' 
                    ? '#' 
                    : activeChatTarget.type === 'direct' 
                      ? (selectedRecipientUser?.avatar || '👤')
                      : '🏢'
                  }
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {activeChatTarget.type === 'channel' && `#${activeChannelObj.name}`}
                    {activeChatTarget.type === 'direct' && (selectedRecipientUser?.fullName || 'Office Member')}
                    {activeChatTarget.type === 'room' && (currentRoomName || 'Current Zone')}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {activeChatTarget.type === 'channel' && (activeChannelObj.description || 'Public Group Channel')}
                    {activeChatTarget.type === 'direct' && `${selectedRecipientUser?.role || 'Member'} • Direct Personal Chat`}
                    {activeChatTarget.type === 'room' && 'Spatial Room Audio & Chat'}
                  </p>
                </div>
              </div>

              {/* Header PiP Button */}
              <button
                onClick={() => {
                  if (activeChatTarget.type === 'channel') {
                    openPipWindow(activeChannelObj.id, `#${activeChannelObj.name}`, '#', 'channel', activeChannelObj.id);
                  } else if (activeChatTarget.type === 'direct' && selectedRecipientUser) {
                    openPipWindow(selectedRecipientUser.id, selectedRecipientUser.fullName, selectedRecipientUser.avatar, 'direct', undefined, selectedRecipientUser.id, selectedRecipientUser.email);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600 hover:text-white transition"
              >
                <PictureInPicture className="w-4 h-4" /> PiP Popout
              </button>
            </div>

            {/* MESSAGES THREAD */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin bg-gradient-to-b from-[#0b141a] to-[#070d12]">
              {activeMessages.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-300 font-semibold">
                    {activeChatTarget.type === 'channel' && `Welcome to #${activeChannelObj.name}`}
                    {activeChatTarget.type === 'direct' && (selectedRecipientUser ? `Start private conversation with ${selectedRecipientUser.fullName}` : 'Select a member to chat')}
                    {activeChatTarget.type === 'room' && `No room messages in ${currentRoomName || 'Current Zone'}`}
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    Type a message below to start chatting. All messages are stored in real-time.
                  </p>
                </div>
              ) : (
                activeMessages.map(m => {
                  const isMe = m.senderId === currentUser.id;
                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                        <span>{m.senderAvatar}</span>
                        <span className="font-semibold text-slate-300">{m.senderName}</span>
                        <span>• {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs leading-relaxed shadow-lg ${
                        isMe 
                          ? 'bg-emerald-700 text-white rounded-tr-none border border-emerald-600/40' 
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60'
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* MESSAGE INPUT FORM */}
            <form onSubmit={handleMainSend} className="p-3 border-t border-slate-800/80 bg-slate-900/90 flex gap-2">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={
                  activeChatTarget.type === 'channel'
                    ? `Message #${activeChannelObj.name}...`
                    : activeChatTarget.type === 'direct'
                      ? `Message ${selectedRecipientUser?.fullName || 'Member'}...`
                      : 'Message room...'
                }
                className="flex-1 rounded-xl border border-slate-700/80 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. FLOATING PICTURE-IN-PICTURE (PiP) CHAT WINDOWS */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-wrap gap-4 items-end pointer-events-none">
        {pipWindows.map(pip => {
          const pipMessages = messages.filter(m => {
            if (pip.scope === 'channel') return m.scope === 'channel' && m.channelId === pip.channelId;
            if (pip.scope === 'direct') {
              const u = officeMembersForDM.find(mem => mem.id === pip.recipientId);
              const email = u?.email || pip.recipientEmail;
              return m.scope === 'direct' && (
                (m.senderId === currentUser.id && (m.recipientId === pip.recipientId || m.recipientEmail === email)) ||
                (m.recipientId === currentUser.id && (m.senderId === pip.recipientId || m.senderEmail === email)) ||
                (m.senderEmail === currentUser.email && m.recipientEmail === email) ||
                (m.recipientEmail === currentUser.email && m.senderEmail === email)
              );
            }
            return m.scope === 'room';
          });

          if (pip.isMinimized) {
            return (
              <div
                key={pip.id}
                onClick={() => toggleMinimizePip(pip.id)}
                className="pointer-events-auto cursor-pointer flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-slate-900/95 px-3 py-2 text-xs font-bold text-emerald-300 shadow-2xl backdrop-blur-xl hover:bg-slate-800 transition animate-bounce"
              >
                <span>{pip.avatar}</span>
                <span>{pip.title}</span>
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            );
          }

          return (
            <div
              key={pip.id}
              className="pointer-events-auto w-80 h-96 rounded-2xl border border-emerald-500/40 bg-slate-900/95 shadow-2xl backdrop-blur-2xl flex flex-col font-sans text-slate-100 overflow-hidden animate-slide-up"
            >
              {/* PiP Card Header */}
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-base">{pip.avatar}</span>
                  <span className="text-xs font-bold text-white truncate">{pip.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleMinimizePip(pip.id)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    title="Minimize PiP"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => closePipWindow(pip.id)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    title="Close PiP"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* PiP Card Message Thread */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs scrollbar-thin bg-slate-950/40">
                {pipMessages.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic text-center py-8">
                    No PiP messages yet. Start typing below!
                  </p>
                ) : (
                  pipMessages.map(m => {
                    const isMe = m.senderId === currentUser.id;
                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[9px] text-slate-400 mb-0.5">{m.senderName}</span>
                        <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[11px] ${
                          isMe ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none'
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* PiP Card Input Form */}
              <form onSubmit={(e) => handlePipSend(e, pip)} className="p-2 border-t border-slate-800 bg-slate-950 flex gap-1.5">
                <input
                  type="text"
                  value={pipTexts[pip.id] || ''}
                  onChange={e => setPipTexts(prev => ({ ...prev, [pip.id]: e.target.value }))}
                  placeholder={`Reply to ${pip.title}...`}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {/* TOAST NOTICE */}
      {toastNotice && (
        <div className="fixed top-20 right-6 z-50 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-2 text-xs font-semibold text-emerald-300 shadow-2xl backdrop-blur-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {toastNotice}
        </div>
      )}

      {/* CREATE NEW PUBLIC CHANNEL MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-emerald-400" /> Create Public Group Channel
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateChannel} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Group Channel Name</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">#</span>
                  <input
                    type="text"
                    required
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    placeholder="marketing, design-squad, qa-bugs"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-7 pr-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  placeholder="What is this public group about?"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/30"
                >
                  Create Public Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
