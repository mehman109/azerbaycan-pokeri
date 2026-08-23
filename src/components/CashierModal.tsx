import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, WalletTransaction, CurrencyType } from '../types/poker';
import { translations, Language } from '../utils/translations';
import { 
  X, 
  ArrowDownRight, 
  ArrowUpRight, 
  CreditCard, 
  Wallet, 
  History, 
  Gift, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Check,
  Upload,
  FileCheck,
  Info,
  Flame,
  Clock,
  Hourglass,
  Loader2,
  Trash2
} from 'lucide-react';
import { soundManager } from '../utils/audioEngine';
import confetti from 'canvas-confetti';
import { adminStorage } from '../utils/adminStore';
import { DepositPaymentModal } from './DepositPaymentModal';
import { updateUserBalanceInFirebase, saveDepositToFirestore, saveWithdrawalToFirestore } from '../services/firebase';

interface PendingDeposit {
  id: string;
  amount: number;
  currency: CurrencyType;
  receiptName: string;
  receiptPreviewUrl?: string | null;
  createdAt: number;
  targetTimestamp: number;
  status: 'processing' | 'completed';
}

interface CashierModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: UserProfile;
  onUpdateBalance: (
    newRealBalance: number,
    newPlayBalance: number,
    newBonusBalance?: number,
    claimedSpecialBonus?: boolean,
    questStartTime?: number,
    turnoverCompleted?: boolean
  ) => void;
}

export const CashierModal: React.FC<CashierModalProps> = ({
  isOpen,
  onClose,
  lang,
  user,
  onUpdateBalance,
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [depositInput, setDepositInput] = useState<string>('');
  const [withdrawInput, setWithdrawInput] = useState<string>('');
  const [withdrawCardNumber, setWithdrawCardNumber] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDepositPaymentModalOpen, setIsDepositPaymentModalOpen] = useState(false);

  // Dynamic Official Card from Admin Storage
  const adminConfig = adminStorage.getConfig();
  const officialCardNumber = adminConfig.officialCardNumber || '5411 2498 1229 0497';
  const officialCardHolder = adminConfig.officialCardHolder || 'ROYAL POKER OFFICIAL';
  const officialBank = adminConfig.officialBank || 'Kapital Bank / ABB / Visa Direct';

  // Pending Deposits (3-minute automatic settlement queue)
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>(() => {
    try {
      const saved = localStorage.getItem('royal_poker_pending_deposits');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [transactions, setTransactions] = useState<WalletTransaction[]>([
    {
      id: 'tx_98124',
      type: 'deposit',
      amount: 150,
      currency: user.currency,
      timestamp: Date.now() - 3600000 * 24,
      status: 'completed',
      paymentMethod: 'Bank Kartı (Çek Təsdiqi)',
    },
    {
      id: 'tx_98125',
      type: 'buy_in',
      amount: -50,
      currency: user.currency,
      timestamp: Date.now() - 3600000 * 12,
      status: 'completed',
      paymentMethod: "Table: Baku High Stakes",
    },
    {
      id: 'tx_98126',
      type: 'bonus',
      amount: 5,
      currency: user.currency,
      timestamp: Date.now() - 3600000 * 4,
      status: 'completed',
      paymentMethod: "Xoş Gəldin Bonusu",
    },
  ]);

  // Live clock for second-by-second countdown (48h quest & 3-minute deposit settlement)
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);

      // Check if any pending deposits completed 3-minute duration
      setPendingDeposits((prev) => {
        let hasChanges = false;
        const next = prev.map((item) => {
          if (item.status === 'processing' && now >= item.targetTimestamp) {
            hasChanges = true;
            // Automatically add verified deposit amount directly to user's real balance
            const newReal = user.realBalance + item.amount;
            onUpdateBalance(newReal, user.playMoneyBalance, user.bonusBalance);
            soundManager.playWinSound();
            confetti({ particleCount: 85, spread: 80, origin: { y: 0.5 } });

            setNotification({
              text: lang === 'az'
                ? `🎉 Təbriklər! $${item.amount.toFixed(2)} məbləğində depozitiniz təsdiqləndi və Real Balansınıza əlavə edildi!`
                : `🎉 Congratulations! $${item.amount.toFixed(2)} deposit has been confirmed and added to your Real Balance!`,
              type: 'success',
            });
            setTimeout(() => setNotification(null), 6000);

            // Update transactions list
            setTransactions((txs) => [
              {
                id: `tx_${item.id.slice(-6)}`,
                type: 'deposit',
                amount: item.amount,
                currency: item.currency,
                timestamp: now,
                status: 'completed',
                paymentMethod: `Bank Çeki • 3 Dəqiqə Təsdiqi ($${item.amount.toFixed(2)})`,
              },
              ...txs.filter((t) => t.id !== `tx_pending_${item.id.slice(-6)}`),
            ]);

            return { ...item, status: 'completed' as const };
          }
          return item;
        });

        if (hasChanges) {
          try {
            localStorage.setItem('royal_poker_pending_deposits', JSON.stringify(next));
          } catch {
            // ignore
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [user.realBalance, user.playMoneyBalance, user.bonusBalance, onUpdateBalance, lang]);

  if (!isOpen) return null;

  const parsedDeposit = parseFloat(depositInput);
  const isDepositValid = !isNaN(parsedDeposit) && parsedDeposit >= 5 && parsedDeposit <= 2500;
  const isDepositUnderMin = !isNaN(parsedDeposit) && parsedDeposit > 0 && parsedDeposit < 5;
  const isDepositOverMax = !isNaN(parsedDeposit) && parsedDeposit > 2500;

  // Withdrawal Validation: Min $15, Max $6000, and <= user.realBalance
  const parsedWithdraw = parseFloat(withdrawInput);
  const isWithdrawValid = !isNaN(parsedWithdraw) && parsedWithdraw >= 15 && parsedWithdraw <= 6000 && parsedWithdraw <= user.realBalance;
  const isWithdrawUnderMin = !isNaN(parsedWithdraw) && parsedWithdraw > 0 && parsedWithdraw < 15;
  const isWithdrawOverMax = !isNaN(parsedWithdraw) && parsedWithdraw > 6000;
  const isWithdrawExceedsBalance = !isNaN(parsedWithdraw) && parsedWithdraw > user.realBalance;

  // Trigger Payment Modal Handler
  const handleOpenDepositModal = () => {
    if (!isDepositValid) {
      soundManager.playButtonClick();
      setNotification({
        text: lang === 'az'
          ? '⚠️ Zəhmət olmasa düzgün depozit məbləği daxil edin (Minimum $5, Maksimum $2,500)!'
          : '⚠️ Please enter a valid deposit amount (Min $5, Max $2,500)!',
        type: 'error',
      });
      setTimeout(() => setNotification(null), 3500);
      return;
    }

    soundManager.playButtonClick();
    setIsDepositPaymentModalOpen(true);
  };

  // Called when user clicks "Ödənişi etdim" inside DepositPaymentModal
  const handleCompletePaymentFromModal = (
    receiptFile: File | null, 
    previewUrl: string | null, 
    detectedDate?: number
  ) => {
    const verifiedTime = detectedDate || Date.now();

    // 1. INSTANTLY add verified deposit amount directly to user's real balance
    const newRealBalance = user.realBalance + parsedDeposit;
    onUpdateBalance(newRealBalance, user.playMoneyBalance, user.bonusBalance);
    updateUserBalanceInFirebase(user.id, newRealBalance, user.playMoneyBalance, user.bonusBalance);

    soundManager.playWinSound();
    confetti({ particleCount: 100, spread: 85, origin: { y: 0.5 } });

    // 2. Add Completed Transaction
    const newTx: WalletTransaction = {
      id: `tx_dep_${Date.now().toString().slice(-6)}`,
      type: 'deposit',
      amount: parsedDeposit,
      currency: user.currency,
      timestamp: verifiedTime,
      status: 'completed',
      paymentMethod: `Bank Çeki (Dəqiq Tarix & Anti-Fırıldaqçılıq Yoxlanıldı)`,
    };
    setTransactions([newTx, ...transactions]);

    // Record in Admin storage & Firestore
    const depRecord = {
      id: `dep_${Date.now()}`,
      userId: user.id,
      username: user.username,
      amount: parsedDeposit,
      currency: user.currency,
      receiptName: receiptFile?.name || 'bank_receipt.png',
      receiptPreviewUrl: previewUrl,
      createdAt: verifiedTime,
      targetTimestamp: verifiedTime,
      status: 'completed' as const,
    };
    const adminDeps = adminStorage.getPendingDeposits();
    adminDeps.unshift(depRecord);
    adminStorage.savePendingDeposits(adminDeps);
    saveDepositToFirestore(depRecord);

    // Clear input
    setDepositInput('');

    const formattedTime = new Date(verifiedTime).toLocaleTimeString('az-AZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    setNotification({
      text: lang === 'az'
        ? `🎉 Depozit çekiniz Firebase tərəfindən uğurla yoxlanıldı (${formattedTime}) və +$${parsedDeposit.toFixed(2)} məbləğ Real Balansınıza DƏRHAL əlavə edildi!`
        : `🎉 Receipt verified by Firebase (${formattedTime}) and +$${parsedDeposit.toFixed(2)} added to Real Balance INSTANTLY!`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 6000);
  };

  // Withdraw Handler - Validates Min $15, Max $6000 & balance, and deducts the exact amount
  const handleWithdraw = () => {
    if (!isWithdrawValid) {
      soundManager.playButtonClick();
      if (isWithdrawUnderMin) {
        setNotification({
          text: lang === 'az' ? '⚠️ Minimum çıxarış məbləği $15.00-dir!' : '⚠️ Minimum withdrawal is $15.00!',
          type: 'error',
        });
      } else if (isWithdrawOverMax) {
        setNotification({
          text: lang === 'az' ? '⚠️ Maksimum çıxarış məbləği $6,000.00-dir!' : '⚠️ Maximum withdrawal is $6,000.00!',
          type: 'error',
        });
      } else if (isWithdrawExceedsBalance) {
        setNotification({
          text: lang === 'az' 
            ? `⚠️ Çıxarış ləğv edildi! Real balansınızda ($${user.realBalance.toFixed(2)}) kifayət qədər vəsait yoxdur. Balansınızdan artıq məbləğ çıxara bilməzsiniz!`
            : `⚠️ Withdrawal rejected! Insufficient real balance ($${user.realBalance.toFixed(2)}). You cannot withdraw more than your balance!`,
          type: 'error',
        });
      } else if (!withdrawCardNumber.trim() || withdrawCardNumber.trim().length < 8) {
        setNotification({
          text: lang === 'az' ? '⚠️ Zəhmət olmasa vəsaitin köçürüləcəyi düzgün bank kartı nömrəsini daxil edin!' : '⚠️ Please enter a valid destination bank card number!',
          type: 'error',
        });
      } else {
        setNotification({
          text: lang === 'az' ? '⚠️ Düzgün çıxarış məbləği qeyd edin ($15 - $6,000)!' : '⚠️ Please enter a valid withdrawal amount ($15 - $6,000)!',
          type: 'error',
        });
      }
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    if (!withdrawCardNumber.trim() || withdrawCardNumber.trim().length < 8) {
      soundManager.playButtonClick();
      setNotification({
        text: lang === 'az' ? '⚠️ Zəhmət olmasa vəsaitin köçürüləcəyi düzgün bank kartı nömrəsini daxil edin!' : '⚠️ Please enter a valid destination bank card number!',
        type: 'error',
      });
      setTimeout(() => setNotification(null), 3500);
      return;
    }

    soundManager.playChipSound();
    
    // Deduct exact withdrawal amount from user's real balance and sync with Firebase
    const newRealBalance = user.realBalance - parsedWithdraw;
    onUpdateBalance(newRealBalance, user.playMoneyBalance, user.bonusBalance);
    updateUserBalanceInFirebase(user.id, newRealBalance, user.playMoneyBalance, user.bonusBalance);

    // Record in Admin storage & Firestore
    const withRecord = {
      id: `wth_${Date.now().toString().slice(-6)}`,
      userId: user.id,
      username: user.username,
      cardNumber: withdrawCardNumber.trim(),
      bankName: 'Kapital Bank / ABB / Leobank / Visa',
      amount: parsedWithdraw,
      currency: user.currency,
      status: 'pending' as const,
      createdAt: Date.now(),
    };
    adminStorage.addWithdrawalRequest(withRecord);
    saveWithdrawalToFirestore(withRecord);

    const newTx: WalletTransaction = {
      id: `tx_${Date.now().toString().slice(-6)}`,
      type: 'withdraw',
      amount: -parsedWithdraw,
      currency: user.currency,
      timestamp: Date.now(),
      status: 'completed',
      paymentMethod: `Bank Kartı (${withdrawCardNumber.trim().slice(-4)})`,
    };
    setTransactions([newTx, ...transactions]);

    setWithdrawInput('');
    setNotification({
      text: lang === 'az'
        ? `✅ -$${parsedWithdraw.toFixed(2)} çıxarış sorğusu qəbul edildi və Real Balansınızdan çıxıldı! Vəsait ${withdrawCardNumber.trim().slice(-4)} sonluqlu karta köçürüləcək.`
        : `✅ -$${parsedWithdraw.toFixed(2)} withdrawal processed and deducted from Real Balance! Funds will be sent to card ending in ${withdrawCardNumber.trim().slice(-4)}.`,
      type: 'success',
    });
    setTimeout(() => setNotification(null), 5000);
  };

  // Calculate 48-Hour Bonus Turnover countdown timer
  const questStart = user.bonusQuestStartTime || currentTime;
  const questDurationMs = 48 * 3600 * 1000;
  const remainingQuestMs = Math.max(0, questStart + questDurationMs - currentTime);
  const isQuestExpired = remainingQuestMs <= 0;

  const totalQuestSecs = Math.floor(remainingQuestMs / 1000);
  const questHours = Math.floor(totalQuestSecs / 3600);
  const questMins = Math.floor((totalQuestSecs % 3600) / 60);
  const questSecs = totalQuestSecs % 60;
  const padZero = (n: number) => String(n).padStart(2, '0');
  const questClockStr = `${padZero(questHours)}:${padZero(questMins)}:${padZero(questSecs)}`;

  // Claim $5 bonus once - transitions to active 48-hour turnover quest
  const handleClaimFiveDollarBonus = () => {
    soundManager.playWinSound();
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    const currentBonus = user.bonusBalance ?? 0;
    const newBonus = currentBonus + 5.0;
    
    // Update balance with +$5, start 48h quest, and mark promotion as active
    onUpdateBalance(user.realBalance, user.playMoneyBalance, newBonus, true, Date.now(), false);

    const bonusTx: WalletTransaction = {
      id: `tx_${Date.now().toString().slice(-6)}`,
      type: 'bonus',
      amount: 5,
      currency: user.currency,
      timestamp: Date.now(),
      status: 'completed',
      paymentMethod: 'Xüsusi $5 Kampaniya Bonusu',
    };
    setTransactions([bonusTx, ...transactions]);

    setNotification({
      text: lang === 'az'
        ? '🎉 +$5.00 Xüsusi Bonus balansınıza əlavə edildi! 48 saatlıq $100 dövriyyə missiyası başladı!'
        : '🎉 +$5.00 Special Bonus credited! 48-hour $100 turnover quest has started!',
      type: 'success',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  // Active processing deposits
  const activeProcessingDeposits = pendingDeposits.filter((d) => d.status === 'processing');

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-100 shadow-2xl shadow-black/90 overflow-hidden"
      >
        {/* Sticky Top Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm shrink-0">
          {/* Mobile Drag / Swipe Bar */}
          <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden" />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">{t.cashier}</h2>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
                  <span>
                    {t.real_money}: <strong className="text-emerald-400">${user.realBalance.toFixed(2)}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Bonus: <strong className="text-amber-400 font-mono font-bold">${(user.bonusBalance ?? 0.0).toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                id="cashier_back_to_game_btn"
                className="flex items-center space-x-1 py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all active:scale-95 cursor-pointer"
                title={lang === 'az' ? 'Oyuna Qayıt' : 'Back to Game'}
              >
                <span>←</span>
                <span className="hidden xs:inline">{lang === 'az' ? 'Oyuna Qayıt' : 'Back to Game'}</span>
              </button>
              <button
                onClick={onClose}
                id="cashier_close_btn"
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

        {/* $5 Bonus Promo Bar or Active 48-Hour Quest Banner */}
        {!user.hasClaimedSpecialBonus ? (
          <div className="mt-4 p-3 bg-gradient-to-r from-amber-950/60 via-zinc-900 to-amber-950/60 border border-amber-500/40 rounded-xl flex items-center justify-between shadow-lg">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                <Gift className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-300">
                  {lang === 'az' ? 'Xüsusi $5 Bonus Kampaniyası' : 'Special $5 Bonus Promotion'}
                </div>
                <div className="text-[11px] text-zinc-300">
                  {lang === 'az' ? '48 saat ərzində bonusu $100 dollara çatdır həqiqi balansına dövr olunsun!' : 'Reach $100 in 48 hours to transfer to Real Balance!'}
                </div>
              </div>
            </div>
            <button
              onClick={handleClaimFiveDollarBonus}
              id="claim_five_dollar_bonus_btn"
              className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              {lang === 'az' ? '$5 bonusu götür' : 'Claim $5 Bonus'}
            </button>
          </div>
        ) : !user.bonusTurnoverCompleted && !isQuestExpired ? (
          <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/80 border border-amber-500/50 rounded-xl space-y-2 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0">
                  <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-300 leading-tight">
                    {lang === 'az'
                      ? '48 saat ərzində bonusu $100 dollara çatdır həqiqi balansına dövr olunsun!'
                      : 'Turn bonus into $100 in 48 hours to transfer to Real Balance!'}
                  </div>
                  <div className="text-[11px] text-zinc-300 mt-0.5">
                    {lang === 'az' ? 'Mövcud Bonus:' : 'Current Bonus:'}{' '}
                    <strong className="text-emerald-400 font-mono font-bold">${(user.bonusBalance ?? 0).toFixed(2)}</strong> / $100.00
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                  <span>⏱️ {questClockStr}</span>
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, (((user.bonusBalance ?? 0) / 100) * 100)))}%` }}
              />
            </div>
          </div>
        ) : user.bonusTurnoverCompleted ? (
          <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl flex items-center space-x-2 text-emerald-200 text-xs font-bold shadow-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {lang === 'az'
                ? '🎉 Təbriklər! 48 saatlıq bonus dövriyyəsi uğurla tamamlandı və $100 həqiqi balansınıza köçürüldü!'
                : '🎉 Congratulations! 48-hour bonus turnover completed and $100 was added to your Real Balance!'}
            </span>
          </div>
        ) : null}

        {/* Active 3-Minute Pending Deposit Queue Notice */}
        {activeProcessingDeposits.length > 0 && (
          <div className="mt-4 space-y-2">
            {activeProcessingDeposits.map((dep) => {
              const remainingMs = Math.max(0, dep.targetTimestamp - currentTime);
              const remainingSecs = Math.ceil(remainingMs / 1000);
              const mins = Math.floor(remainingSecs / 60);
              const secs = remainingSecs % 60;
              const timerStr = `${padZero(mins)}:${padZero(secs)}`;
              const progressPct = Math.min(100, Math.max(0, ((180 - remainingSecs) / 180) * 100));

              return (
                <div
                  key={dep.id}
                  className="p-3.5 bg-gradient-to-br from-amber-950/70 via-zinc-900 to-zinc-950 border border-amber-500/50 rounded-xl space-y-2 shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                        <Hourglass className="w-4 h-4 animate-spin text-amber-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                          <span>{lang === 'az' ? 'Depozit Emal Olunur:' : 'Processing Deposit:'}</span>
                          <span className="text-emerald-400 font-mono font-black">+${dep.amount.toFixed(2)} USD</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {lang === 'az'
                            ? '3 dəqiqə ərzində avtomatik Real Balansınıza əlavə olunacaq'
                            : 'Will be added to your Real Balance within 3 minutes'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                        <span>⏱️ {timerStr}</span>
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Progress Bar */}
                  <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800 relative">
                    <div
                      className="bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 h-full rounded-full transition-all duration-1000"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] text-zinc-400 pt-0.5">
                    <span className="flex items-center space-x-1 text-emerald-400">
                      <FileCheck className="w-3 h-3" />
                      <span className="truncate max-w-[170px]">{dep.receiptName}</span>
                    </span>
                    <span className="text-amber-400/90 font-medium">
                      {lang === 'az' ? 'Real balansa köçürülür...' : 'Transferring to real balance...'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Notifications */}
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-3 p-2.5 rounded-lg border text-xs flex items-center space-x-2 ${
              notification.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-red-950/80 border-red-500 text-red-200'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{notification.text}</span>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 mt-4">
          <button
            onClick={() => { setActiveTab('deposit'); soundManager.playButtonClick(); }}
            className={`flex items-center space-x-2 py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'deposit'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowDownRight className="w-4 h-4 text-emerald-400" />
            <span>{t.deposit}</span>
          </button>

          <button
            onClick={() => { setActiveTab('withdraw'); soundManager.playButtonClick(); }}
            className={`flex items-center space-x-2 py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'withdraw'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-red-400" />
            <span>{t.withdraw}</span>
          </button>

          <button
            onClick={() => { setActiveTab('history'); soundManager.playButtonClick(); }}
            className={`flex items-center space-x-2 py-2.5 px-4 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{t.tx_history}</span>
          </button>
        </div>

        {/* Tab Content: Deposit */}
        {activeTab === 'deposit' && (
          <div className="mt-4 space-y-4">
            {/* Quick Amount Selection with + sign */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {lang === 'az' ? 'Sürətli Məbləğ Seçimi' : 'Quick Amount Presets'}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {[5, 25, 50, 100, 250, 500, 2500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setDepositInput(amt.toString());
                      soundManager.playButtonClick();
                    }}
                    className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      parsedDeposit === amt
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-850'
                    }`}
                  >
                    +${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Deposit Input Field with + sign and validation */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex justify-between">
                <span>{lang === 'az' ? 'Depozit Məbləği ($ USD)' : 'Deposit Amount ($ USD)'}</span>
                <span className="text-[11px] text-zinc-400">$5 — $2,500</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-amber-400 font-black text-lg select-none pointer-events-none">
                  + $
                </div>
                <input
                  type="number"
                  min={5}
                  max={2500}
                  step={1}
                  value={depositInput}
                  placeholder="5.00"
                  onChange={(e) => setDepositInput(e.target.value)}
                  className={`w-full bg-zinc-900 border rounded-xl pl-12 pr-4 py-3 text-base font-mono font-bold text-white focus:outline-none transition-colors ${
                    isDepositUnderMin || isDepositOverMax
                      ? 'border-red-500 focus:border-red-400 bg-red-950/10'
                      : isDepositValid
                      ? 'border-emerald-500 focus:border-emerald-400 bg-emerald-950/10'
                      : 'border-zinc-700 focus:border-amber-400'
                  }`}
                />
              </div>

              {/* Validation Warning Message */}
              {(isDepositUnderMin || isDepositOverMax) && (
                <motion.div
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-2 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>
                    {lang === 'az'
                      ? 'Məbləği düzgün qeyd edin! Minimum depozit $5, maksimum depozit $2,500 olmalıdır.'
                      : 'Please enter a valid amount! Minimum deposit is $5, maximum is $2,500.'}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Information Banner */}
            <div className="p-3 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl space-y-1.5 text-xs text-zinc-300">
              <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                <CreditCard className="w-4 h-4" />
                <span>{lang === 'az' ? 'Təhlükəsiz Bank Köçürməsi' : 'Secure Bank Transfer'}</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {lang === 'az'
                  ? 'Məbləği seçib "Depozit et" düyməsinə basdıqdan sonra sistem kart məlumatları və bank çekini əlavə etmək üçün xüsusi ödəniş pəncərəsi açılacaq.'
                  : 'After selecting amount and clicking "Deposit", payment modal with official card details and receipt upload will appear.'}
              </p>
            </div>

            {/* Direct Action Button: Depozit Et -> Opens Deposit Payment Modal */}
            <button
              onClick={handleOpenDepositModal}
              disabled={!isDepositValid}
              id="confirm_deposit_btn"
              className={`w-full py-4 font-black rounded-xl text-sm transition-all flex items-center justify-center space-x-2 ${
                isDepositValid
                  ? 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 hover:from-emerald-400 hover:to-emerald-300 text-zinc-950 shadow-lg shadow-emerald-500/25 active:scale-[0.98] cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isDepositValid
                  ? `$${parsedDeposit.toFixed(2)} ${lang === 'az' ? 'Depozit et' : 'Deposit'}`
                  : lang === 'az' ? 'Depozit et ($5 - $2,500)' : 'Deposit ($5 - $2,500)'}
              </span>
            </button>
          </div>
        )}

        {/* Tab Content: Withdraw */}
        {activeTab === 'withdraw' && (
          <div className="mt-4 space-y-4">
            {/* Withdrawal Limits Notice */}
            <div className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-zinc-300">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {lang === 'az' ? 'Minimum çıxarış' : 'Minimum withdrawal'}: <strong className="text-emerald-400">$15.00</strong> • {lang === 'az' ? 'Maksimum' : 'Maximum'}: <strong className="text-amber-400">$6,000.00</strong>
                </span>
              </div>
              <span className="text-emerald-400 font-mono font-bold">
                {lang === 'az' ? 'Balans' : 'Balance'}: ${user.realBalance.toFixed(2)}
              </span>
            </div>

            {/* Quick Preset Buttons for Withdrawal */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {lang === 'az' ? 'Sürətli Çıxarış Məbləği' : 'Quick Withdrawal Presets'}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {[15, 50, 100, 250, 500, 1000, 6000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setWithdrawInput(amt.toString());
                      soundManager.playButtonClick();
                    }}
                    className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      parsedWithdraw === amt
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-850'
                    }`}
                  >
                    +${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Withdrawal Amount Input Field with + sign */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {lang === 'az' ? 'Çıxarış Məbləği ($ USD)' : 'Withdrawal Amount ($ USD)'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (user.realBalance >= 15) {
                      setWithdrawInput(Math.min(user.realBalance, 6000).toString());
                      soundManager.playButtonClick();
                    }
                  }}
                  className="text-xs text-amber-400 hover:underline cursor-pointer font-bold"
                >
                  {lang === 'az' ? 'Hamısını çıxar (Max)' : 'All (Max)'}
                </button>
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-3.5 text-amber-400 font-black text-lg select-none pointer-events-none">
                  + $
                </div>
                <input
                  type="number"
                  min={15}
                  max={6000}
                  step={1}
                  value={withdrawInput}
                  placeholder="15.00"
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  className={`w-full bg-zinc-900 border rounded-xl pl-12 pr-4 py-3 text-base font-mono font-bold text-white focus:outline-none transition-colors ${
                    isWithdrawUnderMin || isWithdrawOverMax || isWithdrawExceedsBalance
                      ? 'border-red-500 focus:border-red-400 bg-red-950/10'
                      : isWithdrawValid
                      ? 'border-emerald-500 focus:border-emerald-400 bg-emerald-950/10'
                      : 'border-zinc-700 focus:border-amber-400'
                  }`}
                />
              </div>

              {/* Validation Warnings for Withdrawal */}
              {(isWithdrawUnderMin || isWithdrawOverMax || isWithdrawExceedsBalance) && (
                <motion.div
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-2 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>
                    {isWithdrawUnderMin
                      ? (lang === 'az' ? 'Minimum çıxarış məbləği $15.00-dir!' : 'Minimum withdrawal amount is $15.00!')
                      : isWithdrawOverMax
                      ? (lang === 'az' ? 'Maksimum çıxarış məbləği $6,000.00-dir!' : 'Maximum withdrawal amount is $6,000.00!')
                      : (lang === 'az' ? `Balansda kifayət qədər vəsait yoxdur! (Mövcud balansınız: $${user.realBalance.toFixed(2)})` : `Insufficient balance! (Available: $${user.realBalance.toFixed(2)})`)}
                  </span>
                </motion.div>
              )}
            </div>

            {/* Destination Card Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                {lang === 'az' ? 'Vəsaitin köçürüləcəyi Kart nömrəsi' : 'Destination Bank Card Number'}
              </label>
              <input
                type="text"
                value={withdrawCardNumber}
                onChange={(e) => setWithdrawCardNumber(e.target.value)}
                placeholder="5411 XXXX XXXX XXXX"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>

            {/* Confirm Withdraw Button */}
            <button
              onClick={handleWithdraw}
              disabled={!isWithdrawValid}
              id="confirm_withdraw_btn"
              className={`w-full py-3.5 font-bold rounded-xl text-sm shadow-lg transition-all ${
                isWithdrawValid
                  ? 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-600/20 active:scale-[0.98] cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {isWithdrawValid
                ? `$${parsedWithdraw.toFixed(2)} ${t.withdraw}`
                : `${t.withdraw} ($15 - $6,000)`}
            </button>
          </div>
        )}

        {/* Tab Content: History */}
        {activeTab === 'history' && (
          <div className="mt-4 max-h-64 overflow-y-auto space-y-2 pr-1">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.status === 'pending'
                        ? 'bg-amber-500/20 text-amber-400'
                        : tx.amount > 0
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {tx.status === 'pending' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : tx.amount > 0 ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-white capitalize flex items-center space-x-1.5">
                      <span>{tx.type.replace('_', ' ')}</span>
                      {tx.status === 'pending' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {lang === 'az' ? '3 Dəqiqə Emalı' : 'Processing (3m)'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">{tx.paymentMethod}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-bold font-mono ${
                      tx.status === 'pending'
                        ? 'text-amber-400'
                        : tx.amount > 0
                        ? 'text-emerald-400'
                        : 'text-zinc-200'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    ${Math.abs(tx.amount).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Sticky Bottom Bar */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between text-xs shrink-0">
          <span className="text-zinc-500 text-[11px]">
            {lang === 'az' ? '🔒 256-bit Şifrələnmiş Təhlükəsiz Sistem' : '🔒 256-bit Encrypted Secure System'}
          </span>
          <button
            type="button"
            onClick={onClose}
            id="cashier_bottom_back_btn"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer transition-all active:scale-95"
          >
            <span>←</span>
            <span>{lang === 'az' ? 'Oyuna Qayıt' : 'Back to Game'}</span>
          </button>
        </div>
      </motion.div>

      {/* Popup Payment Modal with Official Card Details & Receipt Upload */}
      <DepositPaymentModal
        isOpen={isDepositPaymentModalOpen}
        onClose={() => setIsDepositPaymentModalOpen(false)}
        depositAmount={parsedDeposit || 5}
        officialCardNumber={officialCardNumber}
        officialCardHolder={officialCardHolder}
        officialBank={officialBank}
        lang={lang}
        userId={user.id}
        username={user.username}
        onConfirmPayment={handleCompletePaymentFromModal}
      />
    </div>
  );
};

