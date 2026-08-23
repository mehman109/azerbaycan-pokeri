import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, CurrencyType } from '../types/poker';
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
  fetchAllWithdrawalsFromFirestore,
  updateWithdrawalStatusInFirestore,
  saveSystemConfigToFirestore,
  fetchSystemConfigFromFirestore,
  subscribeToRealtimeAdminData,
  ADMIN_EMAIL 
} from '../services/firebase';
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
  Gift
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: UserProfile;
  onRefreshUserData?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  onRefreshUserData,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'deposits' | 'withdrawals' | 'settings' | 'tables'>('users');
  
  // Players state
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  // Selected player for balance adjustment modal
  const [editingPlayer, setEditingPlayer] = useState<UserProfile | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<string>('');
  const [balanceMode, setBalanceMode] = useState<'add' | 'subtract'>('add');
  const [balanceType, setBalanceType] = useState<'real' | 'bonus'>('real');

  // Deposits & Withdrawals
  const [pendingDeposits, setPendingDeposits] = useState<AdminPendingDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRequest[]>([]);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // System Bank Settings
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(adminStorage.getConfig);
  const [configSavedToast, setConfigSavedToast] = useState(false);

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
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter players
  const filteredPlayers = players.filter(p => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      p.username.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  // Action: Save Balance Change
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

    if (balanceType === 'real') {
      newReal = Math.max(0, Number((newReal + finalChange).toFixed(2)));
    } else {
      newBonus = Math.max(0, Number((newBonus + finalChange).toFixed(2)));
    }

    const updatedProfile: UserProfile = {
      ...editingPlayer,
      realBalance: newReal,
      bonusBalance: newBonus,
    };

    // Update in Firestore
    await adminUpdateUserInFirestore(editingPlayer.id, {
      realBalance: newReal,
      bonusBalance: newBonus,
    });

    // Update in local admin store
    adminStorage.updatePlayerBalance(editingPlayer.id, newReal, newBonus);

    // If editing current admin, sync in App
    if (editingPlayer.id === currentUser.id) {
      updateUserBalanceInFirebase(currentUser.id, newReal, currentUser.playMoneyBalance, newBonus);
      if (onRefreshUserData) onRefreshUserData();
    }

    // Update state
    setPlayers(prev => prev.map(p => p.id === editingPlayer.id ? updatedProfile : p));
    setEditingPlayer(null);
    setBalanceDelta('');
    soundManager.playChipSound();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    showToast(
      `✅ ${editingPlayer.username} oyunçusunun ${balanceType === 'real' ? 'Real' : 'Bonus'} balansı uğurla yeniləndi! ($${(balanceType === 'real' ? newReal : newBonus).toFixed(2)})`
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
    if (dep && dep.userId) {
      const player = players.find(p => p.id === dep.userId);
      if (player) {
        const updatedReal = (player.realBalance || 0) + dep.amount;
        await adminUpdateUserInFirestore(player.id, { realBalance: updatedReal });
      }
    }
    setPendingDeposits(adminStorage.getPendingDeposits());
    soundManager.playWinSound();
    confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
    showToast(`🎉 Depozit təsdiqləndi! Məbləğ oyunçunun balansına əlavə edildi.`);
    loadAllData();
  };

  // Action: Reject Deposit
  const handleRejectDeposit = async (depositId: string) => {
    adminStorage.rejectDeposit(depositId);
    await updateDepositStatusInFirestore(depositId, 'rejected');
    setPendingDeposits(adminStorage.getPendingDeposits());
    soundManager.playButtonClick();
    showToast(`❌ Depozit tələbi imtina edildi.`);
  };

  // Action: Approve Withdrawal
  const handleApproveWithdrawal = async (withdrawalId: string) => {
    adminStorage.updateWithdrawalStatus(withdrawalId, 'approved');
    await updateWithdrawalStatusInFirestore(withdrawalId, 'approved');
    setWithdrawals(adminStorage.getWithdrawals());
    soundManager.playWinSound();
    showToast(`✅ Çıxarış təsdiqləndi və ödənildi olaraq qeyd edildi.`);
  };

  // Action: Reject Withdrawal
  const handleRejectWithdrawal = async (withdrawalId: string) => {
    adminStorage.updateWithdrawalStatus(withdrawalId, 'rejected');
    await updateWithdrawalStatusInFirestore(withdrawalId, 'rejected');
    setWithdrawals(adminStorage.getWithdrawals());
    soundManager.playButtonClick();
    showToast(`❌ Çıxarış tələbi ləğv edildi.`);
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
                Oyunçular, depozit çekləri, balanslar və kassa ayarlarının canlı idarəsi
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-zinc-900/90 border-b border-zinc-800 text-xs">
          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-[11px]">Cəmi Oyunçular</div>
              <div className="text-sm sm:text-base font-black text-white">{totalUsersCount} nəfər</div>
            </div>
            <Users className="w-5 h-5 text-blue-400" />
          </div>

          <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between">
            <div>
              <div className="text-zinc-400 text-[11px]">Ümumi Balanslar</div>
              <div className="text-sm sm:text-base font-black text-amber-400">${totalRealBalance.toFixed(2)}</div>
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
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Oyunçular ({players.length})</span>
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
          
          {/* TAB 1: USERS LIST & MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ad, e-poçt və ya ID ilə axtarın..."
                    className="w-full bg-zinc-900 border border-zinc-750 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="text-xs text-zinc-400 flex items-center space-x-2">
                  <span>Göstərilir: <b className="text-amber-300">{filteredPlayers.length}</b> oyunçu</span>
                </div>
              </div>

              {/* Players Table */}
              <div className="border border-zinc-800 rounded-2xl bg-zinc-900/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold text-[10.5px]">
                      <tr>
                        <th className="px-4 py-3">Oyunçu</th>
                        <th className="px-4 py-3">E-poçt</th>
                        <th className="px-4 py-3">Real Balans</th>
                        <th className="px-4 py-3">Bonus</th>
                        <th className="px-4 py-3">VIP</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Əməliyyatlar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filteredPlayers.map((player) => {
                        const isAdmin = player.isAdmin || player.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
                        return (
                          <tr key={player.id} className="hover:bg-zinc-850/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2.5">
                                <img
                                  src={player.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                                  alt={player.username}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full border border-amber-400/40 object-cover"
                                />
                                <div>
                                  <div className="font-bold text-white flex items-center space-x-1">
                                    <span>{player.username}</span>
                                    {isAdmin && <span className="text-amber-400">👑</span>}
                                  </div>
                                  <div className="text-[10px] text-zinc-500 font-mono">ID: {player.id.slice(0, 10)}...</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-zinc-300 font-mono text-[11px]">
                              {player.email || '—'}
                            </td>
                            <td className="px-4 py-3 font-mono font-black text-amber-400 text-sm">
                              ${(player.realBalance || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-mono text-zinc-300">
                              ${(player.bonusBalance || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold">
                                VIP {player.vipLevel || 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {player.isBanned ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-950 text-red-300 border border-red-800 text-[10px] font-black">
                                  🚫 Dondurulub
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                  🟢 Aktiv
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
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
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEPOSIT RECEIPTS & APPROVAL */}
          {activeTab === 'deposits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200">
                  Oyunçuların Yüklədiyi Bank Çekləri & Depozitləri
                </h3>
                <span className="text-xs text-zinc-400">
                  Cəmi: <b>{pendingDeposits.length}</b> qeyd
                </span>
              </div>

              {pendingDeposits.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                  <ArrowDownRight className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">Hazırda heç bir depozit çeki yoxdur.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingDeposits.map((dep) => (
                    <div
                      key={dep.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        dep.status === 'completed'
                          ? 'bg-zinc-900/40 border-zinc-800 opacity-70'
                          : dep.status === 'rejected'
                          ? 'bg-red-950/20 border-red-900/40 opacity-70'
                          : 'bg-zinc-900 border-amber-500/50 shadow-lg shadow-amber-950/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-black text-white font-mono">
                              +${dep.amount.toFixed(2)} {dep.currency || 'USD'}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              dep.status === 'completed'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : dep.status === 'rejected'
                                ? 'bg-red-950 text-red-300 border border-red-700'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                            }`}>
                              {dep.status === 'completed' ? 'Təsdiqləndi' : dep.status === 'rejected' ? 'İmtina Edildi' : 'Gözləyir'}
                            </span>
                          </div>
                          <div className="text-xs text-zinc-400 mt-1">
                            Oyunçu: <b className="text-zinc-200">{dep.username || 'Qonaq / Oyunçu'}</b>
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(dep.createdAt).toLocaleString('az-AZ')}</span>
                          </div>
                        </div>

                        {/* Receipt Thumbnail */}
                        {dep.receiptPreviewUrl && (
                          <button
                            onClick={() => setPreviewReceiptUrl(dep.receiptPreviewUrl || null)}
                            className="relative group w-14 h-14 rounded-xl border border-zinc-700 overflow-hidden bg-zinc-950 cursor-pointer"
                          >
                            <img
                              src={dep.receiptPreviewUrl}
                              alt="Receipt"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Eye className="w-4 h-4" />
                            </div>
                          </button>
                        )}
                      </div>

                      {/* Action buttons if processing */}
                      {dep.status === 'processing' && (
                        <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-zinc-800">
                          <button
                            onClick={() => handleApproveDeposit(dep.id)}
                            className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Təsdiqlə (+ Balansa Yaz)</span>
                          </button>
                          <button
                            onClick={() => handleRejectDeposit(dep.id)}
                            className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            İmtina
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WITHDRAWAL REQUESTS */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200">
                  Oyunçuların Pul Çıxarış Tələbləri (Ödənişlər)
                </h3>
                <span className="text-xs text-zinc-400">
                  Cəmi: <b>{withdrawals.length}</b> müraciət
                </span>
              </div>

              {withdrawals.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-2xl">
                  <ArrowUpRight className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">Hazırda heç bir çıxarış tələbi yoxdur.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-base font-black text-amber-400 font-mono">
                            ${w.amount.toFixed(2)} {w.currency || 'USD'}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            w.status === 'approved'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : w.status === 'rejected'
                              ? 'bg-red-950 text-red-300 border border-red-700'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {w.status === 'approved' ? 'Ödənildi' : w.status === 'rejected' ? 'İmtina Edildi' : 'Gözləyir'}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-300 mt-1">
                          Oyunçu: <b>{w.username}</b> • Bank: <span className="text-zinc-400">{w.bankName || 'Kapital / ABB'}</span>
                        </div>
                        <div className="text-xs text-amber-300 font-mono mt-0.5">
                          Kart Nömrəsi: <b>{w.cardNumber}</b>
                        </div>
                      </div>

                      {w.status === 'pending' && (
                        <div className="flex items-center space-x-2 self-end sm:self-center">
                          <button
                            onClick={() => handleApproveWithdrawal(w.id)}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Ödəndi / Təsdiqlə</span>
                          </button>
                          <button
                            onClick={() => handleRejectWithdrawal(w.id)}
                            className="px-3 py-1.5 bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                          >
                            İmtina
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SYSTEM BANK CARD & CASHIER SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSystemConfig} className="space-y-4 max-w-2xl bg-zinc-900/70 p-5 rounded-2xl border border-zinc-800">
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

      {/* SUB-MODAL: RECEIPT FULL SCREENSHOT PREVIEW */}
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
