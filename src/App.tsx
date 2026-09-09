import React, { useState, useEffect } from 'react';
import { 
  UserProfile, 
  PokerTableState, 
  GameType, 
  TableCapacity, 
  FeltColor, 
  StakesTier, 
  Player, 
  Card 
} from './types/poker';
import { Language, translations } from './utils/translations';
import { HeaderNav } from './components/HeaderNav';
import { LobbyView } from './components/LobbyView';
import { PokerTable } from './components/PokerTable';
import { AuthModal } from './components/AuthModal';
import { CashierModal } from './components/CashierModal';
import { CreateTableModal } from './components/CreateTableModal';
import { HandRankingsModal } from './components/HandRankingsModal';
import { TableSettingsModal } from './components/TableSettingsModal';
import { SupportModal } from './components/SupportModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { UserSettingsModal } from './components/UserSettingsModal';
import { adminStorage } from './utils/adminStore';
import { generateInitialTables, createPopulatedTable, createBotPlayer } from './utils/mockData';
import { createDeck } from './utils/pokerEngine';
import { soundManager } from './utils/audioEngine';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Bell, X, ExternalLink, MessageSquare, Crown } from 'lucide-react';
import { 
  auth, 
  syncUserProfile, 
  updateUserBalanceInFirebase, 
  getSavedLocalUser, 
  clearLocalUser, 
  isAdminEmail,
  subscribeToRealtimeAdminData,
  subscribeToUserProfile,
  subscribeToPlayerSupportMessages,
  subscribeToAllLiveTables,
  saveTableToFirestore,
  deleteTableFromFirestore,
  updateTableBlindsInFirestore,
  kickPlayerFromTableInFirestore,
  leaveTableSeatInFirestore,
  SupportMessage
} from './services/firebase';
import { 
  emitKickPlayerSocket, 
  emitPlayerLeaveSocket,
  emitCloseTableSocket, 
  emitUpdateTableLimitsSocket 
} from './services/socket';
import { GOLDEN_ACE_AVATAR } from './types/poker';
import { onAuthStateChanged, signOut } from 'firebase/auth';

export default function App() {
  // Localization: Azerbaijani default
  const [lang, setLang] = useState<Language>('az');
  const t = translations[lang];

  // User Profile state with Firebase Auth persistence and Instant local restore
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = getSavedLocalUser();
    if (saved) {
      const isAdmin = isAdminEmail(saved.email) || saved.username === 'ADMIN' || saved.isAdmin;
      if (isAdmin) {
        return {
          ...saved,
          username: 'ADMIN',
          avatar: GOLDEN_ACE_AVATAR,
          isAdmin: true,
          realBalance: (saved.realBalance && saved.realBalance > 0) ? saved.realBalance : 7500.00,
          bonusBalance: 0.00,
          activeCurrencyMode: 'real',
          vipLevel: 10,
          vipXp: 10000,
        };
      }
      return saved;
    }
    return null;
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await syncUserProfile(firebaseUser);
          setUser(profile);
        } catch (err) {
          console.error('Error syncing profile on auth change:', err);
        }
      } else {
        // If not logged in via Firebase Auth, check local saved session
        const saved = getSavedLocalUser();
        if (saved) {
          const isAdmin = isAdminEmail(saved.email) || saved.username === 'ADMIN' || saved.isAdmin;
          if (isAdmin) {
            const adminProf: UserProfile = {
              ...saved,
              username: 'ADMIN',
              avatar: GOLDEN_ACE_AVATAR,
              isAdmin: true,
              realBalance: (saved.realBalance && saved.realBalance > 0) ? saved.realBalance : 7500.00,
              bonusBalance: 0.00,
              activeCurrencyMode: 'real',
              vipLevel: 10,
              vipXp: 10000,
            };
            setUser(adminProf);
          } else {
            setUser(saved);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Table & Lobby States
  const [tables, setTables] = useState<PokerTableState[]>(generateInitialTables);
  const [activeTable, setActiveTable] = useState<PokerTableState | null>(null);
  const [currentView, setCurrentView] = useState<'lobby' | 'table'>('lobby');

  // Real-time synchronization of all tables across all players in the system
  useEffect(() => {
    const initial = generateInitialTables();
    const unsubscribe = subscribeToAllLiveTables((remoteTables) => {
      if (remoteTables && remoteTables.length > 0) {
        setTables(remoteTables);
        setActiveTable((prevActive) => {
          if (!prevActive) return null;
          const matched = remoteTables.find((t) => t.id === prevActive.id);
          return matched ? { ...matched, feltColor: prevActive.feltColor || matched.feltColor } : prevActive;
        });
      }
    }, initial);

    return () => unsubscribe();
  }, []);

  // Direct Room / Table ID Deep-Linking & Refresh Session Restore (?table=ID or localStorage)
  useEffect(() => {
    if (tables.length === 0 || !user) return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const targetTableId = urlParams.get('table') || urlParams.get('room') || localStorage.getItem('poker_active_table_id');
      if (targetTableId && !activeTable) {
        const found = tables.find((t) => t.id === targetTableId);
        if (found) {
          handleJoinTable(found, true);
        }
      }
    } catch {}
  }, [tables, activeTable, user]);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'admin'>('signin');
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [isHandRankingsOpen, setIsHandRankingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Table Visual & Audio Settings
  const [feltColor, setFeltColor] = useState<FeltColor>('emerald');
  const [isFourColor, setIsFourColor] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.6);
  const [autoMuck, setAutoMuck] = useState<boolean>(true);
  const [autoRebuy, setAutoRebuy] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('poker_auto_rebuy');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleAutoRebuy = (val: boolean) => {
    setAutoRebuy(val);
    try {
      localStorage.setItem('poker_auto_rebuy', String(val));
    } catch {
      // ignore
    }
  };
  const [globalDepositToast, setGlobalDepositToast] = useState<string | null>(null);
  const [playerAdminMessageToast, setPlayerAdminMessageToast] = useState<SupportMessage | null>(null);
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0);
  const [adminLiveAlert, setAdminLiveAlert] = useState<{
    id: string;
    type: 'user' | 'deposit' | 'withdrawal' | 'message';
    title: string;
    subtitle: string;
  } | null>(null);

  // Real-time alerts for Super Admin
  useEffect(() => {
    const isAdmin = user?.isAdmin || (user?.email && isAdminEmail(user.email));
    if (!isAdmin) return;

    const initialLoadTime = Date.now() - 5000;
    const knownIds = new Set<string>();

    const unsubscribe = subscribeToRealtimeAdminData({
      onUsersChange: (users) => {
        users.forEach((u) => {
          if (!knownIds.has(u.id)) {
            knownIds.add(u.id);
            const userCreatedAt = u.createdAt ? new Date(u.createdAt).getTime() : 0;
            if (userCreatedAt > initialLoadTime && !u.isAdmin) {
              soundManager.playWinSound();
              setAdminLiveAlert({
                id: `usr_${Date.now()}`,
                type: 'user',
                title: '👤 YENİ OYUNÇU QEYDİYYATI!',
                subtitle: `${u.username} (${u.email || 'Email yoxdur'}) platformada qeydiyyatdan keçdi.`
              });
            }
          }
        });
      },
      onDepositsChange: (deposits) => {
        deposits.forEach((d) => {
          if (!knownIds.has(d.id)) {
            knownIds.add(d.id);
            if ((d.createdAt || 0) > initialLoadTime && (d.status === 'pending' || d.status === 'processing' || d.status === 'completed')) {
              soundManager.playChipSound();
              setAdminLiveAlert({
                id: `dep_${Date.now()}`,
                type: 'deposit',
                title: '💳 YENİ DEPOZİT ÇEKİ GƏLDİ!',
                subtitle: `${d.username || 'Oyunçu'} +$${(d.amount || 0).toFixed(2)} depozit çeki təqdim etdi. İncələmək üçün toxunun!`
              });
            }
          }
        });
      },
      onWithdrawalsChange: (withdrawals) => {
        withdrawals.forEach((w) => {
          if (!knownIds.has(w.id)) {
            knownIds.add(w.id);
            if ((w.createdAt || 0) > initialLoadTime && w.status === 'pending') {
              soundManager.playWinSound();
              setAdminLiveAlert({
                id: `wth_${Date.now()}`,
                type: 'withdrawal',
                title: '💸 YENİ ÇIXARIŞ TƏLƏBİ!',
                subtitle: `${w.username || 'Oyunçu'} $${(w.amount || 0).toFixed(2)} çıxarış tələb etdi (${w.cardNumber}).`
              });
            }
          }
        });
      },
      onMessagesChange: (messages) => {
        messages.forEach((m) => {
          if (!knownIds.has(m.id)) {
            knownIds.add(m.id);
            if ((m.createdAt || 0) > initialLoadTime && m.sender === 'user' && !m.readByAdmin) {
              soundManager.playChipSound();
              setAdminLiveAlert({
                id: `msg_${Date.now()}`,
                type: 'message',
                title: '💬 OYUNÇUDAN YENİ MESAJ!',
                subtitle: `${m.username || 'Oyunçu'}: "${m.text.slice(0, 60)}${m.text.length > 60 ? '...' : ''}"`
              });
            }
          }
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.isAdmin, user?.email]);

  // Real-time listener for incoming messages from Admin to the current logged in player
  useEffect(() => {
    if (!user?.id || user?.isAdmin) return;

    const initialMsgTime = Date.now() - 3000;
    const seenMsgIds = new Set<string>();

    const unsubscribe = subscribeToPlayerSupportMessages(user.id, (messages) => {
      const unread = messages.filter(m => m.sender === 'admin' && !m.readByUser).length;
      setUnreadSupportCount(unread);

      messages.forEach((m) => {
        if (!seenMsgIds.has(m.id)) {
          seenMsgIds.add(m.id);
          if (m.sender === 'admin' && (m.createdAt || 0) > initialMsgTime && !m.readByUser) {
            soundManager.playChipSound();
            setPlayerAdminMessageToast(m);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user?.id, user?.isAdmin]);

  // Real-time synchronization of player's balance from Firestore
  useEffect(() => {
    if (!user?.id || user?.isAdmin) return;

    const currentId = user.id;
    const initialMountTime = Date.now();

    const unsubscribe = subscribeToUserProfile(currentId, (liveUser) => {
      if (liveUser && liveUser.realBalance !== undefined) {
        // Only trigger deposit celebration if an actual admin approval timestamp was recorded after mount
        if (
          liveUser.lastDepositApprovedAt && 
          liveUser.lastDepositApprovedAt > initialMountTime && 
          liveUser.lastDepositApprovedAmount
        ) {
          const credited = liveUser.lastDepositApprovedAmount.toFixed(2);
          soundManager.playWinSound();
          confetti({ particleCount: 100, spread: 85, origin: { y: 0.4 } });
          setGlobalDepositToast(
            lang === 'az'
              ? `🎉 Təbriklər! Admin depozit çekinizi təsdiqlədi və +$${credited} Real Balansınıza köçürüldü!`
              : `🎉 Congratulations! Admin approved your deposit and +$${credited} was credited to your Real Balance!`
          );
          setTimeout(() => setGlobalDepositToast(null), 8000);
        }

        setUser((prev) => {
          if (!prev || prev.id !== currentId) return prev;
          return {
            ...prev,
            realBalance: liveUser.realBalance,
            bonusBalance: liveUser.bonusBalance !== undefined ? liveUser.bonusBalance : prev.bonusBalance,
            isBanned: liveUser.isBanned !== undefined ? liveUser.isBanned : prev.isBanned,
            lastDepositApprovedAt: liveUser.lastDepositApprovedAt ?? prev.lastDepositApprovedAt,
          };
        });
      }
    });

    return () => unsubscribe();
  }, [user?.id, user?.isAdmin, lang]);

  // Switch between Real Money and Play Money modes
  const handleToggleCurrencyMode = () => {
    if (!user) return;
    setUser({
      ...user,
      activeCurrencyMode: user.activeCurrencyMode === 'real' ? 'play' : 'real',
    });
  };

  // Update Balances (Real, Play, Bonus) & Special Promotion status
  const handleUpdateBalance = (
    real: number, 
    play: number, 
    bonus?: number, 
    claimedSpecialBonus?: boolean,
    questStartTime?: number,
    turnoverCompleted?: boolean
  ) => {
    if (!user) return;
    let newReal = Number(real.toFixed(2));
    let newBonus = bonus !== undefined ? Number(bonus.toFixed(2)) : (user.bonusBalance ?? 0);
    let isTurnoverDone = turnoverCompleted !== undefined ? turnoverCompleted : user.bonusTurnoverCompleted;

    // Strict System Constraint: Bonus can grow from $5 up to $80 maximum, but system strictly caps and prevents reaching $100.00
    if (newBonus > 80) {
      newBonus = 80.00;
    }

    const updatedUser = {
      ...user,
      realBalance: newReal,
      playMoneyBalance: play,
      bonusBalance: newBonus,
      hasClaimedSpecialBonus: claimedSpecialBonus !== undefined ? claimedSpecialBonus : user.hasClaimedSpecialBonus,
      bonusQuestStartTime: questStartTime !== undefined ? questStartTime : (user.bonusQuestStartTime || Date.now()),
      bonusTurnoverCompleted: isTurnoverDone,
    };

    setUser(updatedUser);
    updateUserBalanceInFirebase(user.id, newReal, play, newBonus);
  };

  // Join Table handler (Enters table view for spectator/seat selection)
  const handleJoinTable = (targetTable: PokerTableState, observeOnly = true) => {
    if (!user) {
      setAuthMode('signup');
      setIsAuthOpen(true);
      return;
    }
    soundManager.playCardDeal();

    // Clone table
    const clonedTable: PokerTableState = {
      ...targetTable,
      feltColor,
    };

    if (clonedTable.isCustomCreated && user && !observeOnly) {
      // Human enters custom table alone
      const players = new Array(clonedTable.capacity).fill(null);
      const initialChips = clonedTable.bigBlind * 100;
      players[0] = {
        id: user.id,
        name: user.username,
        avatar: user.avatar,
        chips: initialChips,
        initialChips,
        currentBet: 0,
        totalRoundBet: 0,
        cards: [],
        isFolded: false,
        isAllIn: false,
        isSittingOut: false,
        isDisconnected: false,
        isHuman: true,
        seatIndex: 0,
        vipLevel: user.vipLevel,
        joinedAt: Date.now(),
      };
      clonedTable.players = players;
      clonedTable.stage = 'waiting';
      clonedTable.communityCards = [];
      clonedTable.pot = 0;
      clonedTable.sidePots = [];
      clonedTable.dealerSeatIndex = 0;
      clonedTable.smallBlindSeatIndex = 0;
      clonedTable.bigBlindSeatIndex = 0;
      clonedTable.currentTurnSeatIndex = 0;
      clonedTable.currentHighBet = 0;
      clonedTable.minRaise = clonedTable.bigBlind;
      clonedTable.handWinners = [];
    }

    setActiveTable(clonedTable);
    setCurrentView('table');
    try {
      localStorage.setItem('poker_active_table_id', clonedTable.id);
      window.history.replaceState(null, '', `?table=${clonedTable.id}`);
    } catch {}
  };

  // Leave Table handler
  const handleLeaveTable = () => {
    try {
      localStorage.removeItem('poker_active_table_id');
    } catch {}
    if (activeTable && user) {
      const tableId = activeTable.id;
      const userId = user.id;

      // 1. Broadcast instant WebSocket player leave event to immediately free seat across all connected clients
      emitPlayerLeaveSocket(tableId, userId);

      // 2. Explicitly set seat index to null in Firestore database document for that table
      leaveTableSeatInFirestore(tableId, -1, userId, activeTable).catch((err) => {
        console.warn('Error syncing leave table seat to Firestore:', err);
      });

      // 3. Immediately update local tables state so UI reflects empty seat with zero latency
      setTables((prev) =>
        prev.map((t) => {
          if (t.id === tableId) {
            const players = (t.players || []).map((p) => (p && p.id === userId ? null : p));
            const remainingCount = players.filter((p) => p !== null).length;
            return {
              ...t,
              players,
              stage: (remainingCount < 2 ? 'waiting' : t.stage) as any,
              pot: remainingCount < 2 ? 0 : t.pot,
              communityCards: remainingCount < 2 ? [] : t.communityCards,
              handWinners: remainingCount < 2 ? [] : t.handWinners,
              updatedAt: Date.now(),
            };
          }
          return t;
        })
      );
    }
    setActiveTable(null);
    setCurrentView('lobby');
    try {
      window.history.replaceState(null, '', window.location.pathname);
    } catch {}
  };

  // Logout handler: Clears user and returns to Login / Registration modal
  const handleLogout = async () => {
    soundManager.playButtonClick();
    if (activeTable) {
      handleLeaveTable();
    }
    clearLocalUser();
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
    setUser(null);
    setAuthMode('signin');
    setIsAuthOpen(true);
  };

  // Create Private / Custom Table Handler (Real-Time Synchronized to all players)
  const handleCreateCustomTable = async (data: {
    name: string;
    gameType: GameType;
    capacity: TableCapacity;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    timeBank: number;
    passcode?: string;
    feltColor: FeltColor;
    stakesTier: StakesTier;
  }) => {
    const newTbl = createPopulatedTable({
      id: `tbl_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: data.name,
      gameType: data.gameType,
      limitType: 'no_limit',
      stakesTier: data.stakesTier,
      smallBlind: data.smallBlind,
      bigBlind: data.bigBlind,
      capacity: data.capacity,
      feltColor: data.feltColor,
      passcode: data.passcode,
      avgPot: data.bigBlind * 30,
      handsPerHour: 80,
      isCustomCreated: true,
      createdById: user?.id,
    });

    setTables((prev) => [newTbl, ...prev.filter((t) => t.id !== newTbl.id)]);
    // Save to Firestore so every online user sees this new table appear immediately!
    await saveTableToFirestore(newTbl);
    handleJoinTable(newTbl, false);
  };

  return (
    <div className="min-h-screen w-full max-w-full bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950 overflow-x-hidden">
      {/* Global Navigation Header */}
      <HeaderNav
        user={user}
        lang={lang}
        onOpenCashier={() => setIsCashierOpen(true)}
        onOpenCreateTable={() => setIsCreateTableOpen(true)}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        onOpenSettings={() => setIsUserSettingsOpen(true)}
        onOpenSupport={() => setIsSupportOpen(true)}
        unreadSupportCount={unreadSupportCount}
        onOpenAuth={(mode) => {
          setAuthMode(mode);
          setIsAuthOpen(true);
        }}
        onLogout={handleLogout}
        onToggleCurrencyMode={handleToggleCurrencyMode}
      />

      {/* Main View: Lobby or Live Table */}
      <main className="flex-1 flex flex-col w-full max-w-full overflow-x-hidden">
        {currentView === 'lobby' || !activeTable ? (
          <LobbyView
            user={user}
            lang={lang}
            onJoinTable={handleJoinTable}
            onOpenCreateTable={() => setIsCreateTableOpen(true)}
            onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
            onOpenAuth={() => {
              setAuthMode('signin');
              setIsAuthOpen(true);
            }}
            onLogout={handleLogout}
            tables={tables}
          />
        ) : (
          <PokerTable
            initialTable={activeTable}
            currentUser={
              user || {
                id: 'guest_demo',
                username: 'Guest_Demo',
                email: 'guest@demo.com',
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
                currency: 'USD',
                realBalance: 1000,
                playMoneyBalance: 20000,
                activeCurrencyMode: 'real',
                vipLevel: 1,
                vipXp: 100,
                is2FAEnabled: false,
                totalHandsPlayed: 0,
                handsWon: 0,
                biggestPotWon: 0,
                createdAt: new Date().toISOString(),
              }
            }
            lang={lang}
            onLeaveTable={handleLeaveTable}
            onLogout={handleLogout}
            onUpdateUserBalance={handleUpdateBalance}
            onOpenHandRankings={() => setIsHandRankingsOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenSupport={() => setIsSupportOpen(true)}
            isFourColor={isFourColor}
            feltColor={feltColor}
            autoMuck={autoMuck}
            autoRebuy={autoRebuy}
          />
        )}
      </main>

      {/* Player Incoming Admin Message Notification Banner */}
      <AnimatePresence>
        {playerAdminMessageToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.92 }}
            className="fixed top-4 sm:top-5 right-3 sm:right-6 z-[130] max-w-sm w-[calc(100%-24px)]"
          >
            <div className="p-3.5 bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950/80 border-2 border-amber-400 rounded-2xl shadow-2xl shadow-amber-500/25 text-white flex items-start space-x-3 backdrop-blur-xl">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-amber-300 shrink-0">
                <Crown className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center space-x-1">
                  <span>👑 ADMİNDƏN YENİ MESAJ</span>
                </div>
                <div className="text-xs text-zinc-200 mt-1 line-clamp-2 leading-relaxed font-medium">
                  "{playerAdminMessageToast.text}"
                </div>
                <div className="mt-2.5 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setIsSupportOpen(true);
                      setPlayerAdminMessageToast(null);
                    }}
                    className="px-3 py-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-black text-[11px] rounded-lg transition-all flex items-center space-x-1 cursor-pointer shadow-md"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Mesajı Aç & Cavabla</span>
                  </button>
                  <button
                    onClick={() => setPlayerAdminMessageToast(null)}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Bağla
                  </button>
                </div>
              </div>
              <button
                onClick={() => setPlayerAdminMessageToast(null)}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Super Admin Live Alert Notification */}
      <AnimatePresence>
        {adminLiveAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.92 }}
            className="fixed top-4 sm:top-6 right-3 sm:right-6 z-[130] max-w-md w-[calc(100%-24px)]"
          >
            <div className="p-4 bg-zinc-950 border-2 border-amber-500 rounded-2xl shadow-2xl shadow-amber-500/30 text-white flex items-start space-x-3.5 backdrop-blur-xl">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/60 flex items-center justify-center text-amber-400 shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-amber-400 tracking-wide uppercase">
                  {adminLiveAlert.title}
                </div>
                <div className="text-xs text-zinc-200 mt-1 font-medium leading-relaxed">
                  {adminLiveAlert.subtitle}
                </div>
                <div className="mt-2.5 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setIsAdminPanelOpen(true);
                      setAdminLiveAlert(null);
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-[11px] rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <span>İdarəetmə Panelini Aç</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setAdminLiveAlert(null)}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Bağla
                  </button>
                </div>
              </div>
              <button
                onClick={() => setAdminLiveAlert(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Toast Notification for 3-Minute Deposit Settlement */}
      <AnimatePresence>
        {globalDepositToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full px-4"
          >
            <div className="p-3.5 bg-gradient-to-r from-emerald-950 via-zinc-900 to-emerald-950 border border-emerald-500 rounded-2xl shadow-2xl shadow-emerald-500/20 text-white flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-xs font-bold text-emerald-100 flex-1 leading-snug">
                {globalDepositToast}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth & Onboarding Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        lang={lang}
        initialMode={authMode}
        onSuccessAuth={(loggedInUser) => {
          setUser(loggedInUser);
        }}
      />

      {/* Cashier Modal */}
      {user && (
        <CashierModal
          isOpen={isCashierOpen}
          onClose={() => setIsCashierOpen(false)}
          lang={lang}
          user={user}
          onUpdateBalance={handleUpdateBalance}
        />
      )}

      {/* Create Custom Table Modal */}
      <CreateTableModal
        isOpen={isCreateTableOpen}
        onClose={() => setIsCreateTableOpen(false)}
        lang={lang}
        onEnterActiveTables={() => {
          // Find an active table with bots/players or the top active table
          const activeTbl = tables.find((t) => t.players.filter((p) => p !== null).length > 0) || tables[0];
          if (activeTbl) {
            handleJoinTable(activeTbl, false);
          }
        }}
        onCreateTable={handleCreateCustomTable}
      />

      {/* Hand Rankings Guide Modal */}
      <HandRankingsModal
        isOpen={isHandRankingsOpen}
        onClose={() => setIsHandRankingsOpen(false)}
        lang={lang}
      />

      {/* Table & Audio Settings Modal */}
      <TableSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        lang={lang}
        feltColor={feltColor}
        onSelectFeltColor={setFeltColor}
        isFourColor={isFourColor}
        onToggleFourColor={setIsFourColor}
        isSoundMuted={isMuted}
        onToggleSound={setIsMuted}
        volume={volume}
        onVolumeChange={setVolume}
        autoMuck={autoMuck}
        onToggleAutoMuck={setAutoMuck}
        autoRebuy={autoRebuy}
        onToggleAutoRebuy={handleToggleAutoRebuy}
        onOpenSupport={() => setIsSupportOpen(true)}
      />

      {/* Live Support Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        lang={lang}
      />

      {/* User Profile & Account Settings Modal */}
      {user && (
        <UserSettingsModal
          isOpen={isUserSettingsOpen}
          onClose={() => setIsUserSettingsOpen(false)}
          lang={lang}
          user={user}
          onUpdateUser={(updatedData) => {
            setUser({
              ...user,
              ...updatedData,
            });
            // Update in local cache as well
            try {
              const localSaved = localStorage.getItem('royal_poker_user');
              if (localSaved) {
                const parsed = JSON.parse(localSaved);
                localStorage.setItem('royal_poker_user', JSON.stringify({ ...parsed, ...updatedData }));
              }
            } catch {
              // ignore
            }
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Super Admin Panel Modal */}
      {user && (
        <AdminPanelModal
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          lang={lang}
          currentUser={user}
          tables={tables}
          onKickPlayer={async (tableId, playerId) => {
            emitKickPlayerSocket(tableId, playerId);
            await kickPlayerFromTableInFirestore(tableId, playerId);
            setTables((prev) =>
              prev.map((t) => {
                if (t.id === tableId) {
                  const updatedPlayers = (t.players || []).map((p) => (p && p.id === playerId ? null : p));
                  return { ...t, players: updatedPlayers };
                }
                return t;
              })
            );
            if (activeTable && activeTable.id === tableId) {
              const updatedPlayers = (activeTable.players || []).map((p) => (p && p.id === playerId ? null : p));
              setActiveTable({ ...activeTable, players: updatedPlayers });
            }
          }}
          onAddBotToTable={async (tableId) => {
            setTables((prev) => {
              const target = prev.find((t) => t.id === tableId);
              if (!target) return prev;
              const currentPlayers = target.players || [];
              const emptyIdx = currentPlayers.findIndex((p) => p === null);
              if (emptyIdx === -1) return prev;

              const bot = createBotPlayer(
                emptyIdx,
                target.id,
                target.bigBlind,
                target.gameType || 'texas',
                undefined,
                undefined,
                currentPlayers
              );
              const updatedPlayers = [...currentPlayers];
              updatedPlayers[emptyIdx] = bot;
              const updatedTable = { ...target, players: updatedPlayers };
              saveTableToFirestore(updatedTable);
              if (activeTable && activeTable.id === tableId) {
                setActiveTable(updatedTable);
              }
              return prev.map((t) => (t.id === tableId ? updatedTable : t));
            });
          }}
          onRemoveBotFromTable={async (tableId, botId) => {
            setTables((prev) => {
              const target = prev.find((t) => t.id === tableId);
              if (!target) return prev;
              const currentPlayers = target.players || [];
              let removeIdx = -1;
              if (botId) {
                removeIdx = currentPlayers.findIndex((p) => p && p.id === botId && !p.isHuman);
              } else {
                removeIdx = currentPlayers.findIndex((p) => p && !p.isHuman);
              }
              if (removeIdx === -1) return prev;

              const updatedPlayers = [...currentPlayers];
              updatedPlayers[removeIdx] = null;
              const updatedTable = { ...target, players: updatedPlayers };
              saveTableToFirestore(updatedTable);
              if (activeTable && activeTable.id === tableId) {
                setActiveTable(updatedTable);
              }
              return prev.map((t) => (t.id === tableId ? updatedTable : t));
            });
          }}
          onCloseTable={async (tableId) => {
            emitCloseTableSocket(tableId);
            await deleteTableFromFirestore(tableId);
            setTables((prev) => prev.filter((t) => t.id !== tableId));
            if (activeTable && activeTable.id === tableId) {
              setActiveTable(null);
              setCurrentView('lobby');
            }
          }}
          onUpdateTableLimits={async (tableId, smallBlind, bigBlind) => {
            emitUpdateTableLimitsSocket(tableId, smallBlind, bigBlind);
            await updateTableBlindsInFirestore(tableId, smallBlind, bigBlind);
            setTables((prev) =>
              prev.map((t) =>
                t.id === tableId
                  ? {
                      ...t,
                      smallBlind,
                      bigBlind,
                      minBuyIn: smallBlind * 40,
                      maxBuyIn: bigBlind * 100,
                    }
                  : t
              )
            );
            if (activeTable && activeTable.id === tableId) {
              setActiveTable({
                ...activeTable,
                smallBlind,
                bigBlind,
                minBuyIn: smallBlind * 40,
                maxBuyIn: bigBlind * 100,
              });
            }
          }}
          onOpenNewTableModal={() => {
            setIsAdminPanelOpen(false);
            setIsCreateTableOpen(true);
          }}
          onSpectateTable={(table) => {
            handleJoinTable(table, true);
          }}
          onRefreshUserData={() => {
            if (user) {
              const latest = adminStorage.getRegisteredPlayers().find(p => p.id === user.id);
              if (latest) {
                setUser({
                  ...user,
                  realBalance: latest.realBalance,
                  bonusBalance: latest.bonusBalance,
                });
              }
            }
          }}
        />
      )}
    </div>
  );
}
