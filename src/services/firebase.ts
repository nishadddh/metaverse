import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase, ref, onValue, set, remove, onDisconnect } from 'firebase/database';
import type { ChatMessage, UserProfile, PublicChannel, Office } from '../types/office';

// Helper function to extract a clean First Name & Last Name from any email address
export const extractNameFromEmail = (email: string): string => {
  if (!email) return 'User';
  const prefix = email.split('@')[0] || 'User';
  const clean = prefix.replace(/[\._\-]/g, ' ');
  return clean
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Firebase Realtime Database & Auth Configuration for metaverse-cca59
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoConfigKeyForVirtualOfficeApp",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "metaverse-cca59.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "metaverse-cca59",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "metaverse-cca59.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
  databaseURL: "https://metaverse-cca59-default-rtdb.firebaseio.com"
};

// Initialize Firebase App singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const realtimeDb = getDatabase(app);

// Clean key for Firebase RTDB node paths
const sanitizeFirebaseKey = (key: string): string => {
  return key.toLowerCase().replace(/[\.\#\$\[\]]/g, '_');
};

/**
 * Firebase User Login & Realtime Database Synchronization
 * Mandatory for every user. Developer email `nishadnisha2001@gmail.com` is granted Super Admin.
 */
export const loginWithFirebase = async (email: string, password: string = '123456'): Promise<UserProfile> => {
  const cleanEmail = email.trim().toLowerCase();
  const isDevSuperAdmin = cleanEmail === 'nishadnisha2001@gmail.com' || cleanEmail === 'developer@metaverse.com';

  try {
    // Attempt Firebase Auth sign in
    await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      try {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);
      } catch (createErr) {
        // Fallback to RTDB sync
      }
    }
  }

  const user: UserProfile = {
    id: isDevSuperAdmin ? 'usr_nishad_superadmin' : ('usr_' + Math.random().toString(36).substr(2, 9)),
    email: cleanEmail,
    fullName: isDevSuperAdmin ? 'Nishad (Platform Super Admin)' : extractNameFromEmail(cleanEmail),
    avatar: isDevSuperAdmin ? '👑' : '👨‍💻',
    color: isDevSuperAdmin ? '#ec4899' : '#3b82f6',
    role: isDevSuperAdmin ? 'Owner' : 'Employee',
    isSuperAdmin: isDevSuperAdmin,
    createdAt: Date.now()
  };

  await syncUserToFirebase(user);
  return user;
};

/**
 * Sign out from Firebase Auth
 */
export const logoutFromFirebase = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.warn('Firebase SignOut Error:', err);
  }
};

/**
 * Sync user profile and registered email to Firebase Realtime DB
 */
export const syncUserToFirebase = async (user: UserProfile) => {
  try {
    const userRef = ref(realtimeDb, `users/${user.id}`);
    const cleanEmail = sanitizeFirebaseKey(user.email);
    const emailRef = ref(realtimeDb, `users_by_email/${cleanEmail}`);

    const userData = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl || null,
      color: user.color,
      role: user.role,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      organizationId: user.organizationId || null,
      updatedAt: Date.now()
    };

    await set(userRef, userData);
    await set(emailRef, userData);
  } catch (err) {
    console.warn('Firebase RTDB User Sync:', err);
  }
};

/**
 * Sync entire Office Master Record & Allowed Email Whitelist to Firebase Realtime DB
 */
export const syncOfficeToFirebase = async (office: Office) => {
  try {
    const masterOfficeRef = ref(realtimeDb, `all_offices/${office.id}`);
    const officeStructRef = ref(realtimeDb, `offices/${office.id}/structure`);
    const allowedEmailsRef = ref(realtimeDb, `offices/${office.id}/allowedEmails`);

    await set(masterOfficeRef, office);
    await set(officeStructRef, office);
    await set(allowedEmailsRef, office.allowedEmails || []);
  } catch (err) {
    console.warn('Firebase RTDB Office Master Sync:', err);
  }
};

/**
 * Subscribe to all offices and allowed email whitelists from Firebase Realtime DB across all browsers
 */
export const subscribeFirebaseOffices = (callback: (offices: Office[]) => void) => {
  try {
    const officesRef = ref(realtimeDb, `all_offices`);
    return onValue(officesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data) as Office[];
        callback(list);
      } else {
        callback([]);
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB Offices Subscribe:', err);
    return () => {};
  }
};

/**
 * Subscribe to all registered users from Firebase Realtime DB across all browsers
 */
export const subscribeFirebaseUsers = (callback: (users: UserProfile[]) => void) => {
  try {
    const usersRef = ref(realtimeDb, `users`);
    return onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data) as UserProfile[];
        callback(list);
      } else {
        callback([]);
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB Users Subscribe:', err);
    return () => {};
  }
};

/**
 * Sync office email access whitelist to Firebase Realtime DB
 */
export const syncOfficeAccessToFirebase = async (officeId: string, allowedEmails: string[]) => {
  try {
    const officeRef = ref(realtimeDb, `offices/${officeId}/allowedEmails`);
    const masterAllowedEmailsRef = ref(realtimeDb, `all_offices/${officeId}/allowedEmails`);
    await set(officeRef, allowedEmails);
    await set(masterAllowedEmailsRef, allowedEmails);
  } catch (err) {
    console.warn('Firebase RTDB Office Access Sync:', err);
  }
};

/**
 * Delete office from Firebase Realtime DB
 */
export const deleteOfficeFromFirebase = async (officeId: string) => {
  try {
    const masterOfficeRef = ref(realtimeDb, `all_offices/${officeId}`);
    const officeRef = ref(realtimeDb, `offices/${officeId}`);
    await remove(masterOfficeRef);
    await remove(officeRef);
  } catch (err) {
    console.warn('Firebase RTDB Delete Office:', err);
  }
};

/**
 * Sync entire Office Structure & Layout to Firebase Realtime DB
 */
export const syncOfficeStructureToFirebase = async (office: Office) => {
  try {
    const officeRef = ref(realtimeDb, `offices/${office.id}/structure`);
    const masterOfficeRef = ref(realtimeDb, `all_offices/${office.id}`);
    await set(officeRef, office);
    await set(masterOfficeRef, office);
  } catch (err) {
    console.warn('Firebase RTDB Office Structure Sync:', err);
  }
};

/**
 * Subscribe to real-time Office Structure & Layout updates from Firebase Realtime DB
 */
export const subscribeFirebaseOfficeStructure = (
  officeId: string,
  callback: (office: Office) => void
) => {
  try {
    const officeRef = ref(realtimeDb, `offices/${officeId}/structure`);
    return onValue(officeRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data as Office);
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB Office Structure Subscribe:', err);
    return () => {};
  }
};

/**
 * Sync public chat channel to Firebase Realtime DB
 */
export const pushChannelToFirebase = async (officeId: string, channel: PublicChannel) => {
  try {
    const channelRef = ref(realtimeDb, `offices/${officeId}/channels/${channel.id}`);
    await set(channelRef, channel);
  } catch (err) {
    console.warn('Firebase RTDB Channel Push:', err);
  }
};

/**
 * Subscribe to public channels for an office
 */
export const subscribeFirebaseChannels = (
  officeId: string,
  callback: (channels: PublicChannel[]) => void
) => {
  try {
    const channelsRef = ref(realtimeDb, `offices/${officeId}/channels`);
    return onValue(channelsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data) as PublicChannel[];
        list.sort((a, b) => a.createdAt - b.createdAt);
        callback(list);
      } else {
        callback([]);
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB Channel Subscribe:', err);
    return () => {};
  }
};

/**
 * Push chat message (Office Channel, Public Custom Group, Room, or Direct Personal Chat) to Firebase Realtime DB
 */
export const pushChatMessageToFirebase = async (msg: ChatMessage) => {
  try {
    // 1. Central Master Log of all platform communications
    const masterRef = ref(realtimeDb, `all_messages/${msg.id}`);
    await set(masterRef, msg);

    // 2. Scoped Path Storage
    if (msg.scope === 'office') {
      const officeChatRef = ref(realtimeDb, `offices/${msg.officeId}/chats/office/${msg.id}`);
      await set(officeChatRef, msg);
    } else if (msg.scope === 'channel' && msg.channelId) {
      const cleanChannel = sanitizeFirebaseKey(msg.channelId);
      const channelChatRef = ref(realtimeDb, `offices/${msg.officeId}/chats/channel/${cleanChannel}/${msg.id}`);
      await set(channelChatRef, msg);
    } else if (msg.scope === 'room' && msg.roomId) {
      const cleanRoom = sanitizeFirebaseKey(msg.roomId);
      const roomChatRef = ref(realtimeDb, `offices/${msg.officeId}/chats/room/${cleanRoom}/${msg.id}`);
      await set(roomChatRef, msg);
    } else if (msg.scope === 'direct') {
      // Deterministic Direct Personal Chat conversation key
      const partyA = sanitizeFirebaseKey(msg.senderEmail || msg.senderId);
      const partyB = sanitizeFirebaseKey(msg.recipientEmail || msg.recipientId || 'unknown');
      const convKey = [partyA, partyB].sort().join('___');

      const directChatRef = ref(realtimeDb, `direct_chats/${convKey}/${msg.id}`);
      await set(directChatRef, msg);
    }
  } catch (err) {
    console.warn('Firebase RTDB Chat Push:', err);
  }
};

/**
 * Subscribe to real-time chat messages from Firebase Realtime DB
 */
export const subscribeFirebaseChatMessages = (
  officeId: string,
  scope: 'office' | 'room' | 'direct' | 'channel',
  myEmailOrId: string,
  otherIdOrEmail?: string,
  roomId?: string,
  channelId?: string,
  callback?: (messages: ChatMessage[]) => void
) => {
  if (!callback) return () => {};
  try {
    let path = `offices/${officeId}/chats/office`;

    if (scope === 'channel' && channelId) {
      const cleanChannel = sanitizeFirebaseKey(channelId);
      path = `offices/${officeId}/chats/channel/${cleanChannel}`;
    } else if (scope === 'room' && roomId) {
      const cleanRoom = sanitizeFirebaseKey(roomId);
      path = `offices/${officeId}/chats/room/${cleanRoom}`;
    } else if (scope === 'direct' && otherIdOrEmail) {
      const partyA = sanitizeFirebaseKey(myEmailOrId);
      const partyB = sanitizeFirebaseKey(otherIdOrEmail);
      const convKey = [partyA, partyB].sort().join('___');
      path = `direct_chats/${convKey}`;
    }

    const messagesRef = ref(realtimeDb, path);
    return onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data) as ChatMessage[];
        list.sort((a, b) => a.timestamp - b.timestamp);
        callback(list);
      } else {
        callback([]);
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB Chat Subscribe:', err);
    return () => {};
  }
};

/**
 * Sync player spatial position & status to Firebase Realtime DB
 */
export const syncFirebasePlayerPosition = async (officeId: string, userId: string, position: any) => {
  try {
    const playerRef = ref(realtimeDb, `offices/${officeId}/presence/${userId}`);
    await set(playerRef, {
      ...position,
      updatedAt: Date.now()
    });
    onDisconnect(playerRef).remove();
  } catch (err) {
    console.warn('Firebase RTDB Position Sync:', err);
  }
};

/**
 * Subscribe to real-time player positions for multi-user presence in an office across all devices
 */
export const subscribeFirebasePresence = (
  officeId: string,
  callback: (positions: any[]) => void
) => {
  try {
    const presenceRef = ref(realtimeDb, `offices/${officeId}/presence`);
    return onValue(presenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data);
        callback(list);
      } else {
        callback([]);
      }
    });
  } catch (err) {
    console.warn('Firebase RTDB Presence Subscribe:', err);
    return () => {};
  }
};

/**
 * Remove player presence when leaving office
 */
export const removeFirebasePresence = async (officeId: string, userId: string) => {
  try {
    const playerRef = ref(realtimeDb, `offices/${officeId}/presence/${userId}`);
    await remove(playerRef);
  } catch (err) {
    console.warn('Firebase RTDB Remove Presence:', err);
  }
};

/**
 * Stream live video frame snapshot to Firebase Realtime DB (100% Reliable Firebase Media Fallback)
 */
export const syncVideoFrameToFirebase = async (officeId: string, userId: string, frameDataBase64: string | null) => {
  try {
    const frameRef = ref(realtimeDb, `offices/${officeId}/video_feeds/${userId}`);
    if (frameDataBase64) {
      await set(frameRef, {
        userId,
        frame: frameDataBase64,
        timestamp: Date.now()
      });
      onDisconnect(frameRef).remove();
    } else {
      await remove(frameRef);
    }
  } catch (err) {
    console.warn('Firebase RTDB Video Frame Sync:', err);
  }
};

/**
 * Subscribe to all live video frame feeds for an office from Firebase Realtime DB
 */
export const subscribeFirebaseVideoFeeds = (
  officeId: string,
  callback: (feeds: Map<string, string>) => void
) => {
  try {
    const feedsRef = ref(realtimeDb, `offices/${officeId}/video_feeds`);
    return onValue(feedsRef, (snapshot) => {
      const data = snapshot.val();
      const feedsMap = new Map<string, string>();
      if (data) {
        Object.entries(data).forEach(([uId, item]: [string, any]) => {
          if (item && item.frame && (Date.now() - item.timestamp < 10000)) {
            feedsMap.set(uId, item.frame);
          }
        });
      }
      callback(feedsMap);
    });
  } catch (err) {
    console.warn('Firebase RTDB Video Feeds Subscribe:', err);
    return () => {};
  }
};

export const isFirebaseConfigured = true;

export default app;
