import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, CurrencyType, TableRakeRecord, BotDifficulty, BotSystemConfig, PokerTableState } from '../types/poker';
import { Language, translations } from '../utils/translations';
import { 
  adminStorage, 
  AdminPendingDeposit, 
  AdminWithdrawalRequest, 
  SystemConfig 
} from '../utils/adminStore';
import { 
  fetchAllUsersFromFirestore, 
  adminUpdateUserInFirestore, 
  updateUserBalanceInFirebase, 
  fetchAllDepositsFromFirestore,
  updateDepositStatusInFirestore,
  approveDepositInFirestore,
  fetchAllWithdrawalsFromFirestore,
  updateWithdrawalStatusInFirestore,
  saveSystemConfigToFirestore,
  fetchSystemConfigFromFirestore,
  saveBotSystemConfigToFirestore,
  fetchBotSystemConfigFromFirestore,
  subscribeToRealtimeAdminData,
  fetchAllSupportMessagesFromFirestore,
  sendSupportMessage,
  markSupportMessagesReadByAdmin,
  fetchAllTableRakesFromFirestore,
  claimTableRakesToAdminBalance,
  SupportMessage,
  ADMIN_EMAIL 
} from '../services/firebase';
import {
  sendBotConfigSocket,
  emitKickPlayerSocket,
  emitCloseTableSocket,
  emitUpdateTableLimitsSocket,
  emitUserBalanceChangedSocket
} from '../services/socket';
import { AdminTableFigure } from './AdminTableFigure';
import { soundManager } from '../utils/audioEngine';
import confetti from 'canvas-confetti';
import { 
  X, 
  ShieldCheck, 
  Users, 
  CreditCard, 
  ArrowDownRight, 
  ArrowUpRight, 
  Settings, 
  Search, 
  Plus, 
  Minus, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  Ban, 
  Unlock, 
  RefreshCw, 
  Wallet, 
  Layers, 
  DollarSign, 
  Save, 
  Clock, 
  ExternalLink,
  Flame,
  Gift,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileCheck,
  Calendar,
  Sparkles,
  MessageSquare,
  Send,
  MessageCircle,
  Percent,
  TrendingUp,
  Coins,
  Bot,
  Cpu,
  Zap,
  Timer,
  Sliders,
  Award,
  LogOut,
  Power,
  Download,
  Copy,
  RotateCw,
  Crown,
  UserCheck,
  UserX,
  Radio,
  Megaphone,
  FileSpreadsheet,
  Play,
  Volume2,
  RefreshCcw,
  CheckSquare,
  Square,
  Trash2,
  SlidersHorizontal,
  UserMinus,
  UserPlus
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: UserProfile;
  onRefreshUserData?: () => void;
  tables?: PokerTableState[];
  onKickPlayer?: (tableId: string, playerId: string) => void;
  onAddBotToTable?: (tableId: string) => void;
  onRemoveBotFromTable?: (tableId: string, botId?: string) => void;
  onCloseTable?: (tableId: string) => void;
  onUpdateTableLimits?: (tableId: string, smallBlind: number, bigBlind: number) => void;
  onOpenNewTableModal?: () => void;
  onSpectateTable?: (table: PokerTableState) => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  onRefreshUserData,
  tables = [],
  onKickPlayer,
  onAddBotToTable,
  onRemoveBotFromTable,
  onCloseTable,
  onUpdateTableLimits,
  onOpenNewTableModal,
  onSpectateTable,
}) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'users' | 'deposits' | 'withdrawals' | 'messages' | 'rakes' | 'settings' | 'bots'>('tables');
  const [searchTableTerm, setSearchTableTerm] = useState<string>('');
  const [tableFilterStakes, setTableFilterStakes] = useState<'all' | 'micro' | 'low' | 'mid' | 'high'>('all');
  const [tableDisplayMode, setTableDisplayMode] = useState<'figure' | 'list'>('figure');
  const [editingTableLimits, setEditingTableLimits] = useState<{ id: string; name: string; smallBlind: number; bigBlind: number } | null>(null);
  const [newSbInput, setNewSbInput] = useState<string>('');
  const [newBbInput, setNewBbInput] = useState<string>('');
  
  // Bot Settings state (Bots disabled by default until Admin enables them)
  const [botConfig, setBotConfig] = useState<BotSystemConfig>({
    isBotsActive: false,
    botDifficulty: 'pro',
    autoJoinLeaveEnabled: false,
    minThinkSeconds: 4,
    maxThinkSeconds: 9,
    targetTableOccupancy: 4,
  });
  const [isSavingBotConfig, setIsSavingBotConfig] = useState<boolean>(false);
  
  // Players state & Proactive Filter Category
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userCategoryFilter, setUserCategoryFilter] = useState<'all' | 'high_rollers' | 'vip' | 'banned' | 'messages'>('all');
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);
  const [activeActionPlayerId, setActiveActionPlayerId] = useState<string | null>(null);

  // Table Rakes (%10 Masa Faizləri) state
  const [tableRakes, setTableRakes] = useState<TableRakeRecord[]>([]);
  const [searchRakeTerm, setSearchRakeTerm] = useState<string>('');
  const [rakeFilter, setRakeFilter] = useState<'all' | 'unclaimed' | 'claimed'>('all');
  const [isClaimingRakes, setIsClaimingRakes] = useState<boolean>(false);

  // Support Messages state
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState<string>('');
  const [searchChatTerm, setSearchChatTerm] = useState<string>('');

  // Selected player for balance adjustment modal
  const [editingPlayer, setEditingPlayer] = useState<UserProfile | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<string>('');
  const [balanceMode, setBalanceMode] = useState<'add' | 'subtract'>('add');
  const [balanceType, setBalanceType] = useState<'real' | 'bonus' | 'play'>('real');

  // Deposits & Withdrawals & Proactive Bulk actions
  const [pendingDeposits, setPendingDeposits] = useState<AdminPendingDeposit[]>([]);
  const [depositFilter, setDepositFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('all');
  const [inspectingDeposit, setInspectingDeposit] = useState<AdminPendingDeposit | null>(null);
  const [receiptZoom, setReceiptZoom] = useState<number>(1);
  const [receiptRotation, setReceiptRotation] = useState<number>(0);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRequest[]>([]);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [isBulkApprovingDeposits, setIsBulkApprovingDeposits] = useState<boolean>(false);
  const [isBulkApprovingWithdrawals, setIsBulkApprovingWithdrawals] = useState<boolean>(false);

  // System Bank Settings & Broadcast
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(adminStorage.getConfig);
  const [configSavedToast, setConfigSavedToast] = useState(false);
  const [broadcastInput, setBroadcastInput] = useState<string>('');
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);

  // Toast / notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Data
  const loadAllData = async () => {
    setIsLoadingPlayers(true);
    try {
      // 1. Fetch from Firestore for real registered users
      const firestoreUsers = await fetchAllUsersFromFirestore();
      const localPlayers = adminStorage.getRegisteredPlayers();
      
      const map = new Map<string, UserProfile>();
      localPlayers.forEach(p => map.set(p.email || p.id, p));
      firestoreUsers.forEach(p => map.set(p.email || p.id, p));

      const merged = Array.from(map.values()).sort((a, b) => {
        if (a.isAdmin) return -1;
        if (b.isAdmin) return 1;
        return (b.realBalance || 0) - (a.realBalance || 0);
      });

      setPlayers(merged);
      adminStorage.saveRegisteredPlayers(merged);

      // 2. Fetch real deposits from Firestore & local
      const firestoreDeposits = await fetchAllDepositsFromFirestore();
      const localDeps = adminStorage.getPendingDeposits();
      const depMap = new Map<string, AdminPendingDeposit>();
      localDeps.forEach(d => depMap.set(d.id, d));
      firestoreDeposits.forEach(d => depMap.set(d.id, d));
      const mergedDeps = Array.from(depMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPendingDeposits(mergedDeps);
      adminStorage.savePendingDeposits(mergedDeps);

      // 3. Fetch real withdrawals from Firestore & local
      const firestoreWithdrawals = await fetchAllWithdrawalsFromFirestore();
      const localWiths = adminStorage.getWithdrawals();
      const withMap = new Map<string, AdminWithdrawalRequest>();
      localWiths.forEach(w => withMap.set(w.id, w));
      firestoreWithdrawals.forEach(w => withMap.set(w.id, w));
      const mergedWiths = Array.from(withMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setWithdrawals(mergedWiths);
      adminStorage.saveWithdrawals(mergedWiths);

      // 4. Fetch system config from Firestore
      const remoteConfig = await fetchSystemConfigFromFirestore();
      if (remoteConfig) {
        setSystemConfig(remoteConfig);
        adminStorage.saveConfig(remoteConfig);
      } else {
        setSystemConfig(adminStorage.getConfig());
      }

      // 5. Fetch all support messages from Firestore
      const remoteMsgs = await fetchAllSupportMessagesFromFirestore();
      setSupportMessages(remoteMsgs);

      // 6. Fetch 10% Table Rakes from Firestore
      const remoteRakes = await fetchAllTableRakesFromFirestore();
      setTableRakes(remoteRakes);

      // 7. Fetch Bot Settings from Firestore
      const remoteBotCfg = await fetchBotSystemConfigFromFirestore();
      if (remoteBotCfg) {
        setBotConfig(remoteBotCfg);
      }
    } catch (err) {
      console.warn('Error loading admin data:', err);
    } finally {
      setIsLoadingPlayers(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllData();

      // Realtime listener
      const unsubscribe = subscribeToRealtimeAdminData({
        onUsersChange: (newUsers) => {
          if (newUsers && newUsers.length > 0) {
            setPlayers(prev => {
              const map = new Map<string, UserProfile>();
              prev.forEach(p => map.set(p.email || p.id, p));
              newUsers.forEach(p => map.set(p.email || p.id, p));
              return Array.from(map.values()).sort((a, b) => {
                if (a.isAdmin) return -1;
                if (b.isAdmin) return 1;
                return (b.realBalance || 0) - (a.realBalance || 0);
              });
            });
          }
        },
        onDepositsChange: (newDeps) => {
          if (newDeps) {
            setPendingDeposits(newDeps);
            adminStorage.savePendingDeposits(newDeps);
          }
        },
        onWithdrawalsChange: (newWiths) => {
          if (newWiths) {
            setWithdrawals(newWiths);
            adminStorage.saveWithdrawals(newWiths);
          }
        },
        onMessagesChange: (newMsgs) => {
          if (newMsgs) {
            setSupportMessages(newMsgs);
          }
        },
        onRakesChange: (newRakes) => {
          if (newRakes) {
            setTableRakes(newRakes);
          }
        },
        onBotConfigChange: (newBotCfg) => {
          if (newBotCfg) {
            setBotConfig(newBotCfg);
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen]);

  // Handle Claiming Accumulated Rakes to Admin Real Balance
  const handleClaimAllRakes = async () => {
    const unclaimed = tableRakes.filter(r => !r.claimed);
    const sum = Number(unclaimed.reduce((acc, r) => acc + (r.rakeAmount || 0), 0).toFixed(2));
    if (sum <= 0) {
      showToast('⚠️ Köçürüləcək yığılmış masa faizi yoxdur');
      return;
    }

    setIsClaimingRakes(true);
    try {
      const success = await claimTableRakesToAdminBalance(currentUser.id, sum);
      if (success) {
        soundManager.playWinSound();
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
        showToast(`🎉 $${sum.toFixed(2)} məbləğində masa faizi uğurla Admin Real Balansınıza köçürüldü!`);
        // Update local rakes state to claimed
        setTableRakes(prev => prev.map(r => ({ ...r, claimed: true, claimedAt: Date.now() })));
        // Refresh admin user balance
        onRefreshUserData?.();
      } else {
        showToast('❌ Masa faizlərini köçürərkən xəta baş verdi');
      }
    } catch (err) {
      console.warn('Error claiming rakes:', err);
      showToast('❌ Xəta baş verdi');
    } finally {
      setIsClaimingRakes(false);
    }
  };

  // Handle Admin sending message to a player
  const handleSendAdminReply = async (e?: React.FormEvent, cannedText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (cannedText || adminReplyText).trim();
    if (!selectedChatUserId || !textToSend) return;

    const targetUser = players.find(p => p.id === selectedChatUserId);
    setAdminReplyText('');

    try {
      const sent = await sendSupportMessage({
        userId: selectedChatUserId,
        username: targetUser?.username || 'Oyunçu',
        userEmail: targetUser?.email || '',
        userAvatar: targetUser?.avatar || '',
        sender: 'admin',
        text: textToSend,
        createdAt: Date.now(),
      });
      setSupportMessages(prev => [...prev, sent]);
      soundManager.playChipSound();
      showToast('✅ Cavab oyunçuya uğurla çatdırıldı!');
    } catch (err) {
      console.warn('Error sending admin reply:', err);
    }
  };

  const handleSelectUserChat = async (userId: string) => {
    setSelectedChatUserId(userId);
    soundManager.playButtonClick();
    await markSupportMessagesReadByAdmin(userId);
    setSupportMessages(prev => prev.map(m => m.userId === userId ? { ...m, readByAdmin: true } : m));
  };

  if (!isOpen) return null;

  // Filter players by Search & Category
  const filteredPlayers = players.filter(p => {
    // 1. Search filter
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = !q || (
      p.username.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
    if (!matchesSearch) return false;

    // 2. Category filter
    if (userCategoryFilter === 'high_rollers') {
      return (p.realBalance || 0) >= 50;
    }
    if (userCategoryFilter === 'vip') {
      return (p.vipLevel || 1) >= 2;
    }
    if (userCategoryFilter === 'banned') {
      return !!p.isBanned;
    }
    if (userCategoryFilter === 'messages') {
      return supportMessages.some(m => m.userId === p.id && m.sender === 'user' && !m.readByAdmin);
    }
    return true;
  });

  // Proactive Action: Quick Instant Balance Adjustment (+/- directly with 1-click)
  const handleQuickBalanceAdjust = async (player: UserProfile, delta: number, mode: 'add' | 'subtract', type: 'real' | 'bonus' = 'real') => {
    setActiveActionPlayerId(player.id);
    const multiplier = mode === 'add' ? 1 : -1;
    const finalChange = delta * multiplier;

    let newReal = player.realBalance || 0;
    let newBonus = player.bonusBalance || 0;

    if (type === 'real') {
      newReal = Math.max(0, Number((newReal + finalChange).toFixed(2)));
    } else {
      newBonus = Math.max(0, Number((newBonus + finalChange).toFixed(2)));
    }

    const updatedProfile: UserProfile = {
      ...player,
      realBalance: newReal,
      bonusBalance: newBonus,
    };

    // Update locally & remotely
    adminStorage.updatePlayerBalance(player.id, newReal, newBonus);
    setPlayers(prev => prev.map(p => p.id === player.id ? updatedProfile : p));

    await adminUpdateUserInFirestore(player.id, {
      realBalance: newReal,
      bonusBalance: newBonus,
    });

    if (player.id === currentUser.id) {
      updateUserBalanceInFirebase(currentUser.id, newReal, currentUser.playMoneyBalance, newBonus);
      if (onRefreshUserData) onRefreshUserData();
    }

    soundManager.playChipSound();
    showToast(`⚡ ${player.username}: ${mode === 'add' ? '+' : '-'}$${delta} ${type === 'real' ? 'Real' : 'Bonus'} balans tətbiq edildi! ($${(type === 'real' ? newReal : newBonus).toFixed(2)})`);
    setActiveActionPlayerId(null);
  };

  // Proactive Action: Quick VIP Level change directly
  const handleQuickVipChange = async (player: UserProfile, newVip: number) => {
    setActiveActionPlayerId(player.id);
    const updated = { ...player, vipLevel: newVip };
    setPlayers(prev => prev.map(p => p.id === player.id ? updated : p));
    adminStorage.updatePlayerBalance(player.id, player.realBalance, player.bonusBalance);
    await adminUpdateUserInFirestore(player.id, { vipLevel: newVip });
    soundManager.playWinSound();
    confetti({ particleCount: 30, spread: 40 });
    showToast(`👑 ${player.username} üçün VIP ${newVip} səviyyəsi təyin edildi!`);
    setActiveActionPlayerId(null);
  };

  // Proactive Action: Reset Player Sit-Out / Missed Turns / Table State
  const handleResetPlayerSitOut = async (player: UserProfile) => {
    setActiveActionPlayerId(player.id);
    await adminUpdateUserInFirestore(player.id, {
      consecutiveMissedTurns: 0,
      isSittingOut: false,
    });
    soundManager.playButtonClick();
    showToast(`🔄 ${player.username} oyunçusunun fasilə (sit-out) statusu sıfırlandı və aktiv edildi!`);
    setActiveActionPlayerId(null);
  };

  // Action: Save Balance Change in Modal
  const handleSaveBalanceAdjustment = async () => {
    if (!editingPlayer) return;
    const delta = parseFloat(balanceDelta);
    if (isNaN(delta) || delta <= 0) {
      showToast('❌ Zəhmət olmasa düzgün məbləğ daxil edin');
      return;
    }

    const multiplier = balanceMode === 'add' ? 1 : -1;
    const finalChange = delta * multiplier;

    let newReal = editingPlayer.realBalance || 0;
    let newBonus = editingPlayer.bonusBalance || 0;
    let newPlay = editingPlayer.playMoneyBalance || 0;

    if (balanceType === 'real') {
      newReal = Math.max(0, Number((newReal + finalChange).toFixed(2)));
    } else if (balanceType === 'bonus') {
      newBonus = Math.max(0, Number((newBonus + finalChange).toFixed(2)));
    } else {
      newPlay = Math.max(0, Math.floor(newPlay + finalChange));
    }

    const updatedProfile: UserProfile = {
      ...editingPlayer,
      realBalance: newReal,
      bonusBalance: newBonus,
      playMoneyBalance: newPlay,
    };

    // Update in Firestore
    await adminUpdateUserInFirestore(editingPlayer.id, {
      realBalance: newReal,
      bonusBalance: newBonus,
      playMoneyBalance: newPlay,
    });
    updateUserBalanceInFirebase(editingPlayer.id, newReal, newPlay, newBonus);

    // Broadcast instant socket event to all clients
    emitUserBalanceChangedSocket(editingPlayer.id, newReal, newBonus, newPlay, 'admin_direct_adjustment');

    // Update in local admin store
    adminStorage.updatePlayerBalance(editingPlayer.id, newReal, newBonus);

    // If editing current admin, sync in App
    if (editingPlayer.id === currentUser.id) {
      if (onRefreshUserData) onRefreshUserData();
    }

    // Update state
    setPlayers(prev => prev.map(p => p.id === editingPlayer.id ? updatedProfile : p));
    setEditingPlayer(null);
    setBalanceDelta('');
    soundManager.playChipSound();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    showToast(
      `✅ ${editingPlayer.username} oyunçusunun ${balanceType === 'real' ? 'Real' : balanceType === 'bonus' ? 'Bonus' : 'Oyun Çipi'} balansı uğurla yeniləndi!`
    );
  };

  // Action: Toggle Ban Status
  const handleToggleBan = async (player: UserProfile) => {
    const nextBanned = !player.isBanned;
    const updated = { ...player, isBanned: nextBanned };
    
    await adminUpdateUserInFirestore(player.id, { isBanned: nextBanned });
    adminStorage.updatePlayerBalance(player.id, player.realBalance, player.bonusBalance);
    
    setPlayers(prev => prev.map(p => p.id === player.id ? updated : p));
    soundManager.playButtonClick();
    showToast(nextBanned ? `🚫 ${player.username} donduruldu (Ban edildi)` : `✅ ${player.username} blokdan çıxarıldı`);
  };

  // Action: Approve Deposit
  const handleApproveDeposit = async (depositId: string) => {
    const dep = adminStorage.approveDepositEarly(depositId);
    await updateDepositStatusInFirestore(depositId, 'completed');
    
    if (dep) {
      if (dep.userId) {
        await approveDepositInFirestore(depositId, dep.userId, dep.amount);
        const player = players.find(p => p.id === dep.userId || p.username === dep.username);
        if (player) {
          const updatedReal = Number(((player.realBalance || 0) + dep.amount).toFixed(2));
          adminStorage.updatePlayerBalance(player.id, updatedReal, player.bonusBalance);
          setPlayers(prev => prev.map(p => p.id === player.id ? { ...p, realBalance: updatedReal } : p));
        }
      }
    }
    
    setPendingDeposits(adminStorage.getPendingDeposits());
    setInspectingDeposit(null);
    soundManager.playWinSound();
    confetti({ particleCount: 80, spread: 80, origin: { y: 0.5 } });
    showToast(`🎉 Depozit təsdiqləndi! +$${dep?.amount?.toFixed(2) || ''} oyunçunun balansına köçürüldü.`);
    loadAllData();
  };

  // Proactive Action: Bulk Approve All Pending Deposits with 1-Click
  const handleBulkApproveDeposits = async () => {
    const pendingList = pendingDeposits.filter(d => d.status === 'pending' || d.status === 'processing');
    if (pendingList.length === 0) {
      showToast('ℹ️ Gözləyən heç bir depozit çeki yoxdur.');
      return;
    }

    setIsBulkApprovingDeposits(true);
    let approvedCount = 0;
    let totalCredited = 0;

    for (const dep of pendingList) {
      adminStorage.approveDepositEarly(dep.id);
      await updateDepositStatusInFirestore(dep.id, 'completed');
      if (dep.userId) {
        await approveDepositInFirestore(dep.id, dep.userId, dep.amount);
        const player = players.find(p => p.id === dep.userId || p.username === dep.username);
        if (player) {
          const updatedReal = Number(((player.realBalance || 0) + dep.amount).toFixed(2));
          adminStorage.updatePlayerBalance(player.id, updatedReal, player.bonusBalance);
        }
      }
      approvedCount++;
      totalCredited += dep.amount;
    }

    soundManager.playWinSound();
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
    showToast(`🚀 Bütün gözləyən ${approvedCount} depozit təsdiqləndi! Toplam +$${totalCredited.toFixed(2)} balanslara köçürüldü.`);
    loadAllData();
    setIsBulkApprovingDeposits(false);
  };

  // Action: Reject Deposit
  const handleRejectDeposit = async (depositId: string) => {
    adminStorage.rejectDeposit(depositId);
    await updateDepositStatusInFirestore(depositId, 'rejected');
    setPendingDeposits(adminStorage.getPendingDeposits());
    setInspectingDeposit(null);
    soundManager.playButtonClick();
    showToast(`❌ Depozit tələbi imtina edildi.`);
    loadAllData();
  };

  // Action: Approve Withdrawal
  const handleApproveWithdrawal = async (withdrawalId: string) => {
    adminStorage.updateWithdrawalStatus(withdrawalId, 'approved');
    await updateWithdrawalStatusInFirestore(withdrawalId, 'approved');
    setWithdrawals(adminStorage.getWithdrawals());
    soundManager.playWinSound();
    showToast(`✅ Çıxarış təsdiqləndi və ödənildi olaraq qeyd edildi.`);
  };

  // Proactive Action: Bulk Approve All Pending Withdrawals
  const handleBulkApproveWithdrawals = async () => {
    const pendingWiths = withdrawals.filter(w => w.status === 'pending');
    if (pendingWiths.length === 0) {
      showToast('ℹ️ Gözləyən heç bir çıxarış tələbi yoxdur.');
      return;
    }

    setIsBulkApprovingWithdrawals(true);
    let count = 0;
    for (const w of pendingWiths) {
      adminStorage.updateWithdrawalStatus(w.id, 'approved');
      await updateWithdrawalStatusInFirestore(w.id, 'approved');
      count++;
    }
    setWithdrawals(adminStorage.getWithdrawals());
    soundManager.playWinSound();
    confetti({ particleCount: 60, spread: 70 });
    showToast(`✅ Bütün ${count} gözləyən çıxarış tələbi uğurla təsdiqləndi və ödənildi!`);
    setIsBulkApprovingWithdrawals(false);
  };

  // Action: Reject Withdrawal
  const handleRejectWithdrawal = async (withdrawalId: string) => {
    adminStorage.updateWithdrawalStatus(withdrawalId, 'rejected');
    await updateWithdrawalStatusInFirestore(withdrawalId, 'rejected');
    setWithdrawals(adminStorage.getWithdrawals());
    soundManager.playButtonClick();
    showToast(`❌ Çıxarış tələbi ləğv edildi.`);
  };

  // Proactive Action: 1-Click Copy Card Number to Clipboard
  const handleCopyCardNumber = (cardNumber: string, id: string) => {
    const cleanNum = cardNumber.replace(/\s+/g, '');
    navigator.clipboard.writeText(cleanNum);
    setCopiedCardId(id);
    soundManager.playChipSound();
    showToast(`📋 Kart nömrəsi kopyalandı: ${cleanNum}`);
    setTimeout(() => setCopiedCardId(null), 2500);
  };

  // Proactive Action: Export Players to CSV spreadsheet
  const handleExportPlayersCSV = () => {
    const headers = ['ID', 'Username', 'Email', 'Real Balance ($)', 'Bonus Balance ($)', 'VIP Level', 'Status', 'Is Admin'];
    const rows = players.map(p => [
      `"${p.id}"`,
      `"${p.username.replace(/"/g, '""')}"`,
      `"${p.email.replace(/"/g, '""')}"`,
      (p.realBalance || 0).toFixed(2),
      (p.bonusBalance || 0).toFixed(2),
      p.vipLevel || 1,
      p.isBanned ? 'Banned' : 'Active',
      p.isAdmin ? 'Admin' : 'Player'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `royal_poker_players_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    soundManager.playWinSound();
    showToast('📊 Oyunçuların məlumat bazası CSV faylı olaraq ixrac edildi!');
  };

  // Proactive Action: Direct Gift Credit from Chat
  const handleDirectChatGift = async (amount: number, type: 'real' | 'bonus') => {
    if (!selectedChatUserId) return;
    const player = players.find(p => p.id === selectedChatUserId);
    if (!player) return;

    await handleQuickBalanceAdjust(player, amount, 'add', type);
    // Send automated notification message into the thread
    await handleSendAdminReply(undefined, `🎁 Təbriklər! Admin tərəfindən hesabınıza +$${amount.toFixed(2)} ${type === 'real' ? 'Real Pul' : 'Hədiyyə Bonusu'} əlavə edildi!`);
  };

  // Proactive Action: Send Broadcast Banner to all tables
  const handleBroadcastAnnouncement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!broadcastInput.trim()) {
      showToast('⚠️ Zəhmət olmasa elan mətni yazın');
      return;
    }
    setIsBroadcasting(true);
    const updated = { ...systemConfig, systemAnnouncement: broadcastInput.trim() };
    setSystemConfig(updated);
    adminStorage.saveConfig(updated);
    await saveSystemConfigToFirestore(updated);
    soundManager.playWinSound();
    confetti({ particleCount: 50, spread: 60 });
    showToast('📢 Canlı Elan bütün masalara və lobbiyə yayımlandı!');
    setIsBroadcasting(false);
  };

  // Action: Save System Config
  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    adminStorage.saveConfig(systemConfig);
    await saveSystemConfigToFirestore(systemConfig);
    soundManager.playButtonClick();
    setConfigSavedToast(true);
    setTimeout(() => setConfigSavedToast(false), 3000);
    showToast(`✅ Rəsmi Bank Kartı və Kassa Ayarları yadda saxlanıldı!`);
  };

  // Stats calculation
  const totalUsersCount = players.length;
  const totalRealBalance = players.reduce((sum, p) => sum + (p.realBalance || 0), 0);
  const pendingDepositsCount = pendingDeposits.filter(d => d.status === 'processing').length;
  const pendingWithdrawalsCount = withdrawals.filter(w => w.status === 'pending').length;
  const totalRakesSum = Number(tableRakes.reduce((sum, r) => sum + (r.rakeAmount || 0), 0).toFixed(2));
  const unclaimedRakesSum = Number(tableRakes.filter(r => !r.claimed).reduce((sum, r) => sum + (r.rakeAmount || 0), 0).toFixed(2));
  const totalHandsCount = tableRakes.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        id="admin_panel_modal"
        className="relative w-full max-w-5xl bg-zinc-950 border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-950/40 flex flex-col max-h-[92vh] overflow-hidden text-zinc-100"
      >
        {/* Toast Alert */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-zinc-950 font-black px-4 py-2 rounded-xl shadow-lg border border-amber-300 text-xs sm:text-sm flex items-center space-x-2"
            >
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Top Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-zinc-900 via-amber-950/40 to-zinc-900 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-md flex items-center justify-center text-zinc-950 font-black">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-amber-300 tracking-wide uppercase">
                  Poker İdarəetmə Paneli
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                  SUPER ADMİN
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Oyunçular, masa faizləri (%10), depozit çekləri, balanslar və kassa ayarlarının canlı idarəsi
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadAllData}
              title="Yenilə"
              className="p-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingPlayers ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-zinc-900/90 border-b border-zinc-800 text-xs">
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-[11px] flex items-center space-x-1.5">
                <span>Cəmi Oyunçular</span>
                {supportMessages.filter(m => m.sender === 'user' && !m.readByAdmin).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>
              <div className="text-sm sm:text-base font-black text-white flex items-center space-x-2">
                <span>{totalUsersCount} nəfər</span>
                {supportMessages.filter(m => m.sender === 'user' && !m.readByAdmin).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('messages')}
                    className="px-1.5 py-0.5 rounded-md bg-red-500 hover:bg-red-400 text-white text-[10px] font-black animate-pulse flex items-center space-x-1 cursor-pointer shadow-sm transition-all"
                    title="Oxunmamış oyunçu mesajları"
                  >
                    <MessageSquare className="w-2.5 h-2.5" />
                    <span>{supportMessages.filter(m => m.sender === 'user' && !m.readByAdmin).length} yeni mesaj</span>
                  </button>
                )}
              </div>
            </div>
            <Users className="w-5 h-5 text-blue-400" />
          </div>

          <div className="bg-zinc-950/60 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between bg-gradient-to-br from-amber-950/30 to-zinc-950">
            <div>
              <div className="text-amber-400 text-[11px] font-bold flex items-center space-x-1">
                <span>Masa Faizləri (%10)</span>
              </div>
              <div className="text-sm sm:text-base font-black text-amber-300 font-mono">
                ${totalRakesSum.toFixed(2)}
              </div>
              {unclaimedRakesSum > 0 && (
                <div className="text-[9.5px] text-emerald-400 font-bold">
                  +${unclaimedRakesSum.toFixed(2)} yeni yığılıb
                </div>
              )}
            </div>
            <Percent className="w-5 h-5 text-amber-400" />
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-[11px]">Ümumi Balanslar</div>
              <div className="text-sm sm:text-base font-black text-amber-400 font-mono">${totalRealBalance.toFixed(2)}</div>
            </div>
            <Wallet className="w-5 h-5 text-amber-400" />
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-[11px]">Gözləyən Depozitlər</div>
              <div className="text-sm sm:text-base font-black text-emerald-400 flex items-center space-x-1">
                <span>{pendingDepositsCount} tələb</span>
                {pendingDepositsCount > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
              </div>
            </div>
            <ArrowDownRight className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-[11px]">Gözləyən Çıxarışlar</div>
              <div className="text-sm sm:text-base font-black text-amber-300">
                {pendingWithdrawalsCount} tələb
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-6 pt-3 pb-2 bg-zinc-950 border-b border-zinc-800/80 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setActiveTab('tables'); soundManager.playButtonClick(); }}
            className={`relative flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'tables'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/25 ring-1 ring-amber-300'
                : 'bg-zinc-900 hover:bg-zinc-850 text-amber-400 border border-amber-500/30'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>🎴 Canlı Masalar & İdarəetmə</span>
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-950 text-amber-300 font-mono text-[10px] font-black">
              {tables.length}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('users'); soundManager.playButtonClick(); }}
            className={`relative flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Oyunçular ({players.length})</span>
            {supportMessages.filter(m => m.sender === 'user' && !m.readByAdmin).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse shadow">
                {supportMessages.filter(m => m.sender === 'user' && !m.readByAdmin).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('rakes')}
            className={`relative flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'rakes'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 shadow-md shadow-amber-500/30'
                : 'bg-zinc-900 hover:bg-zinc-850 text-amber-400 border border-amber-500/30'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>Masa Faizləri (%10 Rake)</span>
            {unclaimedRakesSum > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black animate-pulse shadow">
                +${unclaimedRakesSum.toFixed(2)}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold">
                {tableRakes.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('deposits')}
            className={`relative flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'deposits'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Depozit Çekləri</span>
            {pendingDepositsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black">
                {pendingDepositsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`relative flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'withdrawals'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Çıxarış Tələbləri</span>
            {pendingWithdrawalsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-zinc-950 text-[10px] font-black">
                {pendingWithdrawalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`relative flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'messages'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Oyunçu Mesajları & Canlı Dəstək</span>
            {supportMessages.filter(m => m.sender === 'user' && !m.readByAdmin).length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse shadow">
                {supportMessages.filter(m => m.sender === 'user' && !m.readByAdmin).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('bots')}
            className={`relative flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'bots'
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-400'
                : 'bg-zinc-900 hover:bg-zinc-850 text-purple-400 border border-purple-500/30'
            }`}
          >
            <Bot className="w-3.5 h-3.5 animate-pulse text-purple-300" />
            <span>Bot Tənzimləməsi (AI Otağı)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black uppercase tracking-wider ${
              botConfig.isBotsActive === false
                ? 'bg-red-500/80 text-white'
                : botConfig.botDifficulty === 'pro' 
                ? 'bg-amber-400 text-zinc-950 ring-1 ring-amber-300 animate-pulse' 
                : botConfig.botDifficulty === 'medium'
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-700 text-zinc-300'
            }`}>
              {botConfig.isBotsActive === false ? 'DEAKTİV' : botConfig.botDifficulty === 'pro' ? '★ PRO BOT' : botConfig.botDifficulty === 'medium' ? 'ORTA' : 'ZƏİF'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Rəsmi Bank Kartı & Kassa</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 p-3 sm:p-6 overflow-y-auto space-y-4">
          
          {/* TAB 0: CANLI MASALAR & MƏRKƏZİ İDARƏETMƏ */}
          {activeTab === 'tables' && (
            <div className="space-y-5">
              {/* Header Overview Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-950 border border-amber-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                    <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                      <Layers className="w-6 h-6 text-amber-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center space-x-2">
                      <span>Canlı Masalar & Mərkəzi İdarəetmə Paneli</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                        Real-Time
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Bütün aktiv masaları canlı izləyin, istənilən oyunçunu dərhal masadan kənarlaşdırın (Kick), 1 kliklə %95 Pro Botlar əlavə edin/çıxarın və ya masaları bağlayın.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {onOpenNewTableModal && (
                    <button
                      type="button"
                      onClick={() => { onOpenNewTableModal(); soundManager.playButtonClick(); }}
                      className="px-3.5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>➕ Yeni Masa Yarat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Table Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold">Aktiv Masalar</div>
                  <div className="text-xl font-black text-amber-400 font-mono mt-0.5">{tables.length}</div>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold">Oturmuş Oyunçular</div>
                  <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                    {tables.reduce((acc, t) => acc + (t.players || []).filter(p => p !== null).length, 0)}
                  </div>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold">İnsan / Bot Nisbəti</div>
                  <div className="text-xl font-black text-purple-300 font-mono mt-0.5">
                    {tables.reduce((acc, t) => acc + (t.players || []).filter(p => p && p.isHuman).length, 0)} İnsan / {tables.reduce((acc, t) => acc + (t.players || []).filter(p => p && !p.isHuman).length, 0)} Bot
                  </div>
                </div>
                <div className="bg-zinc-900/80 border border-zinc-800 p-3.5 rounded-2xl">
                  <div className="text-zinc-400 text-xs font-bold">AI Bot Səviyyəsi</div>
                  <div className="text-xl font-black text-amber-300 font-mono mt-0.5 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>%95 Pro AI</span>
                  </div>
                </div>
              </div>

              {/* Search, Stakes Filter & Display Mode Toggle */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800">
                <div className="relative flex-1 lg:max-w-xs">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTableTerm}
                    onChange={(e) => setSearchTableTerm(e.target.value)}
                    placeholder="Masa adı və ya ID ilə axtar..."
                    className="w-full bg-zinc-950 border border-zinc-750 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-medium"
                  />
                  {searchTableTerm && (
                    <button
                      onClick={() => setSearchTableTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'Bütün Masalar' },
                      { id: 'micro', label: 'Micro ($0.01/$0.02)' },
                      { id: 'low', label: 'Low ($0.05 - $0.20)' },
                      { id: 'mid', label: 'Mid ($0.25 - $1.00)' },
                      { id: 'high', label: 'High ($2.00+)' },
                    ].map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setTableFilterStakes(filter.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          tableFilterStakes === filter.id
                            ? 'bg-amber-500 text-zinc-950 font-black shadow'
                            : 'bg-zinc-950 hover:bg-zinc-850 text-zinc-400 border border-zinc-800'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>

                  {/* View Mode Toggle: Figure vs List */}
                  <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setTableDisplayMode('figure')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center space-x-1.5 transition-all cursor-pointer ${
                        tableDisplayMode === 'figure'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Masaları real oval poker masası fiqurunda göstər"
                    >
                      <span>🎴 Qrafik Fiqur</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDisplayMode('list')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center space-x-1.5 transition-all cursor-pointer ${
                        tableDisplayMode === 'list'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Masaları oturacaq siyahısı cədvəlində göstər"
                    >
                      <span>📋 Siyahı</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Tables List */}
              <div className="space-y-6">
                {tables
                  .filter((t) => {
                    if (searchTableTerm) {
                      const term = searchTableTerm.toLowerCase();
                      const matchName = t.name.toLowerCase().includes(term);
                      const matchId = t.id.toLowerCase().includes(term);
                      if (!matchName && !matchId) return false;
                    }
                    if (tableFilterStakes === 'micro') return t.bigBlind <= 0.02;
                    if (tableFilterStakes === 'low') return t.bigBlind > 0.02 && t.bigBlind <= 0.20;
                    if (tableFilterStakes === 'mid') return t.bigBlind > 0.20 && t.bigBlind <= 1.00;
                    if (tableFilterStakes === 'high') return t.bigBlind > 1.00;
                    return true;
                  })
                  .map((t) => {
                    const seatedPlayers = (t.players || []).map((p, idx) => ({ player: p, seatIndex: idx }));
                    const activeCount = (t.players || []).filter((p) => p !== null).length;
                    const humanCount = (t.players || []).filter((p) => p && p.isHuman).length;
                    const botCount = (t.players || []).filter((p) => p && !p.isHuman).length;

                    return (
                      <div
                        key={t.id}
                        className="p-4 sm:p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/40 shadow-2xl space-y-4 transition-all"
                      >
                        {/* Table Header & Info */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-black text-white text-base shadow-lg ring-1 ring-emerald-400/40">
                              ♠
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-base font-black text-white">{t.name}</h4>
                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold">
                                  ID: {t.id}
                                </span>
                                {t.isCustomCreated && (
                                  <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                                    Xüsusi Masa
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-zinc-400">
                                <span className="text-amber-400 font-bold font-mono">
                                  Blinds: ${t.smallBlind.toFixed(2)} / ${t.bigBlind.toFixed(2)}
                                </span>
                                <span>•</span>
                                <span className="text-zinc-300">
                                  Növ: {t.gameType === 'omaha' ? 'Omaha Poker' : "Texas Hold'em"}
                                </span>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold">
                                  Oturacaq: {activeCount}/{t.capacity} ({humanCount} İnsan, {botCount} Bot)
                                </span>
                                <span>•</span>
                                <span className="text-amber-300 font-mono font-bold">
                                  Bank: ${(t.pot || 0).toFixed(2)}
                                </span>
                                <span>•</span>
                                <span className="px-2 py-0.2 rounded-full bg-zinc-800 text-amber-300 font-mono text-[10px] uppercase font-bold">
                                  Mərhələ: {t.stage}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Table Control Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Add Pro Bot Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onAddBotToTable) {
                                  onAddBotToTable(t.id);
                                  soundManager.playChipSound();
                                  confetti({ particleCount: 30, spread: 45 });
                                  showToast(`🤖 ${t.name} masasına %95 Pro AI Bot əlavə edildi!`);
                                }
                              }}
                              disabled={activeCount >= t.capacity}
                              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center space-x-1.5 transition-all cursor-pointer shadow ${
                                activeCount >= t.capacity
                                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20 active:scale-95'
                              }`}
                              title="Masaya bir kliklə 95% Pro AI Bot əlavə et"
                            >
                              <Bot className="w-3.5 h-3.5 text-purple-200" />
                              <span>+ Pro Bot</span>
                            </button>

                            {/* Remove Bot Button */}
                            {botCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onRemoveBotFromTable) {
                                    onRemoveBotFromTable(t.id);
                                    soundManager.playButtonClick();
                                    showToast(`🧹 ${t.name} masasından 1 bot çıxarıldı.`);
                                  }
                                }}
                                className="px-2.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                                title="Masadan 1 botu kənarlaşdır"
                              >
                                <UserMinus className="w-3.5 h-3.5 text-purple-300" />
                                <span>Bot Çıxar</span>
                              </button>
                            )}

                            {/* Change Limits Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTableLimits({
                                  id: t.id,
                                  name: t.name,
                                  smallBlind: t.smallBlind,
                                  bigBlind: t.bigBlind,
                                });
                                setNewSbInput(String(t.smallBlind));
                                setNewBbInput(String(t.bigBlind));
                              }}
                              className="px-2.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                              title="Small Blind və Big Blind limitlərini dəyiş"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                              <span>Limitlər</span>
                            </button>

                            {/* Spectate Table Button */}
                            {onSpectateTable && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSpectateTable(t);
                                  onClose();
                                }}
                                className="px-2.5 py-2 bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                                title="Masanı canlı izləyin"
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span>İzlə</span>
                              </button>
                            )}

                            {/* Close Table Button */}
                            {onCloseTable && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`"${t.name}" masasını tamamilə bağlamaq istədiyinizə əminsiniz? Bütün oyunçular lobbiyə atılacaq.`)) {
                                    onCloseTable(t.id);
                                    soundManager.playErrorSound();
                                    showToast(`⛔ "${t.name}" masası bağlandı.`);
                                  }
                                }}
                                className="px-2.5 py-2 bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                                title="Masanı tamamilə bağla"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                <span>Bağla</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* RENDER TABLE CONTENT: EITHER GRAPHICAL POKER TABLE FIGURE OR SEAT GRID */}
                        {tableDisplayMode === 'figure' ? (
                          <AdminTableFigure
                            table={t}
                            onKickPlayer={onKickPlayer}
                            onAddBotToTable={onAddBotToTable}
                            onRemoveBotFromTable={onRemoveBotFromTable}
                            showToast={showToast}
                          />
                        ) : (
                          /* Seated Players Grid on Table (List Mode) */
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                              <span>Masadakı Oyunçular (Üzərinə basaraq masadan çıxara bilərsiniz):</span>
                              <span className="text-zinc-500">
                                {activeCount === 0 ? 'Heç bir oyunçu yoxdur' : `${activeCount} / ${t.capacity} yer doludur`}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                              {Array.from({ length: t.capacity }).map((_, seatIdx) => {
                                const seatData = seatedPlayers.find((sp) => sp.seatIndex === seatIdx);
                                const player = seatData?.player;

                                if (player) {
                                  return (
                                    <div
                                      key={player.id || seatIdx}
                                      onClick={() => {
                                        if (confirm(`"${player.name}" (${player.isHuman ? 'İnsan' : 'Bot'}) oyunçusunu masadan xaric etmək (Kick) istədiyinizə əminsiniz?`)) {
                                          if (onKickPlayer) {
                                            onKickPlayer(t.id, player.id);
                                            soundManager.playErrorSound();
                                            showToast(`⛔ "${player.name}" masadan xaric edildi.`);
                                          }
                                        }
                                      }}
                                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-sm transition-all cursor-pointer hover:border-red-500 hover:bg-red-950/40 group ${
                                        player.isHuman
                                          ? 'bg-zinc-950/80 border-emerald-500/40'
                                          : 'bg-purple-950/30 border-purple-500/40'
                                      }`}
                                      title="Oyunçunu masadan çıxartmaq (Kick) üçün klikləyin"
                                    >
                                      <div className="flex items-center space-x-2 min-w-0">
                                        <div className="relative shrink-0">
                                          <img
                                            src={player.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.name}`}
                                            alt={player.name}
                                            className="w-8 h-8 rounded-full border border-zinc-700 bg-zinc-900 object-cover group-hover:border-red-500"
                                          />
                                          <span className="absolute -top-1 -left-1 px-1 rounded bg-zinc-800 text-zinc-300 text-[8px] font-mono font-bold">
                                            #{seatIdx + 1}
                                          </span>
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center space-x-1">
                                            <span className="text-xs font-bold text-white truncate group-hover:text-red-300">
                                              {player.name}
                                            </span>
                                            {player.isHuman ? (
                                              <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[8px] font-bold shrink-0">
                                                İnsan
                                              </span>
                                            ) : (
                                              <span className="px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[8px] font-bold shrink-0">
                                                %95 Pro Bot
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-[11px] font-mono font-bold text-amber-400">
                                            ${(player.chips || 0).toFixed(2)}
                                          </div>
                                        </div>
                                      </div>

                                      {/* KICK BUTTON */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm(`"${player.name}" oyunçusunu masadan xaric etmək (Kick) istədiyinizə əminsiniz?`)) {
                                            if (onKickPlayer) {
                                              onKickPlayer(t.id, player.id);
                                              soundManager.playErrorSound();
                                              showToast(`⛔ "${player.name}" masadan xaric edildi.`);
                                            }
                                          }
                                        }}
                                        className="px-2 py-1 bg-red-950/70 hover:bg-red-900 border border-red-500/40 hover:border-red-400 text-red-300 rounded-lg text-[10.5px] font-black transition-all cursor-pointer active:scale-95 shrink-0 flex items-center space-x-1"
                                        title="Oyunçunu dərhal masadan xaric et"
                                      >
                                        <UserX className="w-3 h-3 text-red-400" />
                                        <span>Kick</span>
                                      </button>
                                    </div>
                                  );
                                }

                                // Empty Seat -> Quick Pro Bot Sit-In
                                return (
                                  <div
                                    key={seatIdx}
                                    className="p-2.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 flex items-center justify-between text-xs text-zinc-500"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <span className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center font-mono text-[10px] text-zinc-600">
                                        #{seatIdx + 1}
                                      </span>
                                      <span className="text-zinc-600 font-medium text-[11px]">Boş Yer</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (onAddBotToTable) {
                                          onAddBotToTable(t.id);
                                          soundManager.playChipSound();
                                          showToast(`🤖 Yer #${seatIdx + 1}-ə Pro Bot otuzduruldu.`);
                                        }
                                      }}
                                      className="px-2 py-1 bg-zinc-900 hover:bg-purple-950/60 text-zinc-400 hover:text-purple-300 border border-zinc-800 hover:border-purple-500/30 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                    >
                                      + Pro Bot
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Sub-Modal: Change Table Limits */}
              <AnimatePresence>
                {editingTableLimits && (
                  <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.95, opacity: 0 }}
                      className="w-full max-w-md bg-zinc-950 border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4 text-zinc-100"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                        <div className="flex items-center space-x-2">
                          <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                          <h3 className="text-sm font-black text-white">
                            Limitləri Tənzimlə: {editingTableLimits.name}
                          </h3>
                        </div>
                        <button
                          onClick={() => setEditingTableLimits(null)}
                          className="p-1 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1">
                            Small Blind ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={newSbInput}
                            onChange={(e) => setNewSbInput(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1">
                            Big Blind ($)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={newBbInput}
                            onChange={(e) => setNewBbInput(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingTableLimits(null)}
                          className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Ləğv Et
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const sb = parseFloat(newSbInput);
                            const bb = parseFloat(newBbInput);
                            if (isNaN(sb) || isNaN(bb) || sb <= 0 || bb <= 0 || sb > bb) {
                              showToast('❌ Zəhmət olmasa düzgün Small Blind və Big Blind daxil edin (SB <= BB)');
                              return;
                            }
                            if (onUpdateTableLimits) {
                              onUpdateTableLimits(editingTableLimits.id, sb, bb);
                              soundManager.playChipSound();
                              showToast(`✅ "${editingTableLimits.name}" limitləri yeniləndi: $${sb.toFixed(2)} / $${bb.toFixed(2)}`);
                            }
                            setEditingTableLimits(null);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95"
                        >
                          Təsdiqlə və Tətbiq Et
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          {/* TAB 1: USERS LIST & MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Top Controls: Search, Category Filter Pills & CSV Export */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Ad, e-poçt və ya ID ilə axtarın..."
                      className="w-full bg-zinc-950 border border-zinc-750 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-medium"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Proactive Category Pills */}
                  <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5">
                    {[
                      { id: 'all', label: 'Bütün Oyunçular', icon: Users, count: players.length },
                      { id: 'high_rollers', label: '🔥 Yüksək Balans (>$50)', count: players.filter(p => (p.realBalance || 0) >= 50).length },
                      { id: 'vip', label: '👑 VIP Oyunçular', count: players.filter(p => (p.vipLevel || 1) >= 2).length },
                      { id: 'banned', label: '🚫 Dondurulmuşlar', count: players.filter(p => !!p.isBanned).length },
                      { id: 'messages', label: '💬 Oxunmamış', count: players.filter(p => supportMessages.some(m => m.userId === p.id && m.sender === 'user' && !m.readByAdmin)).length }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { setUserCategoryFilter(cat.id as any); soundManager.playButtonClick(); }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                          userCategoryFilter === cat.id
                            ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 font-black'
                            : 'bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-mono ${
                          userCategoryFilter === cat.id ? 'bg-zinc-950 text-amber-300 font-black' : 'bg-zinc-850 text-zinc-400'
                        }`}>
                          {cat.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right Action: CSV Export & Reload */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportPlayersCSV}
                    className="px-3 py-2 bg-zinc-950 hover:bg-zinc-850 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
                    title="Bütün oyunçuları Excel/CSV formatında yüklə"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>📊 CSV İxrac Et</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { loadAllData(); soundManager.playButtonClick(); }}
                    className="p-2 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl transition-colors cursor-pointer"
                    title="Yenilə"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPlayers ? 'animate-spin text-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Players Table */}
              <div className="border border-zinc-800 rounded-2xl bg-zinc-900/60 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-bold text-[10.5px]">
                      <tr>
                        <th className="px-4 py-3">Oyunçu</th>
                        <th className="px-4 py-3">E-poçt</th>
                        <th className="px-4 py-3">Real Balans</th>
                        <th className="px-4 py-3">Bonus</th>
                        <th className="px-4 py-3">VIP Səviyyə</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Proaktiv Əməliyyatlar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filteredPlayers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-zinc-500 text-xs">
                            Heç bir uyğun oyunçu tapılmadı.
                          </td>
                        </tr>
                      ) : (
                        filteredPlayers.map((player) => {
                          const isAdmin = player.isAdmin || player.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                          const unreadMsgsCount = supportMessages.filter(
                            (m) => m.userId === player.id && m.sender === 'user' && !m.readByAdmin
                          ).length;
                          const totalMsgsCount = supportMessages.filter((m) => m.userId === player.id).length;
                          const isActingOnThis = activeActionPlayerId === player.id;

                          return (
                            <tr key={player.id} className="hover:bg-zinc-850/50 transition-colors">
                              {/* Player Avatar & Details */}
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2.5">
                                  <div className="relative shrink-0">
                                    <img
                                      src={player.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                      alt={player.username}
                                      referrerPolicy="no-referrer"
                                      className="w-9 h-9 rounded-full border border-amber-400/40 object-cover"
                                    />
                                    {unreadMsgsCount > 0 && (
                                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-zinc-900 flex items-center justify-center animate-pulse">
                                        <span className="text-[8px] font-black text-white">{unreadMsgsCount}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-bold text-white flex items-center space-x-1.5 flex-wrap">
                                      <span className="text-sm">{player.username}</span>
                                      {isAdmin && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9.5px] font-black">
                                          👑 ADMIN
                                        </span>
                                      )}
                                      {unreadMsgsCount > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleSelectUserChat(player.id)}
                                          className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all text-[9.5px] font-bold cursor-pointer animate-pulse"
                                          title="Mesajı oxumaq üçün klikləyin"
                                        >
                                          <MessageSquare className="w-2.5 h-2.5" />
                                          <span>{unreadMsgsCount} yeni mesaj</span>
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono">ID: {player.id.slice(0, 10)}...</div>
                                  </div>
                                </div>
                              </td>

                              {/* Email */}
                              <td className="px-4 py-3 text-zinc-300 font-mono text-[11px]">
                                {player.email || '—'}
                              </td>

                              {/* Real Balance */}
                              <td className="px-4 py-3 font-mono font-black text-amber-400 text-sm">
                                ${(player.realBalance || 0).toFixed(2)}
                              </td>

                              {/* Bonus Balance */}
                              <td className="px-4 py-3 font-mono text-zinc-300">
                                ${(player.bonusBalance || 0).toFixed(2)}
                              </td>

                              {/* Interactive VIP Level Switcher */}
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-1">
                                  {[1, 2, 3, 4, 5].map((lvl) => {
                                    const isCurrent = (player.vipLevel || 1) === lvl;
                                    return (
                                      <button
                                        key={lvl}
                                        type="button"
                                        disabled={isActingOnThis}
                                        onClick={() => handleQuickVipChange(player, lvl)}
                                        title={`VIP ${lvl} səviyyəsinə təyin et`}
                                        className={`w-6 h-6 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center justify-center ${
                                          isCurrent
                                            ? 'bg-amber-500 text-zinc-950 font-black shadow ring-1 ring-amber-300 scale-110'
                                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-amber-300'
                                        }`}
                                      >
                                        {lvl}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3">
                                {player.isBanned ? (
                                  <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 text-[10px] font-black inline-flex items-center space-x-1">
                                    <Ban className="w-3 h-3" />
                                    <span>Dondurulub</span>
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold inline-flex items-center space-x-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span>Aktiv</span>
                                  </span>
                                )}
                              </td>

                              {/* Proactive Actions Cell */}
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end space-x-1.5 flex-wrap gap-y-1">
                                  {/* Quick Presets: +$10, +$50, +$100 */}
                                  <div className="flex items-center space-x-1 bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800">
                                    {[10, 50, 100].map((amt) => (
                                      <button
                                        key={amt}
                                        type="button"
                                        disabled={isActingOnThis}
                                        onClick={() => handleQuickBalanceAdjust(player, amt, 'add', 'real')}
                                        title={`${player.username} balansına dərhal +$${amt} əlavə et`}
                                        className="px-1.5 py-0.5 bg-emerald-950/60 hover:bg-emerald-500 text-emerald-300 hover:text-zinc-950 border border-emerald-800/60 hover:border-emerald-400 rounded text-[10px] font-mono font-bold transition-all cursor-pointer active:scale-95"
                                      >
                                        +${amt}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Reset Sit-Out if player missed turns or sitting out */}
                                  <button
                                    type="button"
                                    disabled={isActingOnThis}
                                    onClick={() => handleResetPlayerSitOut(player)}
                                    title="Fasilə / Sit-Out vəziyyətini sıfırla"
                                    className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs transition-colors cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Chat Message Button */}
                                  <button
                                    onClick={() => handleSelectUserChat(player.id)}
                                    title={`Şəxsi mesaj yaz (${totalMsgsCount} mesaj)`}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer ${
                                      unreadMsgsCount > 0
                                        ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/30 animate-pulse'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-amber-400 border border-zinc-700'
                                    }`}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>{unreadMsgsCount > 0 ? `Mesaj (${unreadMsgsCount})` : 'Mesaj'}</span>
                                  </button>

                                  {/* Full Modal Balance Adjust */}
                                  <button
                                    onClick={() => {
                                      setEditingPlayer(player);
                                      setBalanceDelta('');
                                      setBalanceMode('add');
                                    }}
                                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-zinc-950 border border-amber-500/40 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                                  >
                                    Balans Dəyiş
                                  </button>

                                  {/* Ban / Unban */}
                                  {!isAdmin && (
                                    <button
                                      onClick={() => handleToggleBan(player)}
                                      title={player.isBanned ? 'Blokdan çıxar' : 'Dondur / Blokla'}
                                      className={`p-1 rounded-lg border text-xs transition-colors cursor-pointer ${
                                        player.isBanned
                                          ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 hover:bg-emerald-800'
                                          : 'bg-red-950/60 border-red-800 text-red-300 hover:bg-red-900'
                                      }`}
                                    >
                                      {player.isBanned ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPOSIT RECEIPTS & APPROVAL */}
          {activeTab === 'deposits' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-200 flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-amber-400" />
                    <span>Oyunçuların Yüklədiyi Bank Çekləri & Depozitlər</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Çekin şəklini və tarixini incələyib təsdiq etdikdən sonra məbləğ dərhal oyunçunun balansına köçürülür.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Bulk Approve All Pending Deposits */}
                  {pendingDeposits.filter(d => d.status === 'pending' || d.status === 'processing').length > 0 && (
                    <button
                      type="button"
                      disabled={isBulkApprovingDeposits}
                      onClick={handleBulkApproveDeposits}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isBulkApprovingDeposits ? 'Təsdiqlənir...' : `🚀 Bütün Gözləyənləri Təsdiqlə (${pendingDeposits.filter(d => d.status === 'pending' || d.status === 'processing').length})`}</span>
                    </button>
                  )}

                  {/* Filter Pills */}
                  <div className="flex items-center space-x-1.5 bg-zinc-950 p-1 border border-zinc-800 rounded-xl shrink-0">
                    {(['all', 'pending', 'completed', 'rejected'] as const).map((f) => {
                      const count = f === 'all' 
                        ? pendingDeposits.length 
                        : f === 'pending'
                        ? pendingDeposits.filter(d => d.status === 'pending' || d.status === 'processing').length
                        : pendingDeposits.filter(d => d.status === f).length;
                      return (
                        <button
                          key={f}
                          onClick={() => { setDepositFilter(f); soundManager.playButtonClick(); }}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                            depositFilter === f
                              ? 'bg-amber-500 text-zinc-950 shadow font-black'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <span className="capitalize">
                            {f === 'all' ? 'Hamısı' : f === 'pending' ? 'Gözləyənlər' : f === 'completed' ? 'Təsdiqlənənlər' : 'İmtina'}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${depositFilter === f ? 'bg-zinc-950 text-amber-300 font-black' : 'bg-zinc-850 text-zinc-400'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {pendingDeposits.filter(d => {
                if (depositFilter === 'all') return true;
                if (depositFilter === 'pending') return d.status === 'pending' || d.status === 'processing';
                return d.status === depositFilter;
              }).length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                  <ArrowDownRight className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">Bu kateqoriyada heç bir depozit çeki yoxdur.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  {pendingDeposits
                    .filter(d => {
                      if (depositFilter === 'all') return true;
                      if (depositFilter === 'pending') return d.status === 'pending' || d.status === 'processing';
                      return d.status === depositFilter;
                    })
                    .map((dep) => {
                      const isPending = dep.status === 'pending' || dep.status === 'processing';
                      return (
                        <div
                          key={dep.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            dep.status === 'completed'
                              ? 'bg-zinc-900/50 border-emerald-900/30 shadow-sm'
                              : dep.status === 'rejected'
                              ? 'bg-red-950/20 border-red-900/40 opacity-80'
                              : 'bg-zinc-900 border-amber-500/60 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center space-x-2 flex-wrap">
                                <span className="text-base font-black text-emerald-400 font-mono">
                                  +${dep.amount.toFixed(2)} {dep.currency || 'USD'}
                                </span>
                                <span className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold flex items-center space-x-1 ${
                                  dep.status === 'completed'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                    : dep.status === 'rejected'
                                    ? 'bg-red-950 text-red-300 border border-red-700'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                }`}>
                                  {isPending && <Clock className="w-3 h-3 animate-spin" />}
                                  {dep.status === 'completed' ? '✅ Təsdiqləndi' : dep.status === 'rejected' ? '❌ İmtina Edildi' : '⏳ Admin Təsdiqi Gözləyir'}
                                </span>
                              </div>

                              <div className="text-xs text-zinc-300 flex items-center space-x-1">
                                <span className="text-zinc-500">Oyunçu:</span>
                                <b className="text-zinc-100 font-bold">{dep.username || 'Oyunçu'}</b>
                                {dep.userEmail && (
                                  <span className="text-[10px] text-zinc-500">({dep.userEmail})</span>
                                )}
                              </div>

                              {/* Timestamps */}
                              <div className="space-y-0.5 text-[11px] text-zinc-400">
                                {dep.receiptTimestamp && (
                                  <div className="flex items-center space-x-1 text-amber-400/90 font-mono text-[10.5px]">
                                    <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>Çekin Tarixi: {new Date(dep.receiptTimestamp).toLocaleString('az-AZ')}</span>
                                  </div>
                                )}
                                <div className="flex items-center space-x-1 text-zinc-500 text-[10.5px]">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  <span>Göndərilib: {new Date(dep.createdAt).toLocaleString('az-AZ')}</span>
                                </div>
                              </div>
                            </div>

                            {/* Receipt Preview Thumbnail */}
                            {dep.receiptPreviewUrl && (
                              <div className="flex flex-col items-center space-y-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectingDeposit(dep);
                                    setReceiptZoom(1);
                                    setReceiptRotation(0);
                                    soundManager.playButtonClick();
                                  }}
                                  className="relative group w-16 h-16 rounded-xl border border-zinc-700 overflow-hidden bg-zinc-950 cursor-pointer shadow-md hover:border-amber-400 transition-all"
                                >
                                  <img
                                    src={dep.receiptPreviewUrl}
                                    alt="Receipt"
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-[9px] font-bold">
                                    <Eye className="w-4 h-4 mb-0.5" />
                                    <span>Bax</span>
                                  </div>
                                </button>
                                <span className="text-[10px] text-zinc-500 max-w-[70px] truncate text-center">
                                  {dep.receiptName}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Inspection & Action Buttons */}
                          <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-zinc-800/80">
                            <button
                              type="button"
                              onClick={() => {
                                setInspectingDeposit(dep);
                                setReceiptZoom(1);
                                setReceiptRotation(0);
                                soundManager.playButtonClick();
                              }}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 hover:text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-400" />
                              <span>Çeki İncələ</span>
                            </button>

                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveDeposit(dep.id)}
                                  className="flex-1 py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Təsdiqlə (+ Balansa Yaz)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectDeposit(dep.id)}
                                  className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold rounded-xl text-xs transition-colors cursor-pointer active:scale-95"
                                >
                                  İmtina
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WITHDRAWAL REQUESTS */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-200">
                    Oyunçuların Pul Çıxarış Tələbləri (Ödənişlər)
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Kart nömrəsinə bir kliklə toxunaraq kopyalayın və ödənişi təsdiqləyin.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {withdrawals.filter(w => w.status === 'pending').length > 0 && (
                    <button
                      type="button"
                      disabled={isBulkApprovingWithdrawals}
                      onClick={handleBulkApproveWithdrawals}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isBulkApprovingWithdrawals ? 'İcra Edilir...' : `⚡ Bütün Gözləyənləri Təsdiqlə (${withdrawals.filter(w => w.status === 'pending').length})`}</span>
                    </button>
                  )}
                  <span className="text-xs text-zinc-400 font-mono">
                    Cəmi: <b>{withdrawals.length}</b> müraciət
                  </span>
                </div>
              </div>

              {withdrawals.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                  <ArrowUpRight className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">Hazırda heç bir çıxarış tələbi yoxdur.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {withdrawals.map((w) => {
                    const isCopied = copiedCardId === w.id;
                    return (
                      <div
                        key={w.id}
                        className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-base font-black text-amber-400 font-mono">
                              ${w.amount.toFixed(2)} {w.currency || 'USD'}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              w.status === 'approved'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : w.status === 'rejected'
                                ? 'bg-red-950 text-red-300 border border-red-700'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                            }`}>
                              {w.status === 'approved' ? '✅ Ödənildi' : w.status === 'rejected' ? '❌ İmtina Edildi' : '⏳ Gözləyir'}
                            </span>
                          </div>

                          <div className="text-xs text-zinc-300">
                            Oyunçu: <b className="text-white">{w.username}</b> • Bank: <span className="text-zinc-400 font-semibold">{w.bankName || 'Kapital / ABB'}</span>
                          </div>

                          {/* 1-Click Copy Card Number Button */}
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleCopyCardNumber(w.cardNumber, w.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
                                isCopied
                                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-md scale-102'
                                  : 'bg-zinc-950 hover:bg-zinc-850 text-amber-300 border-zinc-750 hover:border-amber-400'
                              }`}
                              title="Kart nömrəsini birbaşa kopyalamaq üçün klikləyin"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>{w.cardNumber}</span>
                              {isCopied && <span className="text-[10px] font-black uppercase ml-1">✓ Kopyalandı!</span>}
                            </button>
                          </div>
                        </div>

                        {w.status === 'pending' && (
                          <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                            <button
                              onClick={() => handleApproveWithdrawal(w.id)}
                              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center space-x-1 cursor-pointer active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Ödəndi / Təsdiqlə</span>
                            </button>
                            <button
                              onClick={() => handleRejectWithdrawal(w.id)}
                              className="px-3 py-2 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold rounded-xl text-xs transition-colors cursor-pointer active:scale-95"
                            >
                              İmtina
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LIVE PLAYER SUPPORT & MESSAGING */}
          {activeTab === 'messages' && (() => {
            // Group messages by userId
            const threadsMap = new Map<string, {
              userId: string;
              username: string;
              userEmail: string;
              userAvatar?: string;
              unreadCount: number;
              latestMessage?: SupportMessage;
              messages: SupportMessage[];
            }>();

            // First populate all known players so admin can start chat with ANY player
            players.forEach((p) => {
              threadsMap.set(p.id, {
                userId: p.id,
                username: p.username || 'Oyunçu',
                userEmail: p.email || '',
                userAvatar: p.avatar,
                unreadCount: 0,
                latestMessage: undefined,
                messages: [],
              });
            });

            // Populate from supportMessages
            supportMessages.forEach((msg) => {
              if (!threadsMap.has(msg.userId)) {
                threadsMap.set(msg.userId, {
                  userId: msg.userId,
                  username: msg.username,
                  userEmail: msg.userEmail,
                  userAvatar: msg.userAvatar,
                  unreadCount: 0,
                  latestMessage: msg,
                  messages: [],
                });
              }
              const thread = threadsMap.get(msg.userId)!;
              thread.messages.push(msg);
              if (msg.sender === 'user' && !msg.readByAdmin) {
                thread.unreadCount++;
              }
              if (!thread.latestMessage || (msg.createdAt || 0) >= (thread.latestMessage.createdAt || 0)) {
                thread.latestMessage = msg;
                if (msg.username) thread.username = msg.username;
                if (msg.userEmail) thread.userEmail = msg.userEmail;
                if (msg.userAvatar) thread.userAvatar = msg.userAvatar;
              }
            });

            // Convert to array: Prioritize unread messages first, then latest messages, then all players
            const threadList = Array.from(threadsMap.values()).sort((a, b) => {
              if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
              const timeA = a.latestMessage?.createdAt || 0;
              const timeB = b.latestMessage?.createdAt || 0;
              if (timeA !== timeB) return timeB - timeA;
              return a.username.localeCompare(b.username);
            });

            // Filter threads by search term
            const filteredThreads = threadList.filter(t => {
              const q = searchChatTerm.toLowerCase().trim();
              if (!q) return true;
              return (
                t.username.toLowerCase().includes(q) ||
                t.userEmail.toLowerCase().includes(q) ||
                (t.latestMessage?.text || '').toLowerCase().includes(q)
              );
            });

            // Active thread messages
            const activeThread = selectedChatUserId ? threadsMap.get(selectedChatUserId) : null;
            const activePlayer = players.find(p => p.id === selectedChatUserId);
            const activeMessages = activeThread ? activeThread.messages : [];

            return (
              <div className="flex flex-col lg:flex-row gap-4 h-[560px] bg-zinc-950/60 rounded-2xl border border-zinc-800 overflow-hidden">
                {/* Left Sidebar: Conversations List */}
                <div className="w-full lg:w-80 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800 bg-zinc-900/60">
                  {/* Search and Header */}
                  <div className="p-3 border-b border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MessageSquare className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white">Canlı Dialoqlar</span>
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                        {threadList.length} oyunçu
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchChatTerm}
                        onChange={(e) => setSearchChatTerm(e.target.value)}
                        placeholder="Oyunçu və ya mesaj axtar..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Threads Feed */}
                  <div className="flex-1 overflow-y-auto divide-y divide-zinc-850 p-1 space-y-0.5">
                    {filteredThreads.length === 0 ? (
                      <div className="p-6 text-center text-zinc-500 text-xs">
                        <MessageCircle className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                        <p>Hazırda heç bir mesaj yoxdur.</p>
                        <p className="text-[11px] text-zinc-600 mt-1">Oyunçular yazdıqda burada görünəcək.</p>
                      </div>
                    ) : (
                      filteredThreads.map((thread) => {
                        const isSelected = selectedChatUserId === thread.userId;
                        const playerInfo = players.find(p => p.id === thread.userId);
                        return (
                          <button
                            key={thread.userId}
                            onClick={() => handleSelectUserChat(thread.userId)}
                            className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start space-x-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border border-amber-500/40 text-white shadow'
                                : 'hover:bg-zinc-850/60 text-zinc-300 border border-transparent'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <img
                                src={thread.userAvatar || playerInfo?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                alt={thread.username}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full border border-zinc-700 object-cover"
                              />
                              {thread.unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center animate-pulse shadow">
                                  {thread.unreadCount}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-white truncate max-w-[120px]">
                                  {thread.username}
                                </span>
                                {thread.latestMessage && (
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    {new Date(thread.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-zinc-400 truncate mt-0.5 flex items-center space-x-1">
                                {thread.latestMessage ? (
                                  <>
                                    {thread.latestMessage.sender === 'admin' && (
                                      <span className="text-amber-400 font-bold text-[10px]">[Siz]:</span>
                                    )}
                                    <span>{thread.latestMessage.text}</span>
                                  </>
                                ) : (
                                  <span className="text-zinc-500 italic">Mesaj yazmaq üçün klikləyin...</span>
                                )}
                              </div>

                              {playerInfo && (
                                <div className="mt-1 flex items-center space-x-2 text-[10px] text-zinc-500">
                                  <span className="text-amber-400 font-mono font-bold">${(playerInfo.realBalance || 0).toFixed(2)}</span>
                                  <span>•</span>
                                  <span>VIP {playerInfo.vipLevel || 1}</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Area: Active Chat Window */}
                <div className="flex-1 flex flex-col bg-zinc-950/40">
                  {selectedChatUserId ? (
                    <>
                      {/* Chat Header */}
                      <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            src={activeThread?.userAvatar || activePlayer?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                            alt={activeThread?.username || 'Oyunçu'}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full border border-amber-500/40 object-cover"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-black text-white">{activeThread?.username || activePlayer?.username || 'Oyunçu'}</h4>
                              {activePlayer && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded-full font-bold">
                                  VIP {activePlayer.vipLevel || 1}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center space-x-2">
                              <span>{activeThread?.userEmail || activePlayer?.email || 'Email yoxdur'}</span>
                              {activePlayer && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400 font-mono font-bold">
                                    Balans: ${(activePlayer.realBalance || 0).toFixed(2)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {activePlayer && (
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            {/* Instant Gift Action Presets directly in Chat */}
                            <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                              <span className="text-[10px] text-zinc-500 font-bold px-1 uppercase">Hədiyyə:</span>
                              <button
                                type="button"
                                onClick={() => handleDirectChatGift(5, 'bonus')}
                                className="px-2 py-1 bg-purple-950/70 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-700/60 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer"
                                title="+$5 Hədiyyə Bonusu ver və bildiriş göndər"
                              >
                                🎁 +$5 Bonus
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDirectChatGift(10, 'bonus')}
                                className="px-2 py-1 bg-purple-950/70 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-700/60 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer"
                                title="+$10 Hədiyyə Bonusu ver və bildiriş göndər"
                              >
                                🎁 +$10 Bonus
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDirectChatGift(25, 'real')}
                                className="px-2 py-1 bg-emerald-950/70 hover:bg-emerald-600 text-emerald-300 hover:text-zinc-950 border border-emerald-700/60 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer"
                                title="+$25 Real Balans ver və bildiriş göndər"
                              >
                                💵 +$25 Real
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingPlayer(activePlayer);
                                setBalanceDelta('');
                                setBalanceMode('add');
                              }}
                              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-zinc-950 border border-amber-500/40 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Balans Dəyiş</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Messages Stream */}
                      <div className="flex-1 p-4 overflow-y-auto space-y-3">
                        {activeMessages.length === 0 ? (
                          <div className="text-center py-12 text-zinc-500 text-xs">
                            Bu oyunçu ilə mesaj tarixçəsi boşdur.
                          </div>
                        ) : (
                          activeMessages.map((msg) => {
                            const isAdminMsg = msg.sender === 'admin';
                            return (
                              <div
                                key={msg.id}
                                className={`flex flex-col ${isAdminMsg ? 'items-end' : 'items-start'}`}
                              >
                                <div className="flex items-center space-x-1.5 mb-1 px-1">
                                  <span className={`text-[10px] font-bold ${isAdminMsg ? 'text-amber-400' : 'text-zinc-400'}`}>
                                    {isAdminMsg ? '👑 SUPER ADMİN' : msg.username || 'Oyunçu'}
                                  </span>
                                  <span className="text-[9.5px] text-zinc-600 font-mono">
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>

                                <div
                                  className={`max-w-md p-3 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                                    isAdminMsg
                                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-semibold rounded-tr-sm shadow-amber-950/20'
                                      : 'bg-zinc-900 border border-zinc-750 text-zinc-100 rounded-tl-sm shadow-black/40'
                                  }`}
                                >
                                  {msg.text}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Fast Action Quick Reply Chips */}
                      <div className="px-4 py-2 bg-zinc-900/60 border-t border-zinc-850 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0">Sürətli Cavab:</span>
                        {[
                          '✅ Depozitiniz təsdiqləndi və balansınıza əlavə edildi.',
                          '💸 Çıxarış tələbiniz icra edildi, vəsait kartınıza göndərildi.',
                          '📸 Zəhmət olmasa ödəniş çekini tam aydın şəkildə göndərin.',
                          '👋 Salam, Poker Dəstək xidmətinə xoş gəlmisiniz! Sizə necə kömək edə bilərik?',
                          '🎁 Hesabınıza xüsusi təbrik bonusu təqdim edildi!'
                        ].map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendAdminReply(undefined, chip)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-amber-500 hover:text-zinc-950 text-zinc-300 text-[11px] font-medium border border-zinc-750 hover:border-amber-400 whitespace-nowrap transition-all shrink-0 cursor-pointer"
                          >
                            {chip.slice(0, 24)}...
                          </button>
                        ))}
                      </div>

                      {/* Message Input Bar */}
                      <form
                        onSubmit={(e) => handleSendAdminReply(e)}
                        className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center space-x-2"
                      >
                        <input
                          type="text"
                          value={adminReplyText}
                          onChange={(e) => setAdminReplyText(e.target.value)}
                          placeholder="Oyunçuya rəsmi cavab yazın... (Enter ilə göndər)"
                          className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-medium"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!adminReplyText.trim()}
                          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Göndər</span>
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">Oyunçu ilə Mesajlaşma Paneli</h4>
                      <p className="text-xs text-zinc-400 max-w-sm">
                        Sol tərəfdəki siyahıdan hər hansı bir oyunçunun üzərinə toxunaraq canlı dəstək söhbətinə başlayın və ya suallarını cavablandırın.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 5: MASA FAİZLƏRİ (%10 RAKE) */}
          {activeTab === 'rakes' && (
            <div className="space-y-4">
              {/* Hero Overview & Quick Claim Bar */}
              <div className="bg-gradient-to-br from-amber-950/50 via-zinc-900 to-zinc-950 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <Percent className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white">
                        Masa Faizləri (%10 Masa Faizi / Table Rake)
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-400 max-w-xl">
                      Masalarda oynanan hər bir əlin ümumi bankından (pot) avtomatik <strong>10% masa faizi</strong> tutulur və burada real vaxtda toplanır. Yığılmış faizləri bir toxunuşla Admin Real Balansınıza köçürə bilərsiniz.
                    </p>
                  </div>

                  {/* Claim Button */}
                  <div className="shrink-0 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={handleClaimAllRakes}
                      disabled={unclaimedRakesSum <= 0 || isClaimingRakes}
                      id="claim_table_rakes_btn"
                      className={`w-full sm:w-auto px-5 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-xl transition-all ${
                        unclaimedRakesSum > 0 && !isClaimingRakes
                          ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 shadow-emerald-500/25 active:scale-95 cursor-pointer ring-2 ring-emerald-400/40'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <Coins className="w-4 h-4 text-zinc-950" />
                      <span>
                        {isClaimingRakes
                          ? 'Köçürülür...'
                          : unclaimedRakesSum > 0
                          ? `💰 Faizləri Balansa Köçür (+$${unclaimedRakesSum.toFixed(2)})`
                          : 'Bütün Faizlər Köçürülüb'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-zinc-400 block font-medium">Toplanan Cəmi Faiz (10%)</span>
                      <span className="text-base sm:text-lg font-black text-amber-400 font-mono">
                        ${totalRakesSum.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="bg-zinc-950/80 border border-emerald-500/40 rounded-xl p-3 flex items-center justify-between bg-gradient-to-r from-emerald-950/20 to-zinc-950">
                    <div>
                      <span className="text-[11px] text-emerald-400 block font-bold">Yığılan / Köçürülməmiş</span>
                      <span className="text-base sm:text-lg font-black text-emerald-300 font-mono flex items-center space-x-1">
                        <span>${unclaimedRakesSum.toFixed(2)}</span>
                        {unclaimedRakesSum > 0 && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Coins className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-zinc-400 block font-medium">Oynanmış Əllər / Qeydlər</span>
                      <span className="text-base sm:text-lg font-black text-zinc-200 font-mono">
                        {totalHandsCount} əl
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchRakeTerm}
                    onChange={(e) => setSearchRakeTerm(e.target.value)}
                    placeholder="Masa adı, oyunçu və ya əl #..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 placeholder-zinc-500"
                  />
                  {searchRakeTerm && (
                    <button
                      onClick={() => setSearchRakeTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center space-x-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setRakeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      rakeFilter === 'all'
                        ? 'bg-amber-500 text-zinc-950 font-black'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    Hamısı ({tableRakes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRakeFilter('unclaimed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      rakeFilter === 'unclaimed'
                        ? 'bg-emerald-500 text-zinc-950 font-black'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    Yığılıb / Gözləyən ({tableRakes.filter(r => !r.claimed).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRakeFilter('claimed')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      rakeFilter === 'claimed'
                        ? 'bg-blue-500 text-zinc-950 font-black'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    Köçürülmüş ({tableRakes.filter(r => r.claimed).length})
                  </button>
                </div>
              </div>

              {/* Table / List of Table Rakes */}
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950 border-b border-zinc-800 text-[11px] uppercase font-bold text-zinc-400 tracking-wider">
                      <tr>
                        <th className="py-3 px-3.5">Masa & Əl #</th>
                        <th className="py-3 px-3.5">Cəmi Bank (Pot)</th>
                        <th className="py-3 px-3.5 text-amber-400 font-black">10% Masa Faizi (Rake)</th>
                        <th className="py-3 px-3.5">Qalib Oyunçu & Net Uduş</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Tarix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {tableRakes
                        .filter(r => {
                          if (rakeFilter === 'unclaimed' && r.claimed) return false;
                          if (rakeFilter === 'claimed' && !r.claimed) return false;
                          const q = searchRakeTerm.toLowerCase().trim();
                          if (!q) return true;
                          return (
                            (r.tableName && r.tableName.toLowerCase().includes(q)) ||
                            (r.winnerName && r.winnerName.toLowerCase().includes(q)) ||
                            (r.handNumber && String(r.handNumber).includes(q)) ||
                            (r.gameType && r.gameType.toLowerCase().includes(q))
                          );
                        })
                        .map((rake) => (
                          <tr
                            key={rake.id}
                            className="hover:bg-zinc-850/60 transition-colors"
                          >
                            {/* Table & Hand Info */}
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-white flex items-center space-x-1.5">
                                <span>{rake.tableName}</span>
                                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.2 rounded">
                                  #{rake.handNumber}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400 capitalize">
                                {rake.gameType === 'texas_holdem' ? "Texas Hold'em" : 'Omaha'}
                              </div>
                            </td>

                            {/* Total Pot */}
                            <td className="py-3 px-3.5 font-mono font-bold text-zinc-200">
                              ${rake.totalPot.toFixed(2)}
                            </td>

                            {/* 10% Table Rake Amount */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center space-x-1">
                                <span className="text-amber-400 font-mono font-black text-sm bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                                  +${rake.rakeAmount.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-amber-500/80 font-bold">(10%)</span>
                              </div>
                            </td>

                            {/* Winner Name & Net Pot Won */}
                            <td className="py-3 px-3.5">
                              <div className="flex items-center space-x-2">
                                <img
                                  src={rake.winnerAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&auto=format&fit=crop&q=80'}
                                  alt={rake.winnerName}
                                  className="w-6 h-6 rounded-full border border-amber-500/40 object-cover"
                                />
                                <div>
                                  <div className="font-bold text-white text-xs">{rake.winnerName}</div>
                                  <div className="text-[10.5px] font-mono text-emerald-400">
                                    Qazandı: +${rake.netPotWon.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3.5">
                              {rake.claimed ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10.5px] font-semibold">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Adminə Köçürülüb</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10.5px] font-bold animate-pulse">
                                  <Coins className="w-3 h-3 text-emerald-400" />
                                  <span>Yığılıb (Gözləyir)</span>
                                </span>
                              )}
                            </td>

                            {/* Date */}
                            <td className="py-3 px-3.5 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                              {new Date(rake.timestamp).toLocaleString('az-AZ', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>

                  {/* Empty state */}
                  {tableRakes.length === 0 && (
                    <div className="py-12 px-4 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                        <Percent className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        Hələlik masa faizi qeydi yoxdur
                      </h4>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                        Masalarda oyunçular oynadıqca hər əlin uduşundan <strong>%10 masa faizi</strong> avtomatik tutularaq burada real vaxtda toplanacaq.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SYSTEM BANK CARD & CASHIER SETTINGS & BROADCAST */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-3xl">
              {/* Broadcast Live Announcement Section */}
              <div className="bg-gradient-to-br from-amber-950/40 via-zinc-900 to-zinc-950 p-5 rounded-2xl border border-amber-500/40 shadow-xl space-y-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Megaphone className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center space-x-2">
                      <span>Canlı Sistem Elanı Yay (Bütün Masalara & Lobbiyə)</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9.5px] font-black uppercase">
                        Real-time Broadcast
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Buradan yazdığınız rəsmi elan bütün aktiv poker masalarında və ana səhifədə canlı ticker/banner kimi görünəcək.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleBroadcastAnnouncement} className="space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={broadcastInput}
                      onChange={(e) => setBroadcastInput(e.target.value)}
                      placeholder={systemConfig.systemAnnouncement || 'Məsələn: 🎉 Həftəsonu böyük turniri saat 20:00-da başlayır! Depozitlərinizə +20% bonus!'}
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-medium"
                    />
                    <button
                      type="submit"
                      disabled={isBroadcasting || !broadcastInput.trim()}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-zinc-950 font-black rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95 shrink-0"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{isBroadcasting ? 'Yayımlanır...' : '📢 Canlı Elan Yay'}</span>
                    </button>
                  </div>

                  {/* Quick Preset Announcement Chips */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pt-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase shrink-0">Hazır Elanlar:</span>
                    {[
                      '🎉 Xoş gəldin bonusları aktivdir! Qeydiyyatdan keçən hər kəsə pulsuz balans!',
                      '⚡ Həftəsonu xüsusi Omaha və Texas Holdem turniri saat 21:00-da!',
                      '💳 Depozitlər və çıxarışlar 24/7 rejimdə dərhal icra edilir!',
                      '👑 VIP oyunçularımız üçün masalarda 0% masa komissiyası kampaniyası!'
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setBroadcastInput(preset)}
                        className="px-2.5 py-1 rounded-lg bg-zinc-850 hover:bg-amber-500 hover:text-zinc-950 text-zinc-400 hover:text-zinc-950 text-[10.5px] font-medium border border-zinc-750 transition-all whitespace-nowrap cursor-pointer shrink-0"
                      >
                        {preset.slice(0, 32)}...
                      </button>
                    ))}
                  </div>

                  {systemConfig.systemAnnouncement && (
                    <div className="p-2.5 bg-zinc-950/80 rounded-xl border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                      <div className="flex items-center space-x-2 truncate">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                        <span className="font-bold shrink-0">Aktiv Elan:</span>
                        <span className="truncate text-zinc-200">{systemConfig.systemAnnouncement}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = { ...systemConfig, systemAnnouncement: '' };
                          setSystemConfig(updated);
                          adminStorage.saveConfig(updated);
                          await saveSystemConfigToFirestore(updated);
                          showToast('🗑️ Aktiv canlı elan dayandırıldı.');
                        }}
                        className="text-[11px] text-red-400 hover:text-red-300 font-bold shrink-0 ml-2 cursor-pointer"
                      >
                        Ləğv Et
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* Official Bank Card & Cashier Settings */}
              <form onSubmit={handleSaveSystemConfig} className="space-y-4 bg-zinc-900/70 p-5 rounded-2xl border border-zinc-800 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">Rəsmi Bank Kartı və Depozit Ayarları</h3>
                    <p className="text-xs text-zinc-400">
                      Oyunçular "Depozit" etdikdə ekranda görünən rəsmi kart və limitlər
                    </p>
                  </div>
                  {configSavedToast && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center space-x-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Yadda saxlanıldı</span>
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Rəsmi Bank Kart Nömrəsi (Depozit üçün)</label>
                    <input
                      type="text"
                      value={systemConfig.officialCardNumber}
                      onChange={(e) => setSystemConfig({ ...systemConfig, officialCardNumber: e.target.value })}
                      placeholder="5411 2498 1229 0497"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-amber-300 font-mono text-sm focus:outline-none focus:border-amber-500 font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-zinc-300 font-bold mb-1">Kart Sahibi (Ad Soyad)</label>
                      <input
                        type="text"
                        value={systemConfig.officialCardHolder}
                        onChange={(e) => setSystemConfig({ ...systemConfig, officialCardHolder: e.target.value })}
                        placeholder="ROYAL POKER OFFICIAL"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-300 font-bold mb-1">Bank Adı</label>
                      <input
                        type="text"
                        value={systemConfig.officialBank}
                        onChange={(e) => setSystemConfig({ ...systemConfig, officialBank: e.target.value })}
                        placeholder="Kapital Bank / ABB / Visa Direct"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div>
                      <label className="block text-zinc-400 mb-1">Min Depozit ($)</label>
                      <input
                        type="number"
                        value={systemConfig.minDeposit}
                        onChange={(e) => setSystemConfig({ ...systemConfig, minDeposit: Number(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Maks Depozit ($)</label>
                      <input
                        type="number"
                        value={systemConfig.maxDeposit}
                        onChange={(e) => setSystemConfig({ ...systemConfig, maxDeposit: Number(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Min Çıxarış ($)</label>
                      <input
                        type="number"
                        value={systemConfig.minWithdraw}
                        onChange={(e) => setSystemConfig({ ...systemConfig, minWithdraw: Number(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Maks Çıxarış ($)</label>
                      <input
                        type="number"
                        value={systemConfig.maxWithdraw}
                        onChange={(e) => setSystemConfig({ ...systemConfig, maxWithdraw: Number(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-zinc-300 font-bold mb-1">Xoş Gəldin Qeydiyyat Bonusu ($)</label>
                    <input
                      type="number"
                      value={systemConfig.welcomeBonusAmount}
                      onChange={(e) => setSystemConfig({ ...systemConfig, welcomeBonusAmount: Number(e.target.value) })}
                      className="w-48 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-amber-400 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Dəyişiklikləri Yadda Saxla</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 7: BOT SETTINGS (AI OTAĞI) */}
          {activeTab === 'bots' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Header Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/60 via-zinc-900/90 to-amber-950/40 border border-purple-500/40 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-amber-500 p-0.5 flex items-center justify-center shadow-lg shadow-purple-500/20">
                      <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                        <Bot className="w-6 h-6 text-amber-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white flex items-center space-x-2">
                        <span>Süni İntellekt Bot Mühərriki & Tənzimləmə Otağı</span>
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-black uppercase">
                          AI Engine 2.0
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Sistemdəki avtomatik poker botlarının oyun səviyyəsini, insan kimi düşünmə fasilələrini və masaya daxilolma/çıxma davranışlarını buradan idarə edin.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={async () => {
                        setIsSavingBotConfig(true);
                        await saveBotSystemConfigToFirestore(botConfig);
                        setIsSavingBotConfig(false);
                        soundManager.playChipSound();
                        showToast('✓ Bot tənzimləmələri uğurla yadda saxlanıldı və aktiv edildi!');
                      }}
                      disabled={isSavingBotConfig}
                      className="px-4 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:opacity-95 text-white font-black rounded-xl text-xs flex items-center space-x-2 shadow-lg shadow-purple-500/30 active:scale-95 transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingBotConfig ? 'Yadda Saxlanılır...' : 'Bütün Dəyişiklikləri Yadda Saxla'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* MASTER BOT TOGGLE: AKTİV ET / DEAKTİV ET */}
              <div className={`p-5 rounded-2xl border transition-all shadow-xl ${
                botConfig.isBotsActive === true
                  ? 'bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-zinc-950 border-emerald-500/50 shadow-emerald-950/40'
                  : 'bg-gradient-to-r from-red-950/70 via-zinc-900 to-zinc-950 border-red-500/50 shadow-red-950/40'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`w-3 h-3 rounded-full ${botConfig.isBotsActive === true ? 'bg-emerald-400 animate-ping' : 'bg-red-500'}`} />
                      <h4 className="text-base font-black text-white">
                        Əsas Bot Vəziyyəti: {botConfig.isBotsActive === true ? (
                          <span className="text-emerald-400">AKTİV (Botlar Masalarda Oynayır)</span>
                        ) : (
                          <span className="text-red-400">DEAKTİV (Bütün Botlar Masalardan Ləğv Edilib)</span>
                        )}
                      </h4>
                    </div>
                    <p className="text-xs text-zinc-350">
                      {botConfig.isBotsActive === true 
                        ? 'Botlar aktivdir və masalara daxil olaraq hərəkət edir, mühərrik fasiləsiz işləyir.'
                        : 'Botlar tamamilə söndürülüb. Masalardakı bütün botlar ləğv edilir və heç bir bot masaya daxil ola bilməz.'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    {/* BOTLARI AKTİV ET DÜYMƏSİ */}
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = { ...botConfig, isBotsActive: true, autoJoinLeaveEnabled: true };
                        setBotConfig(updated);
                        await saveBotSystemConfigToFirestore(updated);
                        soundManager.playWinSound();
                        confetti({ particleCount: 40, spread: 50 });
                        showToast('⚡ BOTLAR AKTİV EDİLDİ! Masalarda botlar hərəkətə başladı.');
                      }}
                      className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg ${
                        botConfig.isBotsActive === true
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-zinc-950 ring-2 ring-emerald-300 shadow-emerald-500/30 scale-102'
                          : 'bg-zinc-900 hover:bg-emerald-950/50 text-emerald-400 border border-emerald-500/30 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <Zap className="w-4 h-4 text-zinc-950" />
                      <span>BOTLARI AKTİV ET</span>
                      {botConfig.isBotsActive === true && <Check className="w-3.5 h-3.5 ml-1" />}
                    </button>

                    {/* BOTLARI DEAKTİV ET DÜYMƏSİ */}
                    <button
                      type="button"
                      onClick={async () => {
                        const updated = { ...botConfig, isBotsActive: false, autoJoinLeaveEnabled: false };
                        setBotConfig(updated);
                        await saveBotSystemConfigToFirestore(updated);
                        soundManager.playFoldSound();
                        showToast('⛔ BOTLAR DEAKTİV EDİLDİ! Bütün botlar masalardan ləğv edildi.');
                      }}
                      className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg ${
                        botConfig.isBotsActive !== true
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white ring-2 ring-red-400 shadow-red-500/30 scale-102'
                          : 'bg-zinc-900 hover:bg-red-950/50 text-red-400 border border-red-500/30 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>BOTLARI DEAKTİV ET</span>
                      {botConfig.isBotsActive !== true && <Check className="w-3.5 h-3.5 ml-1" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 1: BOT DIFFICULTY SELECTOR (ZƏİF / ORTA / PRO BOT) */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      Bot Oyun Rejimi & Çətinlik Səviyyəsi
                    </h4>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Sistem siz dəyişənə qədər həmişə <strong className="text-amber-400">PRO BOT</strong> rejimini saxlayır.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Button 1: ZƏİF BOT */}
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = { ...botConfig, botDifficulty: 'weak' as const };
                      setBotConfig(updated);
                      await saveBotSystemConfigToFirestore(updated);
                      soundManager.playButtonClick();
                      showToast('Bot rejimi: ZƏİF BOT olaraq təyin edildi.');
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                      botConfig.botDifficulty === 'weak'
                        ? 'bg-zinc-900 border-zinc-500 ring-2 ring-zinc-400 shadow-xl shadow-zinc-800/40'
                        : 'bg-zinc-950/80 border-zinc-850 hover:border-zinc-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400">
                        <Bot className="w-4 h-4" />
                      </div>
                      {botConfig.botDifficulty === 'weak' && (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-100 text-[10px] font-black flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>AKTİV</span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-white">Zəif Bot</div>
                    <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Passiv və tez-tez fold edən oyunçular. Qeydiyyatdan keçən yeni oyunçular asanlıqla qalib gəlir.
                    </div>
                  </button>

                  {/* Button 2: ORTA BOT */}
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = { ...botConfig, botDifficulty: 'medium' as const };
                      setBotConfig(updated);
                      await saveBotSystemConfigToFirestore(updated);
                      soundManager.playButtonClick();
                      showToast('Bot rejimi: ORTA BOT olaraq təyin edildi.');
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                      botConfig.botDifficulty === 'medium'
                        ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-400 shadow-xl shadow-blue-500/20'
                        : 'bg-zinc-950/80 border-zinc-850 hover:border-zinc-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                        <Cpu className="w-4 h-4" />
                      </div>
                      {botConfig.botDifficulty === 'medium' && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500 text-zinc-950 text-[10px] font-black flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>AKTİV</span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-white">Orta Bot</div>
                    <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Balanslaşdırılmış standart poker oyunu. Yaxşı əllərlə oynayır, orta risklər götürür.
                    </div>
                  </button>

                  {/* Button 3: PRO BOT (SUPER BOT - DEFAULT) */}
                  <button
                    type="button"
                    onClick={async () => {
                      const updated = { ...botConfig, botDifficulty: 'pro' as const };
                      setBotConfig(updated);
                      await saveBotSystemConfigToFirestore(updated);
                      soundManager.playWinSound();
                      confetti({ particleCount: 30, spread: 40 });
                      showToast('★ PRO BOT: Super Dərəcəli AI Rejimi Aktivdir (Default)!');
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                      botConfig.botDifficulty === 'pro'
                        ? 'bg-gradient-to-br from-amber-950/60 via-purple-950/40 to-zinc-900 border-amber-500 ring-2 ring-amber-400 shadow-xl shadow-amber-500/30'
                        : 'bg-zinc-950/80 border-zinc-850 hover:border-zinc-700 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                        <Award className="w-4 h-4 text-amber-300 animate-pulse" />
                      </div>
                      {botConfig.botDifficulty === 'pro' && (
                        <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 text-[10px] font-black flex items-center space-x-1 shadow">
                          <Sparkles className="w-3 h-3" />
                          <span>SUPER PRO (DEFAULT)</span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-amber-300 flex items-center space-x-1">
                      <span>Pro Bot (Super Usta AI)</span>
                    </div>
                    <div className="text-[11px] text-zinc-350 mt-1 leading-relaxed">
                      Maksimal Game Theory Optimal (GTO), check-raise, blöf tutma, agressiv 3-bet. Qeydiyyatdan keçən oyunçular bu botlara qarşı məğlubiyyətə uğrayır!
                    </div>
                  </button>
                </div>
              </div>

              {/* SECTION 2: HUMAN-LIKE THINKING DELAY (4 - 9 SECONDS) */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Timer className="w-4 h-4 text-purple-400" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      İnsan Kimi Düşünmə Vaxtı (Thinking Time Delay)
                    </h4>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    Tələb: 4 — 9 saniyə
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-850">
                    <label className="block text-xs font-bold text-zinc-300">
                      Minimum Düşünmə Müddəti (Saniyə):
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="2"
                        max="6"
                        step="1"
                        value={botConfig.minThinkSeconds || 4}
                        onChange={(e) => setBotConfig({ ...botConfig, minThinkSeconds: Number(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                      <span className="text-base font-black text-amber-400 font-mono w-12 text-right">
                        {botConfig.minThinkSeconds || 4}s
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">Bot növbəsi gələndə ən tez bu müddətdə qərar verir.</p>
                  </div>

                  <div className="space-y-1.5 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-855">
                    <label className="block text-xs font-bold text-zinc-300">
                      Maksimum Düşünmə Müddəti (Saniyə):
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="6"
                        max="15"
                        step="1"
                        value={botConfig.maxThinkSeconds || 9}
                        onChange={(e) => setBotConfig({ ...botConfig, maxThinkSeconds: Number(e.target.value) })}
                        className="w-full accent-purple-500"
                      />
                      <span className="text-base font-black text-purple-400 font-mono w-12 text-right">
                        {botConfig.maxThinkSeconds || 9}s
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">Mürəkkəb əllərdə və ya all-in vəziyyətlərində düşünmə tavanı.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                  <div className="text-zinc-400">
                    Cari Düşünmə Aralığı: <span className="font-mono text-white font-bold">{botConfig.minThinkSeconds || 4}s — {botConfig.maxThinkSeconds || 9}s</span> (Hər gedişdə canlı insan effekti ilə dinamik hesablanır)
                  </div>
                  <button
                    type="button"
                    onClick={() => setBotConfig({ ...botConfig, minThinkSeconds: 4, maxThinkSeconds: 9 })}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold transition-all"
                  >
                    4-9s Standartına Sıfırla
                  </button>
                </div>
              </div>

              {/* SECTION 3: BOT MASAYA GİRİŞ/ÇIXIŞ DAVRANIŞI */}
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4 shadow-lg">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      Dinamik Masaya Giriş & Çıxış Rejimi
                    </h4>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    Canlı Oyunçu Simulyasiyası
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-850">
                    <div>
                      <div className="text-xs font-bold text-white">Avtomatik Giriş / Çıxış</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Botlar vaxtaşırı masalara oturur və ya masanı tərk edir
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBotConfig({ ...botConfig, autoJoinLeaveEnabled: !botConfig.autoJoinLeaveEnabled })}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        botConfig.autoJoinLeaveEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                          botConfig.autoJoinLeaveEnabled ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-850 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Masadakı Hədəf Bot Sayı:</span>
                      <span className="text-sm font-mono font-black text-amber-400">
                        {botConfig.targetTableOccupancy || 4} Oyunçu
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="6"
                      step="1"
                      value={botConfig.targetTableOccupancy || 4}
                      onChange={(e) => setBotConfig({ ...botConfig, targetTableOccupancy: Number(e.target.value) })}
                      className="w-full accent-amber-500 mt-1"
                    />
                    <div className="text-[10px] text-zinc-500">Masa boşaldıqda botlar avtomatik daxil olub yeri doldurur.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-zinc-400 font-medium">Baza: Google Cloud Firestore (Aktiv & Canlı)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Bağla
          </button>
        </div>
      </motion.div>

      {/* SUB-MODAL: ADJUST BALANCE MODAL */}
      <AnimatePresence>
        {editingPlayer && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-zinc-950 border border-amber-500/50 rounded-2xl p-5 shadow-2xl space-y-4 text-zinc-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-black text-white">Balans Dəyiş: {editingPlayer.username}</h3>
                </div>
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="p-1 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 text-xs flex justify-between">
                <div>
                  <div className="text-zinc-400">Cari Real Balans:</div>
                  <div className="text-base font-black text-amber-400 font-mono">
                    ${(editingPlayer.realBalance || 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-400">Bonus Balans:</div>
                  <div className="text-base font-black text-zinc-300 font-mono">
                    ${(editingPlayer.bonusBalance || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Account Type Selector: Real vs Bonus */}
              <div className="space-y-1">
                <label className="block text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                  Dəyişdiriləcək Hesab Növü:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceType('real')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      balanceType === 'real'
                        ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-300'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    <Wallet className="w-4 h-4" />
                    <span>💵 Real Balans</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceType('bonus')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      balanceType === 'bonus'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/30 ring-2 ring-pink-300'
                        : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                    }`}
                  >
                    <Gift className="w-4 h-4" />
                    <span>🎁 Bonus Balans</span>
                  </button>
                </div>
              </div>

              {/* Add vs Subtract */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceMode('add')}
                  className={`py-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                    balanceMode === 'add'
                      ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Artır (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBalanceMode('subtract')}
                  className={`py-2 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                    balanceMode === 'subtract'
                      ? 'bg-red-500 text-zinc-950 shadow-md shadow-red-500/20'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Azalt (-)</span>
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs text-zinc-300 font-bold">
                    {balanceType === 'real' ? 'Real Məbləğ ($)' : 'Bonus Məbləği ($)'}
                  </label>
                  {balanceDelta && !isNaN(parseFloat(balanceDelta)) && (
                    <span className="text-[11px] font-mono text-zinc-400">
                      Yeni:{' '}
                      <b className={balanceType === 'real' ? 'text-amber-400' : 'text-purple-300'}>
                        $
                        {(
                          balanceType === 'real'
                            ? Math.max(0, (editingPlayer.realBalance || 0) + (parseFloat(balanceDelta) * (balanceMode === 'add' ? 1 : -1)))
                            : Math.max(0, (editingPlayer.bonusBalance || 0) + (parseFloat(balanceDelta) * (balanceMode === 'add' ? 1 : -1)))
                        ).toFixed(2)}
                      </b>
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={balanceDelta}
                  onChange={(e) => setBalanceDelta(e.target.value)}
                  placeholder={balanceType === 'real' ? 'Məs: 50.00' : 'Məs: 10.00'}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-base text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center space-x-1.5 text-xs">
                {(balanceType === 'real' ? [10, 25, 50, 100, 500] : [5, 10, 20, 50, 100]).map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBalanceDelta(String(amt))}
                    className="flex-1 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-750 rounded-lg font-mono font-bold text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    +${amt}
                  </button>
                ))}
              </div>

              {/* Submit & Cancel */}
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="flex-1 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Ləğv Et
                </button>
                <button
                  type="button"
                  onClick={handleSaveBalanceAdjustment}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Təsdiqlə və Yenilə
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUB-MODAL: COMPREHENSIVE RECEIPT INSPECTION & APPROVAL */}
      <AnimatePresence>
        {inspectingDeposit && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl max-h-[92vh] bg-zinc-950 border border-zinc-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-3.5 sm:p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <span>Ödəniş Çeki & Tarix İncələnməsi</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        inspectingDeposit.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : inspectingDeposit.status === 'rejected'
                          ? 'bg-red-950 text-red-300 border border-red-700'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {inspectingDeposit.status === 'completed' ? '✅ Təsdiqlənib' : inspectingDeposit.status === 'rejected' ? '❌ İmtina Edilib' : '⏳ Təsdiq Gözləyir'}
                      </span>
                    </h3>
                    <div className="text-[11px] text-zinc-400">
                      Oyunçu: <b className="text-zinc-200">{inspectingDeposit.username || 'Oyunçu'}</b> • Məbləğ:{' '}
                      <b className="text-emerald-400 font-mono font-black">+${inspectingDeposit.amount.toFixed(2)} USD</b>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Zoom & Rotation Controls */}
                  <div className="flex items-center space-x-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setReceiptZoom(prev => Math.max(0.5, prev - 0.25))}
                      className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-mono text-zinc-400 px-1 select-none">
                      {Math.round(receiptZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setReceiptZoom(prev => Math.min(3, prev + 0.25))}
                      className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiptRotation(prev => (prev + 90) % 360)}
                      className="p-1 text-zinc-400 hover:text-amber-400 rounded hover:bg-zinc-800 cursor-pointer"
                      title="Fırlat (90°)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReceiptZoom(1); setReceiptRotation(0); }}
                      className="px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer font-mono"
                      title="Sıfırla"
                    >
                      100%
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setInspectingDeposit(null); setReceiptZoom(1); setReceiptRotation(0); }}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Body: Image Viewer & Metadata Side Panel */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                {/* Left: High Resolution Image Viewer */}
                <div className="flex-1 bg-zinc-950/80 p-4 flex items-center justify-center overflow-auto border-b md:border-b-0 md:border-r border-zinc-800 relative">
                  {inspectingDeposit.receiptPreviewUrl ? (
                    <div className="max-w-full max-h-full flex items-center justify-center transition-transform duration-200" style={{ transform: `scale(${receiptZoom}) rotate(${receiptRotation}deg)` }}>
                      <img
                        src={inspectingDeposit.receiptPreviewUrl}
                        alt="HD Receipt Preview"
                        className="max-h-[55vh] md:max-h-[65vh] w-auto object-contain rounded-xl shadow-2xl border border-zinc-800"
                      />
                    </div>
                  ) : (
                    <div className="text-zinc-500 text-xs text-center p-8">
                      Şəkil mövcud deyil
                    </div>
                  )}
                </div>

                {/* Right: Detailed Metadata & Action Station */}
                <div className="w-full md:w-80 p-4 bg-zinc-900/90 space-y-4 overflow-y-auto shrink-0">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Çek Audit Məlumatları</span>
                    </h4>

                    <div className="space-y-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[10.5px]">Məbləğ:</span>
                        <span className="text-emerald-400 font-mono font-black text-base">
                          +${inspectingDeposit.amount.toFixed(2)} {inspectingDeposit.currency || 'USD'}
                        </span>
                      </div>

                      <div>
                        <span className="text-zinc-500 block text-[10.5px]">Oyunçu:</span>
                        <span className="text-zinc-200 font-bold">{inspectingDeposit.username || 'Oyunçu'}</span>
                        {inspectingDeposit.userEmail && (
                          <span className="text-zinc-400 text-[11px] block">{inspectingDeposit.userEmail}</span>
                        )}
                        {inspectingDeposit.userId && (
                          <span className="text-zinc-600 font-mono text-[9.5px] block truncate">ID: {inspectingDeposit.userId}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-zinc-500 block text-[10.5px]">Fayl Adı:</span>
                        <span className="text-zinc-300 font-mono text-[11px] truncate block">
                          {inspectingDeposit.receiptName}
                        </span>
                      </div>

                      {inspectingDeposit.receiptTimestamp && (
                        <div>
                          <span className="text-zinc-500 block text-[10.5px]">Çekin Dəqiq Tarixi və Saatı:</span>
                          <span className="text-amber-300 font-mono font-bold text-[11.5px] flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>{new Date(inspectingDeposit.receiptTimestamp).toLocaleString('az-AZ')}</span>
                          </span>
                        </div>
                      )}

                      <div>
                        <span className="text-zinc-500 block text-[10.5px]">Sistemə Göndərilmə Zamanı:</span>
                        <span className="text-zinc-300 font-mono text-[11px]">
                          {new Date(inspectingDeposit.createdAt).toLocaleString('az-AZ')}
                        </span>
                      </div>

                      {inspectingDeposit.reviewedAt && (
                        <div>
                          <span className="text-zinc-500 block text-[10.5px]">İncələnmə / Təsdiq Tarixi:</span>
                          <span className="text-emerald-400 font-mono text-[11px]">
                            {new Date(inspectingDeposit.reviewedAt).toLocaleString('az-AZ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions if still pending */}
                  {(inspectingDeposit.status === 'pending' || inspectingDeposit.status === 'processing') ? (
                    <div className="space-y-2 pt-2 border-t border-zinc-800">
                      <button
                        type="button"
                        onClick={() => handleApproveDeposit(inspectingDeposit.id)}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>✅ Çeki Təsdiq Et (+ Balansa Yaz)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRejectDeposit(inspectingDeposit.id)}
                        className="w-full py-2.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer active:scale-95"
                      >
                        <X className="w-4 h-4" />
                        <span>❌ İmtina Et (Rədd Et)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center text-xs">
                      <span className={inspectingDeposit.status === 'completed' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {inspectingDeposit.status === 'completed' ? '✅ Bu depozit artıq təsdiqlənib və balansa köçürülüb.' : '❌ Bu depozit imtina edilib.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUB-MODAL: QUICK RECEIPT FULL SCREENSHOT PREVIEW */}
      <AnimatePresence>
        {previewReceiptUrl && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="relative max-w-xl max-h-[85vh] bg-zinc-950 p-2 rounded-2xl border border-zinc-700 shadow-2xl flex flex-col items-center">
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="absolute -top-3 -right-3 p-1.5 rounded-full bg-red-600 text-white shadow-lg cursor-pointer hover:bg-red-500"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={previewReceiptUrl}
                alt="Bank Çeki Tam Şəkil"
                className="max-h-[78vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
