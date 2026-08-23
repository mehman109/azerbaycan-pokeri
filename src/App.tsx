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
import { adminStorage } from './utils/adminStore';
import { generateInitialTables, createPopulatedTable, createBotPlayer } from './utils/mockData';
import { createDeck } from './utils/pokerEngine';
import { soundManager } from './utils/audioEngine';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { 
  auth, 
  syncUserProfile, 
  updateUserBalanceInFirebase, 
  getSavedLocalUser, 
  clearLocalUser, 
  isAdminEmail 
} from './services/firebase';
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

  // Dynamic Lobby Activity & Shifting Engine (every 2 to 11 seconds):
  // Updates real player counts, adds/removes bots dynamically, and re-orders/shifts tables smoothly
  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const scheduleNextShift = () => {
      // Random interval between 2000ms (2s) and 11000ms (11s)
      const nextDelay = 2000 + Math.floor(Math.random() * 9000);

      timeoutId = setTimeout(() => {
        setTables((prevTables) => {
          if (prevTables.length === 0) return prevTables;

          // Pick 1 or 2 random tables to update
          const updated = prevTables.map((tbl) => {
            if (Math.random() > 0.45) return tbl; // 55% chance this table updates

            const players = [...tbl.players];
            const emptyIndices: number[] = [];
            const occupiedBotIndices: number[] = [];

            players.forEach((p, idx) => {
              if (idx === 0 && p?.isHuman) return; // preserve human seat if present
              if (p === null) {
                emptyIndices.push(idx);
              } else if (!p.isHuman) {
                occupiedBotIndices.push(idx);
              }
            });

            // Random action: Bot joins an empty seat (65% chance) or leaves (35% chance)
            const shouldAdd = Math.random() < 0.65 || occupiedBotIndices.length <= 1;

            if (shouldAdd && emptyIndices.length > 0) {
              const targetSeat = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
              players[targetSeat] = createBotPlayer(targetSeat, tbl.id, tbl.bigBlind, tbl.gameType, undefined, undefined, players);
            } else if (!shouldAdd && occupiedBotIndices.length > 1) {
              const targetSeat = occupiedBotIndices[Math.floor(Math.random() * occupiedBotIndices.length)];
              players[targetSeat] = null;
            }

            const activeCount = players.filter((p) => p !== null).length;
            const dynamicAvgPot = Math.max(tbl.bigBlind * 10, tbl.bigBlind * (15 + activeCount * 8));

            return {
              ...tbl,
              players,
              avgPot: dynamicAvgPot,
            };
          });

          // Dynamic Shifting: Prioritize 6-Max tables and active player density
          const sorted = [...updated].sort((a, b) => {
            // 1. Prioritize 6-Max tables at the top
            const isA6Max = a.capacity === 6 ? 1 : 0;
            const isB6Max = b.capacity === 6 ? 1 : 0;
            if (isB6Max !== isA6Max) {
              return isB6Max - isA6Max;
            }

            // 2. Sort by player count and activity
            const countA = a.players.filter((p) => p !== null).length;
            const countB = b.players.filter((p) => p !== null).length;
            if (countB !== countA) {
              return countB - countA;
            }
            return Math.random() - 0.5;
          });

          return sorted;
        });

        scheduleNextShift();
      }, nextDelay);
    };

    scheduleNextShift();
    return () => clearTimeout(timeoutId);
  }, []);

  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'admin'>('signin');
  const [isCashierOpen, setIsCashierOpen] = useState(false);
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [isHandRankingsOpen, setIsHandRankingsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  // Table Visual & Audio Settings
  const [feltColor, setFeltColor] = useState<FeltColor>('emerald');
  const [isFourColor, setIsFourColor] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.6);
  const [autoMuck, setAutoMuck] = useState<boolean>(true);
  const [globalDepositToast, setGlobalDepositToast] = useState<string | null>(null);

  // Background check for pending 3-minute deposits even when CashierModal is closed
  useEffect(() => {
    const checkPendingDeposits = () => {
      try {
        const saved = localStorage.getItem('royal_poker_pending_deposits');
        if (!saved) return;
        const deposits: Array<{
          id: string;
          amount: number;
          status: string;
          targetTimestamp: number;
        }> = JSON.parse(saved);

        const now = Date.now();
        let changed = false;

        deposits.forEach((dep) => {
          if (dep.status === 'processing' && now >= dep.targetTimestamp) {
            dep.status = 'completed';
            changed = true;
            if (user) {
              const newReal = Number((user.realBalance + dep.amount).toFixed(2));
              handleUpdateBalance(newReal, user.playMoneyBalance, user.bonusBalance);
              soundManager.playWinSound();
              confetti({ particleCount: 90, spread: 85, origin: { y: 0.4 } });
              setGlobalDepositToast(
                lang === 'az'
                  ? `🎉 Təbriklər! $${dep.amount.toFixed(2)} depozitiniz təsdiqləndi və Real Balansınıza əlavə edildi!`
                  : `🎉 $${dep.amount.toFixed(2)} deposit credited to your Real Balance!`
              );
              setTimeout(() => setGlobalDepositToast(null), 6000);
            }
          }
        });

        if (changed) {
          localStorage.setItem('royal_poker_pending_deposits', JSON.stringify(deposits));
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(checkPendingDeposits, 1000);
    return () => clearInterval(interval);
  }, [user, lang]);

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

    // Check if Bonus reaches $100.00 -> Convert $100 to Real balance
    if (newBonus >= 100 && !isTurnoverDone) {
      newReal = Number((newReal + 100).toFixed(2));
      newBonus = Number(Math.max(0, newBonus - 100).toFixed(2));
      isTurnoverDone = true;
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
  };

  // Leave Table handler
  const handleLeaveTable = () => {
    setActiveTable(null);
    setCurrentView('lobby');
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

  // Create Private Table Handler
  const handleCreateCustomTable = (data: {
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
      id: `tbl_custom_${Date.now()}`,
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
    });

    setTables([newTbl, ...tables]);
    handleJoinTable(newTbl, true);
  };

  return (
    <div className="min-h-screen w-full max-w-full bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950 overflow-x-hidden">
      {/* Global Navigation Header */}
      <HeaderNav
        user={user}
        lang={lang}
        onOpenCashier={() => setIsCashierOpen(true)}
        onOpenCreateTable={() => setIsCreateTableOpen(true)}
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
            isFourColor={isFourColor}
            feltColor={feltColor}
            autoMuck={autoMuck}
          />
        )}
      </main>

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
      />

      {/* Live Support Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        lang={lang}
      />
    </div>
  );
}
