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
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, CurrencyType, GOLDEN_ACE_AVATAR, TableRakeRecord } from '../types/poker';

export const ADMIN_EMAIL = 'nmehman659@gmail.com';
export const ADMIN_SECRET_PASSWORD = '#M557725368@';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() || email.trim().toLowerCase() === 'admin@royalpoker.com';
}

export function checkAdminPassword(password: string): boolean {
  return password.trim() === ADMIN_SECRET_PASSWORD;
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
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      experimentalForceLongPolling: true,
    }, dbId);
  } catch {
    return getFirestore(app, dbId);
  }
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
        await updateDoc(userRef, { ...adminProfile });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(adminProfile));
        return adminProfile;
      }

      if (additionalData && Object.keys(additionalData).length > 0) {
        await updateDoc(userRef, { ...additionalData });
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

    await setDoc(userRef, newProfile);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newProfile));
    return newProfile;
  } catch (err) {
    console.warn('Firestore sync fallback:', err);
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

    try {
      await setDoc(userRef, {
        ...newProfile,
        passHash: hashPassword(pass)
      });
    } catch (err) {
      console.warn('Could not write user to Firestore:', err);
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
      console.warn('Firestore lookup error:', err);
    }

    // Check local cached account
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const cachedUser = JSON.parse(cached) as UserProfile;
      if (cachedUser.email.toLowerCase() === cleanEmail) {
        return cachedUser;
      }
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
  } catch (err) {
    console.warn('Error updating balance in Firestore:', err);
  }
}

// Fetch all registered users from Firestore for Admin Panel
export async function fetchAllUsersFromFirestore(): Promise<UserProfile[]> {
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
    return users;
  } catch (err) {
    console.warn('Error fetching all users from Firestore:', err);
    return [];
  }
}

// Update user by Admin in Firestore
export async function adminUpdateUserInFirestore(userId: string, updates: Partial<UserProfile>) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, updates);
  } catch (err) {
    console.warn('Error admin updating user in Firestore:', err);
  }
}

// Save deposit request to Firestore
export async function saveDepositToFirestore(deposit: any) {
  try {
    const depRef = doc(db, 'deposits', deposit.id);
    await setDoc(depRef, {
      ...deposit,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Error saving deposit to Firestore:', err);
  }
}

// Fetch all deposits from Firestore
export async function fetchAllDepositsFromFirestore(): Promise<any[]> {
  try {
    const depsRef = collection(db, 'deposits');
    const snap = await getDocs(depsRef);
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({ ...data, id: data.id || d.id });
    });
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.warn('Error fetching deposits from Firestore:', err);
    return [];
  }
}

// Update deposit status in Firestore
export async function updateDepositStatusInFirestore(depositId: string, status: 'pending' | 'completed' | 'rejected') {
  try {
    const depRef = doc(db, 'deposits', depositId);
    await updateDoc(depRef, { 
      status, 
      reviewedAt: Date.now(),
      updatedAt: serverTimestamp() 
    });
  } catch (err) {
    console.warn('Error updating deposit in Firestore:', err);
  }
}

// Approve deposit: updates deposit record and increments player's real balance in Firestore
export async function approveDepositInFirestore(depositId: string, userId: string, amount: number) {
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
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (err) {
    console.warn('Error approving deposit in Firestore:', err);
  }
}

// Subscribe to a specific user's live profile changes in Firestore
export function subscribeToUserProfile(userId: string, onUpdate: (user: UserProfile) => void) {
  try {
    const userRef = doc(db, 'users', userId);
    return onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        onUpdate({ ...data, id: data.id || docSnap.id });
      }
    }, (err) => console.warn('User profile snapshot error:', err));
  } catch (err) {
    console.warn('Error subscribing to user profile:', err);
    return () => {};
  }
}

// Save withdrawal request to Firestore
export async function saveWithdrawalToFirestore(withdrawal: any) {
  try {
    const withRef = doc(db, 'withdrawals', withdrawal.id);
    await setDoc(withRef, {
      ...withdrawal,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Error saving withdrawal to Firestore:', err);
  }
}

// Fetch all withdrawals from Firestore
export async function fetchAllWithdrawalsFromFirestore(): Promise<any[]> {
  try {
    const withsRef = collection(db, 'withdrawals');
    const snap = await getDocs(withsRef);
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({ ...data, id: data.id || d.id });
    });
    return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.warn('Error fetching withdrawals from Firestore:', err);
    return [];
  }
}

// Update withdrawal status in Firestore
export async function updateWithdrawalStatusInFirestore(withdrawalId: string, status: 'approved' | 'rejected') {
  try {
    const withRef = doc(db, 'withdrawals', withdrawalId);
    await updateDoc(withRef, { status, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn('Error updating withdrawal in Firestore:', err);
  }
}

// Save system config to Firestore
export async function saveSystemConfigToFirestore(cfg: any) {
  try {
    const cfgRef = doc(db, 'system_config', 'main');
    await setDoc(cfgRef, { ...cfg, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn('Error saving system config to Firestore:', err);
  }
}

// Fetch system config from Firestore
export async function fetchSystemConfigFromFirestore(): Promise<any | null> {
  try {
    const cfgRef = doc(db, 'system_config', 'main');
    const snap = await getDoc(cfgRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn('Error fetching system config from Firestore:', err);
    return null;
  }
}

// Save bot system configuration to Firestore
export async function saveBotSystemConfigToFirestore(cfg: any) {
  try {
    const cfgRef = doc(db, 'system_config', 'bot_settings');
    await setDoc(cfgRef, { ...cfg, updatedAt: serverTimestamp() });
    localStorage.setItem('royal_poker_bot_config', JSON.stringify(cfg));
  } catch (err) {
    console.warn('Error saving bot system config to Firestore:', err);
    localStorage.setItem('royal_poker_bot_config', JSON.stringify(cfg));
  }
}

// Fetch bot system configuration from Firestore
export async function fetchBotSystemConfigFromFirestore(): Promise<any | null> {
  try {
    const cfgRef = doc(db, 'system_config', 'bot_settings');
    const snap = await getDoc(cfgRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('Error fetching bot system config from Firestore:', err);
  }
  const local = localStorage.getItem('royal_poker_bot_config');
  if (local) {
    try { return JSON.parse(local); } catch {}
  }
  // Default pro configuration as requested!
  return {
    isBotsActive: true,
    botDifficulty: 'pro',
    autoJoinLeaveEnabled: true,
    minThinkSeconds: 4,
    maxThinkSeconds: 9,
    targetTableOccupancy: 4,
  };
}

// Subscribe to real-time bot settings
export function subscribeToBotSystemConfig(callback: (config: any) => void) {
  try {
    const cfgRef = doc(db, 'system_config', 'bot_settings');
    return onSnapshot(cfgRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        localStorage.setItem('royal_poker_bot_config', JSON.stringify(data));
        callback(data);
      }
    }, (err) => console.warn('Bot config snapshot listener error:', err));
  } catch (err) {
    console.warn('Error subscribing to bot config:', err);
    return () => {};
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
    }, (err) => console.warn('Users snapshot listener error:', err));
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
    }, (err) => console.warn('Deposits snapshot listener error:', err));
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
    }, (err) => console.warn('Withdrawals snapshot listener error:', err));
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
    }, (err) => console.warn('Support messages snapshot listener error:', err));
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
    }, (err) => console.warn('Table rakes snapshot listener error:', err));
    unsubs.push(unsubRakes);

    // 6. Bot Settings real-time listener
    const botCfgRef = doc(db, 'system_config', 'bot_settings');
    const unsubBotCfg = onSnapshot(botCfgRef, (snap) => {
      if (snap.exists() && callbacks.onBotConfigChange) {
        callbacks.onBotConfigChange(snap.data());
      }
    }, (err) => console.warn('Bot config snapshot listener error:', err));
    unsubs.push(unsubBotCfg);
  } catch (err) {
    console.warn('Error subscribing to realtime admin data:', err);
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

  // 2. Save to Firestore
  try {
    const msgRef = doc(db, 'support_messages', msgId);
    await setDoc(msgRef, {
      ...message,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('Could not save support message to Firestore:', err);
  }

  return message;
}

// Subscribe to messages for a specific player
export function subscribeToPlayerSupportMessages(userId: string, callback: (messages: SupportMessage[]) => void): () => void {
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
      console.warn('Player support messages snapshot error:', err);
      const local = getLocalSupportMessages().filter(m => m.userId === userId);
      callback(local);
    });
  } catch (err) {
    console.warn('Error subscribing to player support messages:', err);
    const local = getLocalSupportMessages().filter(m => m.userId === userId);
    callback(local);
    return () => {};
  }
}

// Mark messages as read by Admin
export async function markSupportMessagesReadByAdmin(userId: string): Promise<void> {
  try {
    const msgRef = collection(db, 'support_messages');
    const q = query(msgRef, where('userId', '==', userId), where('readByAdmin', '==', false));
    const snap = await getDocs(q);
    const promises = snap.docs.map(d => updateDoc(d.ref, { readByAdmin: true }));
    await Promise.all(promises);
  } catch (err) {
    console.warn('Error marking messages read by admin:', err);
  }

  // Update local
  const local = getLocalSupportMessages().map(m => m.userId === userId ? { ...m, readByAdmin: true } : m);
  saveLocalSupportMessages(local);
}

// Mark messages as read by Player
export async function markSupportMessagesReadByUser(userId: string): Promise<void> {
  try {
    const msgRef = collection(db, 'support_messages');
    const q = query(msgRef, where('userId', '==', userId), where('readByUser', '==', false));
    const snap = await getDocs(q);
    const promises = snap.docs.map(d => updateDoc(d.ref, { readByUser: true }));
    await Promise.all(promises);
  } catch (err) {
    console.warn('Error marking messages read by user:', err);
  }

  // Update local
  const local = getLocalSupportMessages().map(m => m.userId === userId ? { ...m, readByUser: true } : m);
  saveLocalSupportMessages(local);
}

// Fetch all support messages from Firestore
export async function fetchAllSupportMessagesFromFirestore(): Promise<SupportMessage[]> {
  try {
    const msgRef = collection(db, 'support_messages');
    const snap = await getDocs(msgRef);
    const list: SupportMessage[] = [];
    snap.forEach((d) => {
      const data = d.data() as SupportMessage;
      list.push({ ...data, id: data.id || d.id });
    });
    return list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } catch (err) {
    console.warn('Error fetching all support messages from Firestore:', err);
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
  // Keep up to 500 recent rake records
  saveLocalTableRakes(currentList.slice(0, 500));

  // 2. Save to Firestore collection 'table_rakes'
  try {
    const rakeDocRef = doc(db, 'table_rakes', rakeId);
    await setDoc(rakeDocRef, {
      ...record,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Could not save table rake to Firestore:', err);
  }

  return record;
}

// Fetch all table rake records from Firestore
export async function fetchAllTableRakesFromFirestore(): Promise<TableRakeRecord[]> {
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
  } catch (err) {
    console.warn('Error fetching table rakes from Firestore:', err);
    return getLocalTableRakes();
  }
}

// Transfer accumulated table rakes to Super Admin's Real Balance
export async function claimTableRakesToAdminBalance(adminId: string, amountToClaim: number): Promise<number> {
  if (amountToClaim <= 0) return 0;

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
  } catch (err) {
    console.warn('Error claiming table rake to admin balance in Firestore:', err);
  }

  // Fallback to local admin update
  const saved = localStorage.getItem('royal_poker_auth_user');
  if (saved) {
    const u = JSON.parse(saved);
    if (u.id === adminId || u.isAdmin) {
      u.realBalance = Number(((u.realBalance || 0) + amountToClaim).toFixed(2));
      localStorage.setItem('royal_poker_auth_user', JSON.stringify(u));
      return u.realBalance;
    }
  }
  return amountToClaim;
}




