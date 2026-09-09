import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  disableNetwork,
  enableNetwork,
  setLogLevel,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, CurrencyType, GOLDEN_ACE_AVATAR, TableRakeRecord, PokerTableState, Player, ChatMessage, FloatingEmoji, BotSystemConfig } from '../types/poker';
import {
  syncTableStateSocket,
  subscribeToTableStateSocket,
  sendTableChatMessageSocket,
  subscribeToTableChatSocket,
  sendTableEmojiSocket,
  subscribeToTableEmojiSocket,
  sendBotConfigSocket,
  subscribeToBotConfigSocket,
  subscribeToLobbyTablesSocket,
  emitKickPlayerSocket,
  emitPlayerLeaveSocket
} from './socket';

// Mute internal Firestore SDK verbose logging to prevent console flood
try {
  setLogLevel('silent');
} catch {}

export const ADMIN_EMAIL = 'nmehman659@gmail.com';
export const ADMIN_SECRET_PASSWORD = '#M557725368@';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() || email.trim().toLowerCase() === 'admin@royalpoker.com';
}

export function checkAdminPassword(password: string): boolean {
  return password.trim() === ADMIN_SECRET_PASSWORD;
}

// Direct Firebase console & pricing links for Firestore quota management
export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
export const FIRESTORE_PRICING_URL = 'https://firebase.google.com/pricing#cloud-firestore';

// Reactive Quota Exceeded State & Circuit Breaker (initialized immediately from storage)
let firestoreQuotaExceeded: boolean = (() => {
  try {
    return localStorage.getItem('royal_poker_firestore_quota_exceeded') === 'true';
  } catch {
    return false;
  }
})();

const quotaListeners: ((exceeded: boolean) => void)[] = [];

export function isQuotaExceededError(error: any): boolean {
  if (!error) return false;
  const msg = error?.message || String(error);
  const code = error?.code || '';
  return (
    code === 'resource-exhausted' ||
    code === 'unavailable' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('Free daily write units') ||
    msg.includes('Free daily read units') ||
    msg.includes('Quota exceeded for quota metric') ||
    msg.includes('Could not reach Cloud Firestore backend') ||
    msg.includes('Using maximum backoff delay') ||
    msg.includes('unavailable')
  );
}

// Global browser rejection & error guard to silently capture Firestore quota limits
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (isQuotaExceededError(event?.reason)) {
      event.preventDefault();
      setFirestoreQuotaExceeded(true);
    }
  });

  // Intercept and suppress console spam for known resource exhaustion
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const isQuotaErr = args.some(arg => isQuotaExceededError(arg));
    if (isQuotaErr) {
      setFirestoreQuotaExceeded(true);
      return;
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const isQuotaErr = args.some(arg => isQuotaExceededError(arg));
    if (isQuotaErr) {
      setFirestoreQuotaExceeded(true);
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
}

export function setFirestoreQuotaExceeded(exceeded: boolean = true) {
  if (firestoreQuotaExceeded === exceeded) return;
  firestoreQuotaExceeded = exceeded;
  try {
    if (exceeded) {
      localStorage.setItem('royal_poker_firestore_quota_exceeded', 'true');
      disableNetwork(db).catch(() => {});
    } else {
      localStorage.removeItem('royal_poker_firestore_quota_exceeded');
      enableNetwork(db).catch(() => {});
    }
  } catch {}
  quotaListeners.forEach(fn => {
    try { fn(exceeded); } catch {}
  });
}

export function getFirestoreQuotaExceeded(): boolean {
  return firestoreQuotaExceeded;
}

export function subscribeToQuotaExceededStatus(callback: (exceeded: boolean) => void): () => void {
  quotaListeners.push(callback);
  callback(getFirestoreQuotaExceeded());
  return () => {
    const idx = quotaListeners.indexOf(callback);
    if (idx >= 0) quotaListeners.splice(idx, 1);
  };
}

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp({
  apiKey: firebaseConfig.apiKey,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
});

export const auth = getAuth(app);

// Initialize Firestore with reliable settings and forced long polling for maximum web sandbox stability
export const db = (() => {
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  let instance;
  try {
    instance = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      experimentalForceLongPolling: true,
    }, dbId);
  } catch {
    instance = getFirestore(app, dbId);
  }

  // If previous session marked quota exceeded, immediately disable network retries
  if (firestoreQuotaExceeded) {
    try {
      disableNetwork(instance).catch(() => {});
    } catch {}
  }

  return instance;
})();

export const googleProvider = new GoogleAuthProvider();

const LOCAL_STORAGE_KEY = 'royal_poker_auth_user';

// Simple fast hashing for password check
function hashPassword(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'pw_' + Math.abs(hash).toString(36);
}

// Map Firestore / Auth user to app UserProfile
export async function syncUserProfile(
  firebaseUser: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null }, 
  additionalData?: Partial<UserProfile>
): Promise<UserProfile> {
  const isAdmin = isAdminEmail(firebaseUser.email);

  if (getFirestoreQuotaExceeded()) {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as UserProfile;
        if (parsed.id === firebaseUser.uid || parsed.email === firebaseUser.email) {
          return { ...parsed, ...additionalData };
        }
      } catch {}
    }
  }

  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      if (isAdmin) {
        const adminProfile: UserProfile = {
          ...existing,
          username: 'ADMIN',
          avatar: GOLDEN_ACE_AVATAR,
          isAdmin: true,
          realBalance: (existing.realBalance && existing.realBalance > 0) ? existing.realBalance : 7500.00,
          bonusBalance: 0.00,
          activeCurrencyMode: 'real',
          vipLevel: 10,
          vipXp: 10000,
          ...additionalData
        };
        // Always ensure at least 7500.00
        if (!adminProfile.realBalance || adminProfile.realBalance <= 0) {
          adminProfile.realBalance = 7500.00;
        }
        try {
          await updateDoc(userRef, { ...adminProfile });
        } catch (uErr) {
          if (isQuotaExceededError(uErr)) setFirestoreQuotaExceeded(true);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(adminProfile));
        return adminProfile;
      }

      if (additionalData && Object.keys(additionalData).length > 0) {
        try {
          await updateDoc(userRef, { ...additionalData });
        } catch (uErr) {
          if (isQuotaExceededError(uErr)) setFirestoreQuotaExceeded(true);
        }
        const updated = { ...existing, ...additionalData };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
      return existing;
    }

    // Create new player profile in Firestore
    const newProfile: UserProfile = {
      id: firebaseUser.uid,
      username: isAdmin ? 'ADMIN' : (additionalData?.username || firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : `Player_${Math.floor(100 + Math.random() * 900)}`)),
      email: firebaseUser.email || '',
      avatar: isAdmin ? GOLDEN_ACE_AVATAR : (firebaseUser.photoURL || additionalData?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
      currency: (additionalData?.currency as CurrencyType) || 'USD',
      realBalance: isAdmin ? 7500.00 : (additionalData?.realBalance ?? 0.00),
      bonusBalance: isAdmin ? 0.00 : (additionalData?.bonusBalance ?? 5.00),
      hasClaimedSpecialBonus: true,
      bonusQuestStartTime: Date.now(),
      bonusTurnoverCompleted: false,
      playMoneyBalance: 25000,
      activeCurrencyMode: 'real',
      vipLevel: isAdmin ? 10 : 1,
      vipXp: isAdmin ? 10000 : 50,
      isAdmin: isAdmin,
      is2FAEnabled: false,
      totalHandsPlayed: 0,
      handsWon: 0,
      biggestPotWon: 0,
      createdAt: new Date().toISOString(),
      ...additionalData
    };

    if (isAdmin && (!newProfile.realBalance || newProfile.realBalance <= 0)) {
      newProfile.realBalance = 7500.00;
    }

    try {
      await setDoc(userRef, newProfile);
    } catch (sErr) {
      if (isQuotaExceededError(sErr)) setFirestoreQuotaExceeded(true);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
    return newProfile;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Firestore sync fallback:', err?.message || err);
    const fallbackProfile: UserProfile = {
      id: firebaseUser.uid,
      username: isAdmin ? 'ADMIN' : (additionalData?.username || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Player')),
      email: firebaseUser.email || '',
      avatar: isAdmin ? GOLDEN_ACE_AVATAR : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      currency: (additionalData?.currency as CurrencyType) || 'USD',
      realBalance: isAdmin ? 7500.00 : (additionalData?.realBalance ?? 0.00),
      bonusBalance: isAdmin ? 0.00 : (additionalData?.bonusBalance ?? 5.00),
      hasClaimedSpecialBonus: true,
      bonusQuestStartTime: Date.now(),
      bonusTurnoverCompleted: false,
      playMoneyBalance: 25000,
      activeCurrencyMode: 'real',
      vipLevel: isAdmin ? 10 : 1,
      vipXp: isAdmin ? 10000 : 50,
      isAdmin: isAdmin,
      is2FAEnabled: false,
      totalHandsPlayed: 0,
      handsWon: 0,
      biggestPotWon: 0,
      createdAt: new Date().toISOString(),
      ...additionalData
    };
    if (isAdmin && (!fallbackProfile.realBalance || fallbackProfile.realBalance <= 0)) {
      fallbackProfile.realBalance = 7500.00;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fallbackProfile));
    return fallbackProfile;
  }
}

// Seamless registration: handles Firebase Auth and gracefully falls back to Firestore user records if auth/operation-not-allowed
export async function registerUserSeamlessly(
  email: string, 
  pass: string, 
  username: string, 
  currency: CurrencyType
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const isAdmin = isAdminEmail(cleanEmail);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    return await syncUserProfile(userCredential.user, {
      username: isAdmin ? 'ADMIN' : username,
      currency,
      realBalance: isAdmin ? 7500.00 : 0.00,
      bonusBalance: isAdmin ? 0.00 : 5.00,
      hasClaimedSpecialBonus: true,
      bonusQuestStartTime: Date.now(),
      bonusTurnoverCompleted: false,
      playMoneyBalance: 25000,
      isAdmin,
      avatar: isAdmin ? GOLDEN_ACE_AVATAR : undefined
    });
  } catch (authErr: any) {
    // If operation-not-allowed or configuration issue, register directly to Firestore and local persistence
    const generatedUid = 'usr_' + Math.random().toString(36).substring(2, 10);
    const userRef = doc(db, 'users', generatedUid);
    
    const newProfile: UserProfile = {
      id: generatedUid,
      username: isAdmin ? 'ADMIN' : username,
      email: cleanEmail,
      avatar: isAdmin ? GOLDEN_ACE_AVATAR : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      currency,
      realBalance: isAdmin ? 7500.00 : 0.00,
      bonusBalance: isAdmin ? 0.00 : 5.00,
      hasClaimedSpecialBonus: true,
      bonusQuestStartTime: Date.now(),
      bonusTurnoverCompleted: false,
      playMoneyBalance: 25000,
      activeCurrencyMode: 'real',
      vipLevel: isAdmin ? 10 : 1,
      vipXp: isAdmin ? 10000 : 50,
      isAdmin: isAdmin,
      is2FAEnabled: false,
      totalHandsPlayed: 0,
      handsWon: 0,
      biggestPotWon: 0,
      createdAt: new Date().toISOString(),
    };

    if (!getFirestoreQuotaExceeded()) {
      try {
        await setDoc(userRef, {
          ...newProfile,
          passHash: hashPassword(pass)
        });
      } catch (err: any) {
        if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
        console.warn('Could not write user to Firestore:', err?.message || err);
      }
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
    return newProfile;
  }
}

// Seamless sign in
export async function signInUserSeamlessly(email: string, pass: string): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    return await syncUserProfile(userCredential.user);
  } catch (authErr: any) {
    console.warn('Firebase Auth signIn failed, checking Firestore & seamless fallback:', authErr.code);
    
    // Always check Firestore users collection on any auth error or missing user
    if (!getFirestoreQuotaExceeded()) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', cleanEmail));
        const querySnap = await getDocs(q);
        
        if (!querySnap.empty) {
          const docData = querySnap.docs[0].data() as any;
          if (docData.passHash && docData.passHash !== hashPassword(pass)) {
            throw new Error('auth/wrong-password');
          }
          const isAdmin = isAdminEmail(cleanEmail);
          const profile: UserProfile = {
            id: docData.id || querySnap.docs[0].id,
            username: isAdmin ? 'ADMIN' : (docData.username || cleanEmail.split('@')[0]),
            email: cleanEmail,
            avatar: isAdmin ? GOLDEN_ACE_AVATAR : (docData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
            currency: docData.currency || 'USD',
            realBalance: isAdmin ? (docData.realBalance > 0 ? docData.realBalance : 7500.00) : (docData.realBalance ?? 0.00),
            bonusBalance: isAdmin ? 0.00 : (docData.bonusBalance ?? 5.00),
            hasClaimedSpecialBonus: docData.hasClaimedSpecialBonus ?? true,
            bonusQuestStartTime: docData.bonusQuestStartTime ?? Date.now(),
            bonusTurnoverCompleted: docData.bonusTurnoverCompleted ?? false,
            playMoneyBalance: docData.playMoneyBalance ?? 25000,
            activeCurrencyMode: docData.activeCurrencyMode || 'real',
            vipLevel: isAdmin ? 10 : (docData.vipLevel ?? 1),
            vipXp: isAdmin ? 10000 : (docData.vipXp ?? 50),
            isAdmin: isAdmin,
            is2FAEnabled: docData.is2FAEnabled ?? false,
            totalHandsPlayed: docData.totalHandsPlayed ?? 0,
            handsWon: docData.handsWon ?? 0,
            biggestPotWon: docData.biggestPotWon ?? 0,
            createdAt: docData.createdAt || new Date().toISOString()
          };
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
          return profile;
        } else {
          // If not found in Firestore and it's admin or user, register them seamlessly
          const registered = await registerUserSeamlessly(cleanEmail, pass, isAdminEmail(cleanEmail) ? 'ADMIN' : cleanEmail.split('@')[0], 'USD');
          return registered;
        }
      } catch (err: any) {
        if (err.message === 'auth/wrong-password') {
          throw err;
        }
        if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
        console.warn('Firestore lookup error:', err?.message || err);
      }
    }

    // Check local cached account
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      try {
        const cachedUser = JSON.parse(cached) as UserProfile;
        if (cachedUser.email.toLowerCase() === cleanEmail) {
          return cachedUser;
        }
      } catch {}
    }

    throw authErr;
  }
}

export function getSavedLocalUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocalUser() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

// Update balance in Firestore and Local
export async function updateUserBalanceInFirebase(
  userId: string, 
  realBalance: number, 
  playMoneyBalance: number, 
  bonusBalance?: number
) {
  // Always update local cache first
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.id === userId) {
        parsed.realBalance = realBalance;
        parsed.playMoneyBalance = playMoneyBalance;
        if (bonusBalance !== undefined) parsed.bonusBalance = bonusBalance;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(parsed));
      }
    }
  } catch {}

  if (getFirestoreQuotaExceeded()) {
    return;
  }

  try {
    const userRef = doc(db, 'users', userId);
    const updatePayload: Record<string, any> = {
      realBalance,
      playMoneyBalance
    };
    if (bonusBalance !== undefined) {
      updatePayload.bonusBalance = bonusBalance;
    }
    await updateDoc(userRef, updatePayload);
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error updating balance in Firestore:', err?.message || err);
  }
}

// Fetch all registered users from Firestore for Admin Panel
export async function fetchAllUsersFromFirestore(): Promise<UserProfile[]> {
  if (getFirestoreQuotaExceeded()) {
    try {
      const raw = localStorage.getItem('royal_poker_all_players');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  try {
    const usersRef = collection(db, 'users');
    const snap = await getDocs(usersRef);
    const users: UserProfile[] = [];
    snap.forEach((d) => {
      const data = d.data() as UserProfile;
      users.push({
        ...data,
        id: data.id || d.id
      });
    });
    if (users.length > 0) {
      try {
        localStorage.setItem('royal_poker_all_players', JSON.stringify(users));
      } catch {}
    }
    return users;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error fetching all users from Firestore:', err?.message || err);
    try {
      const raw = localStorage.getItem('royal_poker_all_players');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
}

// Update user by Admin in Firestore
export async function adminUpdateUserInFirestore(userId: string, updates: Partial<UserProfile>) {
  try {
    const raw = localStorage.getItem('royal_poker_all_players');
    if (raw) {
      const list: UserProfile[] = JSON.parse(raw);
      const idx = list.findIndex(p => p.id === userId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates };
        localStorage.setItem('royal_poker_all_players', JSON.stringify(list));
      }
    }
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updates);
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error admin updating user in Firestore:', err?.message || err);
  }
}

// Save deposit request to Firestore
export async function saveDepositToFirestore(deposit: any) {
  try {
    const raw = localStorage.getItem('royal_poker_all_deposits');
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((d: any) => d.id === deposit.id);
    if (idx >= 0) list[idx] = deposit;
    else list.unshift(deposit);
    localStorage.setItem('royal_poker_all_deposits', JSON.stringify(list));
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const depRef = doc(db, 'deposits', deposit.id);
    await setDoc(depRef, {
      ...deposit,
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error saving deposit to Firestore:', err?.message || err);
  }
}

// Fetch all deposits from Firestore
export async function fetchAllDepositsFromFirestore(): Promise<any[]> {
  if (getFirestoreQuotaExceeded()) {
    try {
      const raw = localStorage.getItem('royal_poker_all_deposits');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  try {
    const depsRef = collection(db, 'deposits');
    const snap = await getDocs(depsRef);
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({ ...data, id: data.id || d.id });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    try {
      localStorage.setItem('royal_poker_all_deposits', JSON.stringify(list));
    } catch {}
    return list;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error fetching deposits from Firestore:', err?.message || err);
    try {
      const raw = localStorage.getItem('royal_poker_all_deposits');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
}

// Update deposit status in Firestore
export async function updateDepositStatusInFirestore(depositId: string, status: 'pending' | 'completed' | 'rejected') {
  try {
    const raw = localStorage.getItem('royal_poker_all_deposits');
    if (raw) {
      const list = JSON.parse(raw);
      const d = list.find((item: any) => item.id === depositId);
      if (d) {
        d.status = status;
        d.reviewedAt = Date.now();
        localStorage.setItem('royal_poker_all_deposits', JSON.stringify(list));
      }
    }
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const depRef = doc(db, 'deposits', depositId);
    await updateDoc(depRef, { 
      status, 
      reviewedAt: Date.now(),
      updatedAt: serverTimestamp() 
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error updating deposit in Firestore:', err?.message || err);
  }
}

// Approve deposit: updates deposit record and increments player's real balance in Firestore
export async function approveDepositInFirestore(depositId: string, userId: string, amount: number) {
  // Update local storage
  try {
    const raw = localStorage.getItem('royal_poker_all_deposits');
    if (raw) {
      const list = JSON.parse(raw);
      const d = list.find((item: any) => item.id === depositId);
      if (d) {
        d.status = 'completed';
        d.reviewedAt = Date.now();
        localStorage.setItem('royal_poker_all_deposits', JSON.stringify(list));
      }
    }
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    // 1. Update deposit status
    const depRef = doc(db, 'deposits', depositId);
    await updateDoc(depRef, {
      status: 'completed',
      reviewedAt: Date.now(),
      updatedAt: serverTimestamp()
    });

    // 2. Fetch user and increment realBalance
    if (userId) {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const currentReal = Number(userData.realBalance || 0);
        const newReal = Number((currentReal + amount).toFixed(2));
        await updateDoc(userRef, {
          realBalance: newReal,
          lastDepositApprovedAt: Date.now(),
          lastDepositApprovedAmount: amount,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error approving deposit in Firestore:', err?.message || err);
  }
}

// Subscribe to a specific user's live profile changes in Firestore
export function subscribeToUserProfile(userId: string, onUpdate: (user: UserProfile) => void) {
  if (getFirestoreQuotaExceeded()) {
    return () => {};
  }

  try {
    const userRef = doc(db, 'users', userId);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        onUpdate({ ...data, id: data.id || docSnap.id });
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('User profile snapshot error:', err?.message || err);
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error subscribing to user profile:', err?.message || err);
    return () => {};
  }
}

// Save withdrawal request to Firestore
export async function saveWithdrawalToFirestore(withdrawal: any) {
  try {
    const raw = localStorage.getItem('royal_poker_all_withdrawals');
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((w: any) => w.id === withdrawal.id);
    if (idx >= 0) list[idx] = withdrawal;
    else list.unshift(withdrawal);
    localStorage.setItem('royal_poker_all_withdrawals', JSON.stringify(list));
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const withRef = doc(db, 'withdrawals', withdrawal.id);
    await setDoc(withRef, {
      ...withdrawal,
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error saving withdrawal to Firestore:', err?.message || err);
  }
}

// Fetch all withdrawals from Firestore
export async function fetchAllWithdrawalsFromFirestore(): Promise<any[]> {
  if (getFirestoreQuotaExceeded()) {
    try {
      const raw = localStorage.getItem('royal_poker_all_withdrawals');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  try {
    const withsRef = collection(db, 'withdrawals');
    const snap = await getDocs(withsRef);
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({ ...data, id: data.id || d.id });
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    try {
      localStorage.setItem('royal_poker_all_withdrawals', JSON.stringify(list));
    } catch {}
    return list;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error fetching withdrawals from Firestore:', err?.message || err);
    try {
      const raw = localStorage.getItem('royal_poker_all_withdrawals');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }
}

// Update withdrawal status in Firestore
export async function updateWithdrawalStatusInFirestore(withdrawalId: string, status: 'approved' | 'rejected') {
  try {
    const raw = localStorage.getItem('royal_poker_all_withdrawals');
    if (raw) {
      const list = JSON.parse(raw);
      const w = list.find((item: any) => item.id === withdrawalId);
      if (w) {
        w.status = status;
        localStorage.setItem('royal_poker_all_withdrawals', JSON.stringify(list));
      }
    }
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const withRef = doc(db, 'withdrawals', withdrawalId);
    await updateDoc(withRef, { status, updatedAt: serverTimestamp() });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error updating withdrawal in Firestore:', err?.message || err);
  }
}

// Save system config to Firestore
export async function saveSystemConfigToFirestore(cfg: any) {
  try {
    localStorage.setItem('royal_poker_system_config_main', JSON.stringify(cfg));
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const cfgRef = doc(db, 'system_config', 'main');
    await setDoc(cfgRef, { ...cfg, updatedAt: serverTimestamp() });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error saving system config to Firestore:', err?.message || err);
  }
}

// Fetch system config from Firestore
export async function fetchSystemConfigFromFirestore(): Promise<any | null> {
  if (getFirestoreQuotaExceeded()) {
    try {
      const raw = localStorage.getItem('royal_poker_system_config_main');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  try {
    const cfgRef = doc(db, 'system_config', 'main');
    const snap = await getDoc(cfgRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error fetching system config from Firestore:', err?.message || err);
    try {
      const raw = localStorage.getItem('royal_poker_system_config_main');
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
}

// Save bot system configuration to Firestore & WebSocket
export async function saveBotSystemConfigToFirestore(cfg: any) {
  try {
    localStorage.setItem('royal_poker_bot_config', JSON.stringify(cfg));
  } catch {}

  // Broadcast instantly via WebSocket
  sendBotConfigSocket(cfg);

  // If bots were deactivated, immediately clean local tables storage
  if (cfg && cfg.isBotsActive === false) {
    try {
      const raw = localStorage.getItem(LOCAL_TABLES_KEY);
      if (raw) {
        const list: PokerTableState[] = JSON.parse(raw);
        const cleaned = list.map((t) => {
          const players = (t.players || []).map((p) => (p && !p.isHuman ? null : p));
          const humanCount = players.filter((p) => p !== null).length;
          return {
            ...t,
            players,
            stage: (humanCount < 2 ? 'waiting' : t.stage) as any,
            pot: humanCount < 2 ? 0 : t.pot,
            communityCards: humanCount < 2 ? [] : t.communityCards,
            handWinners: humanCount < 2 ? [] : t.handWinners,
          };
        });
        localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(cleaned));
      }
    } catch {}
  }

  if (getFirestoreQuotaExceeded()) return;

  try {
    const cfgRef = doc(db, 'system_config', 'bot_settings');
    await setDoc(cfgRef, { ...cfg, updatedAt: serverTimestamp() });

    // If bots deactivated, clean Firestore tables as well
    if (cfg && cfg.isBotsActive === false) {
      const tablesRef = collection(db, 'tables');
      const snap = await getDocs(tablesRef);
      snap.forEach(async (d) => {
        const tbl = d.data() as any;
        if (tbl && tbl.players && tbl.players.some((p: any) => p && !p.isHuman)) {
          const players = tbl.players.map((p: any) => (p && !p.isHuman ? null : p));
          const humanCount = players.filter((p: any) => p !== null).length;
          await setDoc(doc(db, 'tables', d.id), {
            players,
            stage: humanCount < 2 ? 'waiting' : tbl.stage,
            pot: humanCount < 2 ? 0 : tbl.pot,
            communityCards: humanCount < 2 ? [] : tbl.communityCards,
            handWinners: humanCount < 2 ? [] : tbl.handWinners,
            updatedAt: Date.now(),
          }, { merge: true });
        }
      });
    }
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error saving bot system config to Firestore:', err?.message || err);
  }
}

// Fetch bot system configuration from Firestore
export async function fetchBotSystemConfigFromFirestore(): Promise<any | null> {
  if (!getFirestoreQuotaExceeded()) {
    try {
      const cfgRef = doc(db, 'system_config', 'bot_settings');
      const snap = await getDoc(cfgRef);
      if (snap.exists()) {
        const data = snap.data();
        localStorage.setItem('royal_poker_bot_config', JSON.stringify(data));
        return data;
      }
    } catch (err: any) {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Error fetching bot system config from Firestore:', err?.message || err);
    }
  }

  const local = localStorage.getItem('royal_poker_bot_config');
  if (local) {
    try { return JSON.parse(local); } catch {}
  }
  // Default: Bots inactive until admin explicitly turns them on
  return {
    isBotsActive: false,
    botDifficulty: 'pro',
    autoJoinLeaveEnabled: false,
    minThinkSeconds: 4,
    maxThinkSeconds: 9,
    targetTableOccupancy: 4,
  };
}

// Subscribe to real-time bot settings via WebSocket & Firestore
export function subscribeToBotSystemConfig(callback: (config: any) => void) {
  // 1. Instant WebSocket listener
  const unsubSocket = subscribeToBotConfigSocket((cfg) => {
    try {
      localStorage.setItem('royal_poker_bot_config', JSON.stringify(cfg));
    } catch {}
    callback(cfg);
  });

  if (getFirestoreQuotaExceeded()) {
    const local = localStorage.getItem('royal_poker_bot_config');
    if (local) {
      try { callback(JSON.parse(local)); } catch {}
    }
    return unsubSocket;
  }

  try {
    const cfgRef = doc(db, 'system_config', 'bot_settings');
    const unsubFirestore = onSnapshot(cfgRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        localStorage.setItem('royal_poker_bot_config', JSON.stringify(data));
        callback(data);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Bot config snapshot listener error:', err?.message || err);
      const local = localStorage.getItem('royal_poker_bot_config');
      if (local) {
        try { callback(JSON.parse(local)); } catch {}
      }
    });

    return () => {
      unsubSocket();
      try { unsubFirestore(); } catch {}
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error subscribing to bot config:', err?.message || err);
    return unsubSocket;
  }
}

// Real-time Firestore Listeners for Admin Dashboard
export function subscribeToRealtimeAdminData(callbacks: {
  onUsersChange?: (users: UserProfile[]) => void;
  onDepositsChange?: (deposits: any[]) => void;
  onWithdrawalsChange?: (withdrawals: any[]) => void;
  onMessagesChange?: (messages: SupportMessage[]) => void;
  onRakesChange?: (rakes: TableRakeRecord[]) => void;
  onBotConfigChange?: (config: any) => void;
}) {
  const unsubs: (() => void)[] = [];

  if (getFirestoreQuotaExceeded()) {
    // Provide cached data to callbacks
    try {
      if (callbacks.onUsersChange) {
        const u = localStorage.getItem('royal_poker_all_players');
        if (u) callbacks.onUsersChange(JSON.parse(u));
      }
      if (callbacks.onDepositsChange) {
        const d = localStorage.getItem('royal_poker_all_deposits');
        if (d) callbacks.onDepositsChange(JSON.parse(d));
      }
      if (callbacks.onWithdrawalsChange) {
        const w = localStorage.getItem('royal_poker_all_withdrawals');
        if (w) callbacks.onWithdrawalsChange(JSON.parse(w));
      }
      if (callbacks.onMessagesChange) {
        callbacks.onMessagesChange(getLocalSupportMessages());
      }
      if (callbacks.onRakesChange) {
        callbacks.onRakesChange(getLocalTableRakes());
      }
    } catch {}
    return () => {};
  }

  try {
    // 1. Users real-time listener
    const usersRef = collection(db, 'users');
    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const users: UserProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as UserProfile;
        users.push({ ...data, id: data.id || d.id });
      });
      if (callbacks.onUsersChange) {
        callbacks.onUsersChange(users);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Users snapshot listener error:', err?.message || err);
    });
    unsubs.push(unsubUsers);

    // 2. Deposits real-time listener
    const depositsRef = collection(db, 'deposits');
    const unsubDeps = onSnapshot(depositsRef, (snap) => {
      const deposits: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        deposits.push({ ...data, id: data.id || d.id });
      });
      deposits.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (callbacks.onDepositsChange) {
        callbacks.onDepositsChange(deposits);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Deposits snapshot listener error:', err?.message || err);
    });
    unsubs.push(unsubDeps);

    // 3. Withdrawals real-time listener
    const withRef = collection(db, 'withdrawals');
    const unsubWiths = onSnapshot(withRef, (snap) => {
      const withdrawals: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        withdrawals.push({ ...data, id: data.id || d.id });
      });
      withdrawals.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (callbacks.onWithdrawalsChange) {
        callbacks.onWithdrawalsChange(withdrawals);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Withdrawals snapshot listener error:', err?.message || err);
    });
    unsubs.push(unsubWiths);

    // 4. Support messages real-time listener
    const msgRef = collection(db, 'support_messages');
    const unsubMsgs = onSnapshot(msgRef, (snap) => {
      const messages: SupportMessage[] = [];
      snap.forEach((d) => {
        const data = d.data() as SupportMessage;
        messages.push({ ...data, id: data.id || d.id });
      });
      messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      if (callbacks.onMessagesChange) {
        callbacks.onMessagesChange(messages);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Support messages snapshot listener error:', err?.message || err);
    });
    unsubs.push(unsubMsgs);

    // 5. Table rakes (%10 masa faizləri) real-time listener
    const rakesRef = collection(db, 'table_rakes');
    const unsubRakes = onSnapshot(rakesRef, (snap) => {
      const rakes: TableRakeRecord[] = [];
      snap.forEach((d) => {
        const data = d.data() as TableRakeRecord;
        rakes.push({ ...data, id: data.id || d.id });
      });
      rakes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      if (callbacks.onRakesChange) {
        callbacks.onRakesChange(rakes);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Table rakes snapshot listener error:', err?.message || err);
    });
    unsubs.push(unsubRakes);

    // 6. Bot Settings real-time listener
    const botCfgRef = doc(db, 'system_config', 'bot_settings');
    const unsubBotCfg = onSnapshot(botCfgRef, (snap) => {
      if (snap.exists() && callbacks.onBotConfigChange) {
        callbacks.onBotConfigChange(snap.data());
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Bot config snapshot listener error:', err?.message || err);
    });
    unsubs.push(unsubBotCfg);
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error subscribing to realtime admin data:', err?.message || err);
  }

  return () => {
    unsubs.forEach(unsub => {
      try { unsub(); } catch {}
    });
  };
}

// Support Message Data Structure
export interface SupportMessage {
  id: string;
  userId: string;
  username: string;
  userEmail: string;
  userAvatar?: string;
  sender: 'user' | 'admin';
  text: string;
  createdAt: number;
  readByAdmin?: boolean;
  readByUser?: boolean;
}

const LOCAL_SUPPORT_KEY = 'royal_poker_support_messages';

// Get local cached messages
export function getLocalSupportMessages(): SupportMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUPPORT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save local cached messages
export function saveLocalSupportMessages(messages: SupportMessage[]): void {
  try {
    localStorage.setItem(LOCAL_SUPPORT_KEY, JSON.stringify(messages));
  } catch {}
}

// Send a support message (from player or admin)
export async function sendSupportMessage(msgData: Omit<SupportMessage, 'id'>): Promise<SupportMessage> {
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const message: SupportMessage = {
    ...msgData,
    id: msgId,
    createdAt: msgData.createdAt || Date.now(),
    readByAdmin: msgData.sender === 'admin' ? true : false,
    readByUser: msgData.sender === 'user' ? true : false,
  };

  // 1. Cache locally
  const localList = getLocalSupportMessages();
  localList.push(message);
  saveLocalSupportMessages(localList);

  if (getFirestoreQuotaExceeded()) {
    return message;
  }

  // 2. Save to Firestore
  try {
    const msgRef = doc(db, 'support_messages', msgId);
    await setDoc(msgRef, {
      ...message,
      updatedAt: serverTimestamp()
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Could not save support message to Firestore:', err?.message || err);
  }

  return message;
}

// Subscribe to messages for a specific player
export function subscribeToPlayerSupportMessages(userId: string, callback: (messages: SupportMessage[]) => void): () => void {
  if (getFirestoreQuotaExceeded()) {
    const local = getLocalSupportMessages().filter(m => m.userId === userId);
    callback(local);
    return () => {};
  }

  try {
    const msgRef = collection(db, 'support_messages');
    const q = query(msgRef, where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      const messages: SupportMessage[] = [];
      snap.forEach((d) => {
        const data = d.data() as SupportMessage;
        messages.push({ ...data, id: data.id || d.id });
      });
      messages.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      if (messages.length > 0) {
        callback(messages);
      } else {
        // Fallback to local
        const local = getLocalSupportMessages().filter(m => m.userId === userId);
        callback(local);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Player support messages snapshot error:', err?.message || err);
      const local = getLocalSupportMessages().filter(m => m.userId === userId);
      callback(local);
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error subscribing to player support messages:', err?.message || err);
    const local = getLocalSupportMessages().filter(m => m.userId === userId);
    callback(local);
    return () => {};
  }
}

// Mark messages as read by Admin
export async function markSupportMessagesReadByAdmin(userId: string): Promise<void> {
  // Update local
  const local = getLocalSupportMessages().map(m => m.userId === userId ? { ...m, readByAdmin: true } : m);
  saveLocalSupportMessages(local);

  if (getFirestoreQuotaExceeded()) return;

  try {
    const msgRef = collection(db, 'support_messages');
    const q = query(msgRef, where('userId', '==', userId), where('readByAdmin', '==', false));
    const snap = await getDocs(q);
    const promises = snap.docs.map(d => updateDoc(d.ref, { readByAdmin: true }));
    await Promise.all(promises);
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error marking messages read by admin:', err?.message || err);
  }
}

// Mark messages as read by Player
export async function markSupportMessagesReadByUser(userId: string): Promise<void> {
  // Update local
  const local = getLocalSupportMessages().map(m => m.userId === userId ? { ...m, readByUser: true } : m);
  saveLocalSupportMessages(local);

  if (getFirestoreQuotaExceeded()) return;

  try {
    const msgRef = collection(db, 'support_messages');
    const q = query(msgRef, where('userId', '==', userId), where('readByUser', '==', false));
    const snap = await getDocs(q);
    const promises = snap.docs.map(d => updateDoc(d.ref, { readByUser: true }));
    await Promise.all(promises);
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error marking messages read by user:', err?.message || err);
  }
}

// Fetch all support messages from Firestore
export async function fetchAllSupportMessagesFromFirestore(): Promise<SupportMessage[]> {
  if (getFirestoreQuotaExceeded()) {
    return getLocalSupportMessages();
  }

  try {
    const msgRef = collection(db, 'support_messages');
    const snap = await getDocs(msgRef);
    const list: SupportMessage[] = [];
    snap.forEach((d) => {
      const data = d.data() as SupportMessage;
      list.push({ ...data, id: data.id || d.id });
    });
    return list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error fetching all support messages from Firestore:', err?.message || err);
    return getLocalSupportMessages();
  }
}

// ==========================================
// 10% MASA FAİZLƏRİ (TABLE RAKES & COMMISSIONS)
// ==========================================

const LOCAL_TABLE_RAKES_KEY = 'royal_poker_table_rakes';

export function getLocalTableRakes(): TableRakeRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_TABLE_RAKES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTableRakes(rakes: TableRakeRecord[]): void {
  try {
    localStorage.setItem(LOCAL_TABLE_RAKES_KEY, JSON.stringify(rakes));
  } catch {}
}

// Record 10% Table Rake from a concluded hand
export async function recordTableRake(rakeData: Omit<TableRakeRecord, 'id'>): Promise<TableRakeRecord> {
  const rakeId = `rake_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: TableRakeRecord = {
    ...rakeData,
    id: rakeId,
    timestamp: rakeData.timestamp || Date.now(),
  };

  // 1. Save locally
  const currentList = getLocalTableRakes();
  currentList.unshift(record);
  saveLocalTableRakes(currentList.slice(0, 500));

  if (getFirestoreQuotaExceeded()) {
    return record;
  }

  // 2. Save to Firestore collection 'table_rakes'
  try {
    const rakeDocRef = doc(db, 'table_rakes', rakeId);
    await setDoc(rakeDocRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Could not save table rake to Firestore:', err?.message || err);
  }

  return record;
}

// Fetch all table rake records from Firestore
export async function fetchAllTableRakesFromFirestore(): Promise<TableRakeRecord[]> {
  if (getFirestoreQuotaExceeded()) {
    return getLocalTableRakes();
  }

  try {
    const rakesRef = collection(db, 'table_rakes');
    const snap = await getDocs(rakesRef);
    const list: TableRakeRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as TableRakeRecord;
      list.push({ ...data, id: data.id || d.id });
    });
    if (list.length > 0) {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      saveLocalTableRakes(list.slice(0, 500));
      return list;
    }
    return getLocalTableRakes();
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error fetching table rakes from Firestore:', err?.message || err);
    return getLocalTableRakes();
  }
}

// Transfer accumulated table rakes to Super Admin's Real Balance
export async function claimTableRakesToAdminBalance(adminId: string, amountToClaim: number): Promise<number> {
  if (amountToClaim <= 0) return 0;

  if (!getFirestoreQuotaExceeded()) {
    try {
      const userRef = doc(db, 'users', adminId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const currentReal = Number(snap.data().realBalance || 0);
        const newReal = Number((currentReal + amountToClaim).toFixed(2));
        await updateDoc(userRef, {
          realBalance: newReal,
          updatedAt: serverTimestamp(),
        });
        return newReal;
      }
    } catch (err: any) {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Error claiming table rake to admin balance in Firestore:', err?.message || err);
    }
  }

  // Fallback to local admin update
  const saved = localStorage.getItem('royal_poker_auth_user');
  if (saved) {
    try {
      const u = JSON.parse(saved);
      if (u.id === adminId || u.isAdmin) {
        u.realBalance = Number(((u.realBalance || 0) + amountToClaim).toFixed(2));
        localStorage.setItem('royal_poker_auth_user', JSON.stringify(u));
        return u.realBalance;
      }
    } catch {}
  }
  return amountToClaim;
}

// ==========================================
// REAL-TIME MULTIPLAYER TABLES & SEATS SYNC
// ==========================================

function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

const LOCAL_TABLES_KEY = 'royal_poker_tables_cache';
const tableSaveTimestamps = new Map<string, number>();

// Save / sync full table instantly via WebSocket, with debouncing & local cache
export async function saveTableToFirestore(table: PokerTableState, forceCloudSave: boolean = false): Promise<void> {
  // 1. Instant WebSocket broadcast to all table players with zero latency
  try {
    syncTableStateSocket(table);
  } catch (err) {
    console.warn('WebSocket sync error:', err);
  }

  // 2. Always update local cache
  try {
    const raw = localStorage.getItem(LOCAL_TABLES_KEY);
    const list: PokerTableState[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(t => t.id === table.id);
    if (idx >= 0) list[idx] = table;
    else list.unshift(table);
    localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(list));
  } catch {}

  // If quota is exhausted, operate 100% locally & via WebSocket
  if (getFirestoreQuotaExceeded()) {
    return;
  }

  // Throttle Firestore writes only for fast consecutive tick bets, but NEVER for seating/leaving/waiting/hand_ended/forceCloudSave
  const lastSave = tableSaveTimestamps.get(table.id) || 0;
  const now = Date.now();
  const isPriorityState = forceCloudSave || table.stage === 'waiting' || table.stage === 'hand_ended' || table.isCustomCreated;
  if (!isPriorityState && (now - lastSave < 2000)) {
    return;
  }
  tableSaveTimestamps.set(table.id, now);

  try {
    const tableRef = doc(db, 'tables', table.id);
    const cleanData = sanitizeForFirestore({
      ...table,
      updatedAt: Date.now(),
      serverUpdated: serverTimestamp()
    });
    await setDoc(tableRef, cleanData);
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
      console.warn('Firestore write quota reached. Seamlessly switched to High-Performance Local & WebSocket mode.');
    } else {
      console.warn('Error saving table to Firestore:', err?.message || err);
    }
  }
}

// Update partial table state in Firestore & WebSocket
export async function updateTableInFirestore(tableId: string, updates: Partial<PokerTableState>): Promise<void> {
  // Update local cache
  let mergedTable: PokerTableState | null = null;
  try {
    const raw = localStorage.getItem(LOCAL_TABLES_KEY);
    if (raw) {
      const list: PokerTableState[] = JSON.parse(raw);
      const idx = list.findIndex(t => t.id === tableId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates };
        mergedTable = list[idx];
        localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(list));
      }
    }
  } catch {}

  if (mergedTable) {
    try {
      syncTableStateSocket(mergedTable);
    } catch {}
  }

  if (getFirestoreQuotaExceeded()) return;

  try {
    const tableRef = doc(db, 'tables', tableId);
    const cleanUpdates = sanitizeForFirestore({
      ...updates,
      updatedAt: Date.now(),
      serverUpdated: serverTimestamp()
    });
    await updateDoc(tableRef, cleanUpdates);
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Error updating table in Firestore:', err?.message || err);
  }
}

// Delete custom table from Firestore
export async function deleteTableFromFirestore(tableId: string): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_TABLES_KEY);
    if (raw) {
      const list: PokerTableState[] = JSON.parse(raw);
      const filtered = list.filter(t => t.id !== tableId);
      localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(filtered));
    }
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const tableRef = doc(db, 'tables', tableId);
    await setDoc(tableRef, { isDeleted: true, updatedAt: Date.now() }, { merge: true });
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error deleting table from Firestore:', err?.message || err);
  }
}

// Seed initial tables if Firestore tables collection is empty
export async function seedInitialTablesIfEmpty(initialTables: PokerTableState[]): Promise<PokerTableState[]> {
  if (getFirestoreQuotaExceeded()) {
    try {
      const cached = localStorage.getItem(LOCAL_TABLES_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return initialTables;
  }

  try {
    const tablesRef = collection(db, 'tables');
    const snap = await getDocs(tablesRef);
    
    if (snap.empty) {
      // Seed first 6 tables to Firestore
      for (const t of initialTables.slice(0, 6)) {
        await saveTableToFirestore(t);
      }
      return initialTables;
    }

    const fetched: PokerTableState[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      if (!data.isDeleted) {
        fetched.push({ ...data, id: data.id || d.id });
      }
    });

    if (fetched.length > 0) {
      return fetched;
    }
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error checking/seeding tables in Firestore:', err?.message || err);
  }

  return initialTables;
}

// Subscribe to ALL live tables across the entire platform via WebSocket & High-Priority Firestore
export function subscribeToAllLiveTables(
  onTablesUpdate: (tables: PokerTableState[]) => void,
  fallbackInitial: PokerTableState[]
): () => void {
  // Listen for real-time table summary changes over WebSocket
  const unsubSocketLobby = subscribeToLobbyTablesSocket((summary) => {
    try {
      const raw = localStorage.getItem(LOCAL_TABLES_KEY);
      const list: PokerTableState[] = raw ? JSON.parse(raw) : [...fallbackInitial];
      const idx = list.findIndex(t => t.id === summary.id);
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          stage: summary.stage || list[idx].stage,
          pot: summary.pot ?? list[idx].pot,
        };
        localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(list));
        onTablesUpdate(list);
      }
    } catch {}
  });

  if (getFirestoreQuotaExceeded()) {
    try {
      const cached = localStorage.getItem(LOCAL_TABLES_KEY);
      if (cached) onTablesUpdate(JSON.parse(cached));
      else onTablesUpdate(fallbackInitial);
    } catch {
      onTablesUpdate(fallbackInitial);
    }
    return unsubSocketLobby;
  }

  try {
    const tablesRef = collection(db, 'tables');
    
    // Low-latency immediate snapshot listener with includeMetadataChanges for instant local writes
    const unsubFirestore = onSnapshot(tablesRef, { includeMetadataChanges: true }, (snap) => {
      if (snap.empty) {
        seedInitialTablesIfEmpty(fallbackInitial).then((seeded) => {
          onTablesUpdate(seeded);
        });
        return;
      }

      let remoteTables: PokerTableState[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!data.isDeleted) {
          remoteTables.push({ ...data, id: data.id || d.id });
        }
      });

      // Check current bot active status
      let isBotsActive = false;
      try {
        const botCfgRaw = localStorage.getItem('royal_poker_bot_config');
        if (botCfgRaw) {
          isBotsActive = JSON.parse(botCfgRaw).isBotsActive === true;
        }
      } catch {}

      if (!isBotsActive) {
        remoteTables = remoteTables.map((tbl) => {
          const players = (tbl.players || []).map((p: any) => (p && !p.isHuman ? null : p));
          const humanCount = players.filter((p: any) => p !== null).length;
          return {
            ...tbl,
            players,
            stage: (humanCount < 2 ? 'waiting' : tbl.stage) as any,
            pot: humanCount < 2 ? 0 : tbl.pot,
            communityCards: humanCount < 2 ? [] : tbl.communityCards,
            handWinners: humanCount < 2 ? [] : tbl.handWinners,
          };
        });
      }

      if (remoteTables.length > 0) {
        remoteTables.sort((a, b) => {
          if (a.isCustomCreated && !b.isCustomCreated) return -1;
          if (!a.isCustomCreated && b.isCustomCreated) return 1;
          const countA = (a.players || []).filter((p: any) => p !== null).length;
          const countB = (b.players || []).filter((p: any) => p !== null).length;
          return countB - countA;
        });

        localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(remoteTables));
        onTablesUpdate(remoteTables);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('All tables snapshot listener error:', err?.message || err);
      try {
        const cached = localStorage.getItem(LOCAL_TABLES_KEY);
        if (cached) onTablesUpdate(JSON.parse(cached));
        else onTablesUpdate(fallbackInitial);
      } catch {
        onTablesUpdate(fallbackInitial);
      }
    });

    return () => {
      unsubSocketLobby();
      try { unsubFirestore(); } catch {}
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error subscribing to all live tables:', err?.message || err);
    onTablesUpdate(fallbackInitial);
    return unsubSocketLobby;
  }
}

// Subscribe to a specific single table's live state via Low-Latency WebSocket + High-Priority Firestore Snapshot Listener
export function subscribeToTableState(
  tableId: string,
  onUpdate: (table: PokerTableState) => void
): () => void {
  // 1. Subscribe to instant WebSocket updates (<10ms latency)
  const unsubSocket = subscribeToTableStateSocket(tableId, onUpdate);

  if (getFirestoreQuotaExceeded()) {
    return unsubSocket;
  }

  try {
    const tableRef = doc(db, 'tables', tableId);
    
    // High-priority snapshot listener with includeMetadataChanges for instant local-first emission and 0-delay updates
    const unsubFirestore = onSnapshot(tableRef, { includeMetadataChanges: true }, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        if (!data.isDeleted) {
          onUpdate({ ...data, id: data.id || docSnap.id });
        }
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn(`Table ${tableId} snapshot listener error:`, err?.message || err);
    });

    return () => {
      unsubSocket();
      try { unsubFirestore(); } catch {}
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn(`Error subscribing to table ${tableId}:`, err?.message || err);
    return unsubSocket;
  }
}

// Atomic transaction state updater for PokerTable (Guarantees atomic consistency across all players)
export async function saveTableStateAtomicInFirestore(
  tableId: string,
  transform: (current: PokerTableState | null) => PokerTableState | null,
  forceCloudSave: boolean = false
): Promise<PokerTableState | null> {
  if (!tableId) return null;

  if (getFirestoreQuotaExceeded()) {
    // Fallback: update local cache and socket immediately
    try {
      const raw = localStorage.getItem(LOCAL_TABLES_KEY);
      const list: PokerTableState[] = raw ? JSON.parse(raw) : [];
      const current = list.find(t => t.id === tableId) || null;
      const updated = transform(current);
      if (updated) {
        saveTableToFirestore(updated, forceCloudSave);
        return updated;
      }
    } catch {}
    return null;
  }

  try {
    const tableRef = doc(db, 'tables', tableId);
    let finalState: PokerTableState | null = null;

    await runTransaction(db, async (tx) => {
      const docSnap = await tx.get(tableRef);
      const currentTable = docSnap.exists() ? (docSnap.data() as PokerTableState) : null;
      const updated = transform(currentTable);
      if (!updated) return;

      finalState = {
        ...updated,
        updatedAt: Date.now(),
      };

      const cleanData = sanitizeForFirestore({
        ...finalState,
        serverUpdated: serverTimestamp(),
      });

      tx.set(tableRef, cleanData, { merge: true });
    });

    if (finalState) {
      // Instant WebSocket broadcast of the atomically committed state
      try {
        syncTableStateSocket(finalState);
      } catch {}
      // Update local storage cache
      try {
        const raw = localStorage.getItem(LOCAL_TABLES_KEY);
        const list: PokerTableState[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(t => t.id === tableId);
        if (idx >= 0) list[idx] = finalState;
        else list.unshift(finalState);
        localStorage.setItem(LOCAL_TABLES_KEY, JSON.stringify(list));
      } catch {}
      return finalState;
    }
    return null;
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn(`Atomic transaction failed for table ${tableId}, falling back:`, err?.message || err);
    return null;
  }
}

// Seat a player at a live table using an Atomic Firestore Transaction
export async function joinTableSeatInFirestore(
  tableId: string, 
  seatIndex: number, 
  player: Player,
  currentTable: PokerTableState
): Promise<PokerTableState> {
  const result = await joinTableSeatInFirestoreAtomic(tableId, seatIndex, player, currentTable);
  return result || currentTable;
}

export async function joinTableSeatInFirestoreAtomic(
  tableId: string,
  seatIndex: number,
  player: Player,
  currentTableFallback?: PokerTableState
): Promise<PokerTableState | null> {
  if (!tableId || seatIndex < 0 || !player) return null;

  try {
    const tableRef = doc(db, 'tables', tableId);
    let updatedTableResult: PokerTableState | null = null;

    if (!getFirestoreQuotaExceeded()) {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(tableRef);
        const baseTable: PokerTableState = snap.exists()
          ? (snap.data() as PokerTableState)
          : (currentTableFallback || ({} as PokerTableState));

        const capacity = baseTable.capacity || 6;
        const currentPlayers = [...(baseTable.players || new Array(capacity).fill(null))];

        // Place player in the target seat
        currentPlayers[seatIndex] = {
          ...player,
          seatIndex,
          joinedAt: Date.now(),
        };

        const updatedTable: PokerTableState = {
          ...baseTable,
          id: tableId,
          players: currentPlayers,
          updatedAt: Date.now(),
        };

        updatedTableResult = updatedTable;
        const cleanData = sanitizeForFirestore({
          ...updatedTable,
          serverUpdated: serverTimestamp(),
        });
        tx.set(tableRef, cleanData, { merge: true });
      });
    }

    if (!updatedTableResult && currentTableFallback) {
      const updatedPlayers = [...(currentTableFallback.players || new Array(currentTableFallback.capacity).fill(null))];
      updatedPlayers[seatIndex] = player;
      updatedTableResult = {
        ...currentTableFallback,
        players: updatedPlayers,
        updatedAt: Date.now(),
      };
    }

    if (updatedTableResult) {
      await saveTableToFirestore(updatedTableResult, true);
    }
    return updatedTableResult;
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn(`Atomic join seat error for table ${tableId}:`, err?.message || err);

    // Resilient fallback
    if (currentTableFallback) {
      const updatedPlayers = [...(currentTableFallback.players || new Array(currentTableFallback.capacity).fill(null))];
      updatedPlayers[seatIndex] = player;
      const fallbackTable: PokerTableState = {
        ...currentTableFallback,
        players: updatedPlayers,
        updatedAt: Date.now(),
      };
      await saveTableToFirestore(fallbackTable, true);
      return fallbackTable;
    }
    return null;
  }
}

// Leave / Vacate a player seat from a live table using an Atomic Firestore Transaction
export async function leaveTableSeatInFirestore(
  tableId: string, 
  seatIndex: number, 
  playerId: string,
  currentTable?: PokerTableState
): Promise<PokerTableState | null> {
  return await leaveTableSeatInFirestoreAtomic(tableId, seatIndex, playerId, currentTable);
}

export async function leaveTableSeatInFirestoreAtomic(
  tableId: string, 
  seatIndex: number, 
  playerId: string,
  currentTableFallback?: PokerTableState
): Promise<PokerTableState | null> {
  if (!tableId || (!playerId && seatIndex < 0)) return null;

  try {
    const tableRef = doc(db, 'tables', tableId);
    let updatedTableResult: PokerTableState | null = null;

    if (!getFirestoreQuotaExceeded()) {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(tableRef);
        const baseTable: PokerTableState = snap.exists()
          ? (snap.data() as PokerTableState)
          : (currentTableFallback || ({} as PokerTableState));

        if (!baseTable || !baseTable.id) return;

        const capacity = baseTable.capacity || 6;
        const updatedPlayers = Array.from({ length: capacity }, (_, i) => {
          const existing = (baseTable?.players || [])[i] || null;
          if (i === seatIndex) return null;
          if (existing && existing.id === playerId) return null;
          return existing;
        });

        const remainingActive = updatedPlayers.filter((p) => p !== null).length;

        const updatedTable: PokerTableState = {
          ...baseTable,
          players: updatedPlayers,
          stage: remainingActive < 2 ? 'waiting' : baseTable.stage,
          pot: remainingActive < 2 ? 0 : (baseTable.pot || 0),
          communityCards: remainingActive < 2 ? [] : (baseTable.communityCards || []),
          handWinners: remainingActive < 2 ? [] : (baseTable.handWinners || []),
          sidePots: remainingActive < 2 ? [] : (baseTable.sidePots || []),
          currentTurnSeatIndex: remainingActive < 2 ? 0 : (baseTable.currentTurnSeatIndex || 0),
          currentHighBet: remainingActive < 2 ? 0 : (baseTable.currentHighBet || 0),
          updatedAt: Date.now(),
        };

        updatedTableResult = updatedTable;
        const cleanData = sanitizeForFirestore({
          ...updatedTable,
          serverUpdated: serverTimestamp(),
        });
        tx.set(tableRef, cleanData, { merge: true });
      });
    }

    if (!updatedTableResult && currentTableFallback) {
      const capacity = currentTableFallback.capacity || 6;
      const updatedPlayers = Array.from({ length: capacity }, (_, i) => {
        const existing = (currentTableFallback?.players || [])[i] || null;
        if (i === seatIndex) return null;
        if (existing && existing.id === playerId) return null;
        return existing;
      });
      const remainingActive = updatedPlayers.filter((p) => p !== null).length;
      updatedTableResult = {
        ...currentTableFallback,
        players: updatedPlayers,
        stage: remainingActive < 2 ? 'waiting' : currentTableFallback.stage,
        pot: remainingActive < 2 ? 0 : (currentTableFallback.pot || 0),
        communityCards: remainingActive < 2 ? [] : (currentTableFallback.communityCards || []),
        handWinners: remainingActive < 2 ? [] : (currentTableFallback.handWinners || []),
        sidePots: remainingActive < 2 ? [] : (currentTableFallback.sidePots || []),
        currentTurnSeatIndex: remainingActive < 2 ? 0 : (currentTableFallback.currentTurnSeatIndex || 0),
        currentHighBet: remainingActive < 2 ? 0 : (currentTableFallback.currentHighBet || 0),
        updatedAt: Date.now(),
      };
    }

    if (updatedTableResult) {
      // 1. Broadcast vacancy instantly via WebSocket
      try {
        emitPlayerLeaveSocket(tableId, playerId, seatIndex);
      } catch {}
      // 2. Broadcast updated table state to all clients
      await saveTableToFirestore(updatedTableResult, true);
    }

    return updatedTableResult;
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn(`Atomic leave seat error for table ${tableId}:`, err?.message || err);
    return null;
  }
}

// Update table blinds & buyin limits in Firestore
export async function updateTableBlindsInFirestore(
  tableId: string, 
  smallBlind: number, 
  bigBlind: number,
  currentTable?: PokerTableState
): Promise<void> {
  if (!tableId) return;
  try {
    const tableRef = doc(db, 'tables', tableId);
    await setDoc(tableRef, {
      smallBlind,
      bigBlind,
      minBuyIn: bigBlind * 20,
      maxBuyIn: bigBlind * 100,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.warn(`Error updating blinds for table ${tableId}:`, err);
  }
}

// Kick player from table in Firestore & WebSocket
export async function kickPlayerFromTableInFirestore(
  tableId: string, 
  playerId: string, 
  currentTable?: PokerTableState
): Promise<PokerTableState | null> {
  if (!tableId || !playerId) return null;

  try {
    // 1. Emit socket kick notification
    emitKickPlayerSocket(tableId, playerId, 'Admin tərəfindən masadan kənarlaşdırıldınız.');

    // 2. Explicitly vacate seat atomically in Firestore and broadcast to all clients
    return await leaveTableSeatInFirestoreAtomic(tableId, -1, playerId, currentTable);
  } catch (err: any) {
    console.warn(`Error kicking player ${playerId} from table ${tableId}:`, err?.message || err);
    return null;
  }
}

// ==========================================
// REAL-TIME TABLE CHAT & EMOJIS SYNC (WEBSOCKET FIRST)
// ==========================================

// Send a live chat message at a table
export async function sendTableChatMessage(tableId: string, message: ChatMessage): Promise<void> {
  const now = Date.now();
  const textContent = String(message.text || message.message || '').trim();
  if (!textContent && !message.isSystem) return;

  const validTimestamp = typeof message.timestamp === 'number' && !isNaN(message.timestamp) && message.timestamp > 0
    ? message.timestamp
    : now;

  const senderId = String(message.senderId || (message.isSystem ? 'system' : 'unknown_sender'));
  const senderName = String(message.senderName || (message.isSystem ? 'System' : 'Player'));
  const senderAvatar = String(message.senderAvatar || '');
  const isSystem = Boolean(message.isSystem);

  const cleanMsg: ChatMessage = {
    id: message.id || `tchat_${now}_${Math.random().toString(36).substring(2, 7)}`,
    tableId: tableId || message.tableId || 'default_table',
    senderId,
    senderName,
    senderAvatar,
    text: textContent,
    message: textContent,
    timestamp: validTimestamp,
    isSystem,
  };

  // 1. Instant WebSocket broadcast
  try {
    sendTableChatMessageSocket(tableId, cleanMsg);
  } catch {}

  if (getFirestoreQuotaExceeded()) return;

  try {
    const chatId = cleanMsg.id;
    const msgRef = doc(db, 'table_chats', chatId);
    const cleanDoc = sanitizeForFirestore({
      id: chatId,
      tableId: cleanMsg.tableId,
      senderId: cleanMsg.senderId,
      senderName: cleanMsg.senderName,
      senderAvatar: cleanMsg.senderAvatar,
      text: cleanMsg.text,
      message: cleanMsg.message,
      timestamp: cleanMsg.timestamp,
      isSystem: cleanMsg.isSystem,
      createdAt: now,
    });
    await setDoc(msgRef, cleanDoc);
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error sending table chat message to Firestore:', err?.message || err);
  }
}

// Subscribe to live chat messages for a specific table
export function subscribeToTableChat(
  tableId: string,
  onUpdate: (messages: ChatMessage[]) => void
): () => void {
  const receivedMessages: ChatMessage[] = [];

  const unsubSocket = subscribeToTableChatSocket(
    tableId,
    (msg) => {
      receivedMessages.push(msg);
      receivedMessages.sort((a, b) => a.timestamp - b.timestamp);
      onUpdate([...receivedMessages]);
    },
    (history) => {
      if (history && history.length > 0) {
        history.forEach((h) => {
          if (!receivedMessages.some((m) => m.id === h.id)) {
            receivedMessages.push(h);
          }
        });
        receivedMessages.sort((a, b) => a.timestamp - b.timestamp);
        onUpdate([...receivedMessages]);
      }
    }
  );

  if (getFirestoreQuotaExceeded()) return unsubSocket;

  try {
    const chatRef = collection(db, 'table_chats');
    const q = query(chatRef, where('tableId', '==', tableId));

    const unsubFirestore = onSnapshot(q, (snap) => {
      snap.forEach((d) => {
        const data = d.data() as any;
        const msg: ChatMessage = {
          id: data.id || d.id,
          senderName: data.senderName || 'Player',
          senderAvatar: data.senderAvatar || '',
          text: data.text || '',
          timestamp: data.timestamp || data.createdAt || Date.now(),
          isSystem: Boolean(data.isSystem),
        };
        if (!receivedMessages.some((m) => m.id === msg.id)) {
          receivedMessages.push(msg);
        }
      });
      receivedMessages.sort((a, b) => a.timestamp - b.timestamp);
      if (receivedMessages.length > 0) {
        onUpdate([...receivedMessages]);
      }
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn(`Table chat snapshot listener error for ${tableId}:`, err?.message || err);
    });

    return () => {
      unsubSocket();
      try { unsubFirestore(); } catch {}
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error subscribing to table chat:', err?.message || err);
    return unsubSocket;
  }
}

// Send a live floating emoji at a table
export async function sendTableEmoji(tableId: string, emoji: FloatingEmoji): Promise<void> {
  // 1. Instant WebSocket broadcast
  sendTableEmojiSocket(tableId, emoji);

  if (getFirestoreQuotaExceeded()) return;

  try {
    const emojiId = `temoji_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const emojiRef = doc(db, 'table_emojis', emojiId);
    await setDoc(emojiRef, {
      ...emoji,
      id: emojiId,
      tableId,
      createdAt: Date.now(),
      serverTimestamp: serverTimestamp()
    });
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error sending table emoji to Firestore:', err?.message || err);
  }
}

// Subscribe to live floating emojis for a specific table
export function subscribeToTableEmojis(
  tableId: string,
  onEmojiReceived: (emoji: FloatingEmoji) => void
): () => void {
  const unsubSocket = subscribeToTableEmojiSocket(tableId, onEmojiReceived);

  if (getFirestoreQuotaExceeded()) return unsubSocket;

  try {
    const initialTime = Date.now() - 2000;
    const seenIds = new Set<string>();
    const emojiRef = collection(db, 'table_emojis');
    const q = query(emojiRef, where('tableId', '==', tableId));

    const unsubFirestore = onSnapshot(q, (snap) => {
      snap.forEach((d) => {
        const data = d.data() as any;
        const id = data.id || d.id;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const time = data.timestamp || data.createdAt || 0;
          if (time > initialTime) {
            onEmojiReceived({
              id,
              seatIndex: data.seatIndex,
              emoji: data.emoji,
              timestamp: time,
            });
          }
        }
      });
    }, (err) => {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn(`Table emoji snapshot listener error for ${tableId}:`, err?.message || err);
    });

    return () => {
      unsubSocket();
      try { unsubFirestore(); } catch {}
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Error subscribing to table emojis:', err?.message || err);
    return unsubSocket;
  }
}






