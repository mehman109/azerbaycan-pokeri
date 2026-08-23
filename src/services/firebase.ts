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
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, CurrencyType, GOLDEN_ACE_AVATAR } from '../types/poker';

export const ADMIN_EMAIL = 'nmehman659@gmail.com';

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
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
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
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
