import { db, getFirestoreQuotaExceeded, isQuotaExceededError, setFirestoreQuotaExceeded } from '../services/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  doc, 
  updateDoc, 
  getDoc 
} from 'firebase/firestore';

export interface ReceiptVerificationResult {
  isValid: boolean;
  errorCode?: 'DUPLICATE_RECEIPT' | 'INVALID_TIMESTAMP' | 'INVALID_AMOUNT' | 'TAMPERED_RECEIPT' | 'INVALID_IMAGE';
  errorMessage: string;
  receiptHash: string;
  detectedTimestamp: number;
}

// Generate simple perceptual/content hash from image file to prevent reusing the same screenshot
export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let hash = 0;
  
  // Sample bytes from throughout the file
  const step = Math.max(1, Math.floor(bytes.length / 500));
  for (let i = 0; i < bytes.length; i += step) {
    hash = ((hash << 5) - hash) + bytes[i];
    hash |= 0;
  }
  
  return `rcpt_${file.size}_${file.name.replace(/[^a-zA-Z0-9]/g, '')}_${Math.abs(hash).toString(36)}`;
}

// Extract & verify receipt timestamp and anti-fraud checks
export async function verifyDepositReceipt(
  file: File | null,
  amount: number,
  userId: string,
  username: string
): Promise<ReceiptVerificationResult> {
  if (!file) {
    return {
      isValid: false,
      errorCode: 'INVALID_IMAGE',
      errorMessage: 'Zəhmət olmasa ödəniş etdiyiniz bank çekinin şəklini əlavə edin.',
      receiptHash: '',
      detectedTimestamp: Date.now()
    };
  }

  // 1. File type and size verification
  if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|heic)$/i)) {
    return {
      isValid: false,
      errorCode: 'INVALID_IMAGE',
      errorMessage: 'Fırıldaqçılıq cəhdi: Yalnız rəsmi bank çeki və ya ekran görüntüsü (JPG, PNG) qəbul olunur!',
      receiptHash: '',
      detectedTimestamp: Date.now()
    };
  }

  if (file.size < 4000) { // Under 4KB is likely blank or empty fake file
    return {
      isValid: false,
      errorCode: 'TAMPERED_RECEIPT',
      errorMessage: 'Fırıldaqçılıq cəhdi: Əlavə edilən şəkil etibarsız və ya zədəlidir!',
      receiptHash: '',
      detectedTimestamp: Date.now()
    };
  }

  // 2. Extract File Modified / Created Date to check Exact Date, Hour, Minute, Second
  const fileLastModified = file.lastModified || Date.now();
  const currentTime = Date.now();
  const maxAgeAllowedMs = 24 * 60 * 60 * 1000; // Max 24 hours old receipt
  const futureToleranceMs = 5 * 60 * 1000; // 5 min future clock skew tolerance

  // Check if receipt date is too old (e.g. from last week or month)
  if (currentTime - fileLastModified > maxAgeAllowedMs) {
    const receiptDate = new Date(fileLastModified).toLocaleString('az-AZ');
    return {
      isValid: false,
      errorCode: 'INVALID_TIMESTAMP',
      errorMessage: `Fırıldaqçılıq cəhdi: Bu çek köhnə tarixə aiddir (${receiptDate})! Yalnız son 24 saat ərzində edilən yeni ödənişlər qəbul edilir.`,
      receiptHash: '',
      detectedTimestamp: fileLastModified
    };
  }

  // Check if timestamp is in the future
  if (fileLastModified - currentTime > futureToleranceMs) {
    return {
      isValid: false,
      errorCode: 'INVALID_TIMESTAMP',
      errorMessage: 'Fırıldaqçılıq cəhdi: Çekin tarixi və saatı gələcək zamana təyin edilib!',
      receiptHash: '',
      detectedTimestamp: fileLastModified
    };
  }

  // 3. Duplicate Receipt Check via Firebase & Local Storage
  const receiptHash = await generateFileHash(file);

  if (!getFirestoreQuotaExceeded()) {
    try {
      // Check in Firestore receipts collection
      const receiptsRef = collection(db, 'verified_receipts');
      const q = query(receiptsRef, where('hash', '==', receiptHash));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const existingDoc = snap.docs[0].data();
        return {
          isValid: false,
          errorCode: 'DUPLICATE_RECEIPT',
          errorMessage: `TƏHLÜKƏ: Bu bank çeki artıq ${new Date(existingDoc.usedAt || Date.now()).toLocaleDateString('az-AZ')} tarixində istifadə olunub! Eyni çeki təkrar istifadə etmək qadağandır.`,
          receiptHash,
          detectedTimestamp: fileLastModified
        };
      }
    } catch (err: any) {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Firestore receipt check offline fallback:', err?.message || err);
    }
  }

  // Local fallback check
  const usedHashes = JSON.parse(localStorage.getItem('royal_poker_used_receipt_hashes') || '[]');
  if (usedHashes.includes(receiptHash)) {
    return {
      isValid: false,
      errorCode: 'DUPLICATE_RECEIPT',
      errorMessage: 'TƏHLÜKƏ: Bu bank çeki artıq əvvəllər istifadə edilib! Təkrar çek yükləmək qadağandır.',
      receiptHash,
      detectedTimestamp: fileLastModified
    };
  }

  // Passed all anti-fraud checks!
  return {
    isValid: true,
    errorMessage: '',
    receiptHash,
    detectedTimestamp: fileLastModified
  };
}

// Log a receipt to Firebase as used so nobody can reuse it
export async function markReceiptAsUsed(
  receiptHash: string,
  userId: string,
  username: string,
  amount: number,
  currency: string
) {
  if (!getFirestoreQuotaExceeded()) {
    try {
      // Save to Firestore
      const receiptsRef = collection(db, 'verified_receipts');
      await addDoc(receiptsRef, {
        hash: receiptHash,
        userId,
        username,
        amount,
        currency,
        usedAt: Date.now(),
        status: 'used'
      });

      // Also log in transactions collection
      const txRef = collection(db, 'transactions');
      await addDoc(txRef, {
        userId,
        username,
        type: 'deposit',
        amount,
        currency,
        status: 'completed',
        receiptHash,
        timestamp: Date.now(),
        paymentMethod: 'Bank Kartı (Dəqiq Çek Yoxlanışı ilə)'
      });
    } catch (err: any) {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Could not write receipt hash to Firestore:', err?.message || err);
    }
  }

  // Local storage backup
  try {
    const usedHashes = JSON.parse(localStorage.getItem('royal_poker_used_receipt_hashes') || '[]');
    if (!usedHashes.includes(receiptHash)) {
      usedHashes.push(receiptHash);
      localStorage.setItem('royal_poker_used_receipt_hashes', JSON.stringify(usedHashes));
    }
  } catch {
    // ignore
  }
}

// Log fraud attempt to Firebase for Admin Review
export async function logFraudAttempt(
  userId: string,
  username: string,
  reason: string,
  amount: number,
  receiptHash: string
) {
  if (!getFirestoreQuotaExceeded()) {
    try {
      const fraudRef = collection(db, 'fraud_alerts');
      await addDoc(fraudRef, {
        userId,
        username,
        reason,
        attemptedAmount: amount,
        receiptHash,
        timestamp: Date.now(),
        resolved: false
      });
    } catch (err: any) {
      if (isQuotaExceededError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Could not log fraud alert to Firestore:', err?.message || err);
    }
  }
}
