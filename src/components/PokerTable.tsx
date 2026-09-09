import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PokerTableState, 
  Player, 
  Card, 
  GameStage, 
  PlayerActionType, 
  UserProfile, 
  FeltColor, 
  HandHistoryRecord,
  ChatMessage,
  FloatingEmoji,
  BotSystemConfig,
  PlayerHandActionLog
} from '../types/poker';
import { translations, Language } from '../utils/translations';
import { PlayingCard } from './PlayingCard';
import { ActionControls } from './ActionControls';
import { TableChat } from './TableChat';
import { TableStatsModal } from './TableStatsModal';
import { calculatePlayerSessionStats } from '../utils/pokerStats';
import { 
  evaluateBestHand, 
  getBotAction, 
  createDeck, 
  calculateSidePots 
} from '../utils/pokerEngine';
import { createBotPlayer } from '../utils/mockData';
import { soundManager } from '../utils/audioEngine';
import confetti from 'canvas-confetti';
import { AvatarWithFrame } from './AvatarWithFrame';
import { ALL_VIP_LEVELS, calculateVipProgress } from '../utils/vipProgression';
import { 
  recordTableRake, 
  subscribeToBotSystemConfig, 
  fetchBotSystemConfigFromFirestore,
  subscribeToTableState,
  saveTableToFirestore,
  saveTableStateAtomicInFirestore,
  leaveTableSeatInFirestore,
  leaveTableSeatInFirestoreAtomic,
  joinTableSeatInFirestoreAtomic,
  sendTableChatMessage,
  subscribeToTableChat,
  sendTableEmoji,
  subscribeToTableEmojis
} from '../services/firebase';
import {
  joinTableSocket,
  leaveTableSocket,
  emitPlayerLeaveSocket,
  syncTableStateSocket,
  emitPlayerActionSocket,
  subscribeToPlayerActionSocket,
  subscribeToTableStateSocket,
  sendTableChatMessageSocket,
  subscribeToTableChatSocket,
  sendTableEmojiSocket,
  subscribeToTableEmojiSocket,
  subscribeToPlayerKickedSocket,
  subscribeToTableClosedSocket,
} from '../services/socket';
import { 
  LogOut, 
  PlusCircle, 
  History, 
  Award, 
  Settings, 
  Volume2, 
  VolumeX, 
  Crown, 
  Clock, 
  Coins, 
  Flame,
  ChevronRight,
  Shield,
  PlayCircle,
  Gift,
  MessageSquare,
  Percent,
  Zap,
  Tag,
  Edit3,
  BarChart2,
  Share2,
  Check,
  Menu,
  RotateCw,
  X,
  Layers,
  ArrowDown,
  HelpCircle,
  BookOpen,
  Home
} from 'lucide-react';
import {
  QUICK_CHAT_PHRASES,
  getQuickPhraseText,
} from '../constants/chatPhrases';
import { PlayerNoteModal } from './PlayerNoteModal';
import {
  getAllPlayerNotes,
  getPresetByColor,
  PlayerNote,
} from '../utils/playerNotes';

interface PokerTableProps {
  initialTable: PokerTableState;
  currentUser: UserProfile;
  lang: Language;
  onLeaveTable: () => void;
  onLogout?: () => void;
  onUpdateUserBalance: (real: number, play: number, bonus?: number, claimedSpecialBonus?: boolean) => void;
  onOpenHandRankings: () => void;
  onOpenSettings: () => void;
  onOpenSupport?: () => void;
  isFourColor: boolean;
  feltColor: FeltColor;
  autoMuck: boolean;
  autoRebuy?: boolean;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  initialTable,
  currentUser,
  lang,
  onLeaveTable,
  onLogout,
  onUpdateUserBalance,
  onOpenHandRankings,
  onOpenSettings,
  onOpenSupport,
  isFourColor,
  feltColor,
  autoMuck,
  autoRebuy = true,
}) => {
  const t = translations[lang];
  const [table, setTable] = useState<PokerTableState>(initialTable);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(initialTable.timeBank || 30);
  const [preAction, setPreAction] = useState<'check_fold' | 'check' | 'call_any' | null>(null);
  const [sitOutNextHand, setSitOutNextHand] = useState(false);
  const [showRebuyModal, setShowRebuyModal] = useState(false);
  const [rebuyAmount, setRebuyAmount] = useState(initialTable.bigBlind * 50);
  const [handHistory, setHandHistory] = useState<HandHistoryRecord[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'c_init',
      senderName: 'Dealer',
      senderAvatar: '',
      text: lang === 'az' ? 'Masaya xoş gəlmisiniz! Uğurlar.' : 'Welcome to the table! Good luck.',
      timestamp: Date.now(),
      isSystem: true,
    },
  ]);
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [playerSpeechBubbles, setPlayerSpeechBubbles] = useState<Record<string, { text: string; id: string }>>({});

  const triggerSpeechBubble = (senderName: string, text: string) => {
    if (!senderName) return;
    const bubbleId = `bubble_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setPlayerSpeechBubbles((prev) => ({
      ...prev,
      [senderName]: { text, id: bubbleId },
    }));
    setTimeout(() => {
      setPlayerSpeechBubbles((prev) => {
        if (prev[senderName]?.id === bubbleId) {
          const next = { ...prev };
          delete next[senderName];
          return next;
        }
        return prev;
      });
    }, 4200);
  };

  // Local Browser Stored Player Notes
  const [playerNotes, setPlayerNotes] = useState<Record<string, PlayerNote>>(() => getAllPlayerNotes());
  const [noteTargetPlayer, setNoteTargetPlayer] = useState<Player | null>(null);

  const handleRefreshPlayerNotes = () => {
    setPlayerNotes(getAllPlayerNotes());
  };

  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [copiedRoomToast, setCopiedRoomToast] = useState<boolean>(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [isRefreshingTable, setIsRefreshingTable] = useState<boolean>(false);
  const [showJackpotModal, setShowJackpotModal] = useState<boolean>(false);
  const jackpotPool = 14250.75;

  const handleManualTableRefresh = () => {
    soundManager.playButtonClick();
    setIsRefreshingTable(true);
    setTimeout(() => {
      setIsRefreshingTable(false);
    }, 600);
  };

  const handleShareRoomLink = () => {
    soundManager.playButtonClick();
    const roomUrl = `${window.location.origin}${window.location.pathname}?table=${table.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(roomUrl).catch(() => {});
    }
    setCopiedRoomToast(true);
    setTimeout(() => setCopiedRoomToast(false), 3000);
  };

  const currentHandActionTrackingRef = useRef<Record<string, PlayerHandActionLog>>({});

  // Compute live session stats for Hero to display in HUD and header
  const heroLiveStats = calculatePlayerSessionStats(
    handHistory,
    currentUser.id,
    currentUser.username,
    true,
    lang
  );

  const [winnerBanner, setWinnerBanner] = useState<{ 
    name: string; 
    amount: number; 
    totalPot?: number; 
    rakeAmount?: number; 
    handName: string 
  } | null>(null);

  // User Balances (Real + Bonus Support)
  const userRealBalance = currentUser.realBalance || 0;
  const userBonusBalance = currentUser.bonusBalance || 0;
  const totalUsableBalance = Number((userRealBalance + userBonusBalance).toFixed(2));

  // Seat Selection & Buy-in Modal State
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(null);
  const [showBuyInModal, setShowBuyInModal] = useState<boolean>(false);
  const [buyInFundingSource, setBuyInFundingSource] = useState<'bonus' | 'real'>(
    userRealBalance <= 0 && userBonusBalance > 0 ? 'bonus' : 'real'
  );
  const [isPlayerUsingBonus, setIsPlayerUsingBonus] = useState<boolean>(false);
  const [buyInAmount, setBuyInAmount] = useState<number>(initialTable.bigBlind * 50);

  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const botTurnTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nextHandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Identify local human player seat specifically by currentUser.id (Multi-Device Multi-Player Safe)
  const humanPlayer = table.players.find((p) => p && p.id === currentUser.id) || null;
  const humanSeatIndex = humanPlayer ? humanPlayer.seatIndex : -1;
  const isHumanTurn = humanPlayer !== null && table.currentTurnSeatIndex === humanSeatIndex && table.stage !== 'showdown' && table.stage !== 'hand_ended' && table.stage !== 'waiting';

  // The first seated human player (or anyone if no humans) acts as the deterministic table orchestrator for bot actions & hand transitions
  const firstHumanPlayer = table.players.find((p) => p && p.isHuman);
  const isTableOrchestrator = !firstHumanPlayer || firstHumanPlayer.id === currentUser.id;

  // Unified Real-time Broadcast: Sub-millisecond WebSocket push + Durable Firestore persistence
  const broadcastTableState = (stateToBroadcast: PokerTableState) => {
    const stateWithTimestamp: PokerTableState = {
      ...stateToBroadcast,
      updatedAt: Date.now(),
    };
    try {
      syncTableStateSocket(stateWithTimestamp);
    } catch (e) {
      console.warn('Socket sync error:', e);
    }
    saveTableToFirestore(stateWithTimestamp);
  };

  // Evaluate human current best hand
  const humanHandEval = humanPlayer && humanPlayer.cards && humanPlayer.cards.length > 0
    ? evaluateBestHand(humanPlayer.cards, table.communityCards, table.gameType)
    : null;

  // Turn Timer countdown effect (30s default)
  useEffect(() => {
    if (table.stage === 'showdown' || table.stage === 'hand_ended' || table.stage === 'waiting') {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      return;
    }

    setTurnTimeLeft(table.timeBank || 30);
    if (turnTimerRef.current) clearInterval(turnTimerRef.current);

    turnTimerRef.current = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(turnTimerRef.current!);
          // Auto timeout action
          handleTurnTimeout();
          return 0;
        }
        if (prev <= 5 && isHumanTurn) {
          soundManager.playTimerTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    };
  }, [table.currentTurnSeatIndex, table.stage, table.timeBank]);

  const [handsPlayedCount, setHandsPlayedCount] = useState<number>(0);
  const [nextHandCountdown, setNextHandCountdown] = useState<number | null>(null);

  // Real-time Bot Settings from Admin Panel / Firestore (Bots disabled by default until Admin enables them)
  const [botConfig, setBotConfig] = useState<BotSystemConfig>(() => {
    try {
      const local = localStorage.getItem('royal_poker_bot_config');
      if (local) {
        const parsed = JSON.parse(local);
        return {
          isBotsActive: parsed.isBotsActive === true,
          botDifficulty: parsed.botDifficulty || 'pro',
          autoJoinLeaveEnabled: parsed.autoJoinLeaveEnabled === true,
          minThinkSeconds: parsed.minThinkSeconds || 4,
          maxThinkSeconds: parsed.maxThinkSeconds || 9,
          targetTableOccupancy: parsed.targetTableOccupancy || 4,
        };
      }
    } catch {}
    return {
      isBotsActive: false,
      botDifficulty: 'pro',
      autoJoinLeaveEnabled: false,
      minThinkSeconds: 4,
      maxThinkSeconds: 9,
      targetTableOccupancy: 4,
    };
  });

  useEffect(() => {
    // Initial fetch
    fetchBotSystemConfigFromFirestore().then((cfg) => {
      if (cfg) {
        setBotConfig(cfg);
        if (cfg.isBotsActive !== true) {
          setTable((prev) => {
            const hasBots = prev.players.some((p) => p && !p.isHuman);
            if (!hasBots) return prev;
            const sanitized = prev.players.map((p) => (p && !p.isHuman ? null : p));
            return {
              ...prev,
              players: sanitized,
              stage: sanitized.filter((p) => p !== null).length < 2 ? 'waiting' : prev.stage,
              pot: sanitized.filter((p) => p !== null).length < 2 ? 0 : prev.pot,
              communityCards: sanitized.filter((p) => p !== null).length < 2 ? [] : prev.communityCards,
              handWinners: sanitized.filter((p) => p !== null).length < 2 ? [] : prev.handWinners,
            };
          });
        }
      }
    });

    // Real-time listener so whenever admin changes difficulty or timer, all tables update live
    const unsubscribe = subscribeToBotSystemConfig((cfg) => {
      if (cfg) {
        setBotConfig(cfg);
        // If bots were just deactivated, instantly remove all bots from the table
        if (cfg.isBotsActive !== true) {
          setTable((prev) => {
            const hasBots = prev.players.some((p) => p && !p.isHuman);
            if (!hasBots) return prev;
            const sanitized = prev.players.map((p) => (p && !p.isHuman ? null : p));
            return {
              ...prev,
              players: sanitized,
              stage: sanitized.filter((p) => p !== null).length < 2 ? 'waiting' : prev.stage,
              pot: sanitized.filter((p) => p !== null).length < 2 ? 0 : prev.pot,
              communityCards: sanitized.filter((p) => p !== null).length < 2 ? [] : prev.communityCards,
              handWinners: sanitized.filter((p) => p !== null).length < 2 ? [] : prev.handWinners,
            };
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Real-Time Multiplayer Table State Synchronization (WebSocket 0-delay + Firestore fallback)
  useEffect(() => {
    const handleRemoteTableUpdate = (remoteTable: PokerTableState) => {
      if (!remoteTable || !remoteTable.id) return;
      setTable((prev) => {
        // Keep human player's local hole cards intact
        const currentLocalHuman = prev.players.find((p) => p && p.id === currentUser.id);
        const capacity = remoteTable.capacity || prev.capacity || 6;
        const incomingPlayers = Array.isArray(remoteTable.players) ? [...remoteTable.players] : [];
        while (incomingPlayers.length < capacity) {
          incomingPlayers.push(null);
        }

        const updatedPlayers = incomingPlayers.map((rp) => {
          if (rp && currentLocalHuman && rp.id === currentUser.id && currentLocalHuman.cards?.length > 0 && (!rp.cards || rp.cards.length === 0)) {
            return {
              ...rp,
              cards: currentLocalHuman.cards,
            };
          }
          return rp;
        });

        return {
          ...remoteTable,
          players: updatedPlayers,
          feltColor: prev.feltColor || remoteTable.feltColor,
        };
      });

      // Synchronize winner banner for all clients when hand ends
      if (remoteTable.stage === 'hand_ended' && remoteTable.handWinners && remoteTable.handWinners.length > 0) {
        const firstW = remoteTable.handWinners[0];
        const winnerNames = remoteTable.handWinners.map((w) => {
          const p = (remoteTable.players || []).find((pl) => pl && pl.id === w.playerId);
          return p ? p.name : 'Winner';
        }).join(' & ');
        setWinnerBanner({
          name: winnerNames,
          amount: firstW.amount,
          totalPot: remoteTable.pot,
          handName: firstW.handName,
        });
      } else if (remoteTable.stage === 'preflop') {
        setWinnerBanner(null);
      }
    };

    // Join Table Room via WebSocket
    joinTableSocket(initialTable.id, { id: currentUser.id, username: currentUser.username });

    // 0. Zero-Latency Live Player Action Broadcast Listener (Instant sound & movement across all devices)
    const unsubSocketAction = subscribeToPlayerActionSocket(initialTable.id, (actionData) => {
      if (!actionData) return;
      // Only trigger if action is from another player at this table
      if (actionData.playerId !== currentUser.id) {
        if (actionData.actionType === 'fold') {
          soundManager.playFoldSound();
        } else if (actionData.actionType === 'check') {
          soundManager.playCheckSound();
        } else if (actionData.actionType === 'all_in') {
          soundManager.playAllInSound();
        } else {
          soundManager.playChipSound();
        }

        const pName = actionData.playerName || 'Player';
        const actionLabel = actionData.actionType.toUpperCase() + (actionData.amount && actionData.amount > 0 ? ` $${actionData.amount.toFixed(2)}` : '');
        triggerSpeechBubble(pName, actionLabel);
      }
    });

    // 1. Primary Low-Latency WebSocket Synchronization
    const unsubSocketTable = subscribeToTableStateSocket(initialTable.id, handleRemoteTableUpdate);

    // 2. Persistent Firestore Synchronization
    const unsubFirestoreTable = subscribeToTableState(initialTable.id, handleRemoteTableUpdate);

    // 3. Real-Time Table Chat Listeners (WebSocket + Firestore deduplicated)
    const unsubSocketChat = subscribeToTableChatSocket(initialTable.id, (msg) => {
      if (!msg) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      if (!msg.isSystem && Date.now() - msg.timestamp < 6000) {
        triggerSpeechBubble(msg.senderName, msg.text);
      }
    });

    const unsubFirestoreChat = subscribeToTableChat(initialTable.id, (remoteMsgs) => {
      if (remoteMsgs && remoteMsgs.length > 0) {
        setChatMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOnes = remoteMsgs.filter((m) => !existingIds.has(m.id));
          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes];
        });
        const latest = remoteMsgs[remoteMsgs.length - 1];
        if (latest && !latest.isSystem && Date.now() - latest.timestamp < 6000) {
          triggerSpeechBubble(latest.senderName, latest.text);
        }
      }
    });

    // 4. Real-Time Table Emojis Listeners (WebSocket + Firestore)
    const unsubSocketEmojis = subscribeToTableEmojiSocket(initialTable.id, (incomingEmoji) => {
      setFloatingEmojis((prev) => [...prev, incomingEmoji]);
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((e) => e.id !== incomingEmoji.id));
      }, 3000);
    });

    const unsubFirestoreEmojis = subscribeToTableEmojis(initialTable.id, (incomingEmoji) => {
      setFloatingEmojis((prev) => [...prev, incomingEmoji]);
      setTimeout(() => {
        setFloatingEmojis((prev) => prev.filter((e) => e.id !== incomingEmoji.id));
      }, 3000);
    });

    // 5. Admin Kicked Player listener
    const unsubKicked = subscribeToPlayerKickedSocket(initialTable.id, ({ playerId, reason }) => {
      if (playerId === currentUser.id) {
        setTable((latestTable) => {
          const myPlayer = (latestTable.players || []).find((p) => p && p.id === currentUser.id);
          const uncommittedChips = myPlayer ? Number(Math.max(0, myPlayer.chips).toFixed(2)) : 0;
          if (uncommittedChips > 0) {
            onUpdateUserBalance(
              Number((currentUser.realBalance + uncommittedChips).toFixed(2)),
              currentUser.playMoneyBalance,
              currentUser.bonusBalance
            );
          }
          return latestTable;
        });
        soundManager.playErrorSound();
        alert(reason || '⚠️ Admin tərəfindən masadan kənarlaşdırıldınız.');
        onLeaveTable();
      }
    });

    // 6. Admin Table Closed listener
    const unsubClosed = subscribeToTableClosedSocket(initialTable.id, ({ reason }) => {
      setTable((latestTable) => {
        const myPlayer = (latestTable.players || []).find((p) => p && p.id === currentUser.id);
        const uncommittedChips = myPlayer ? Number(Math.max(0, myPlayer.chips).toFixed(2)) : 0;
        if (uncommittedChips > 0) {
          onUpdateUserBalance(
            Number((currentUser.realBalance + uncommittedChips).toFixed(2)),
            currentUser.playMoneyBalance,
            currentUser.bonusBalance
          );
        }
        return latestTable;
      });
      soundManager.playErrorSound();
      alert(reason || '⚠️ Masa Admin tərəfindən bağlandı.');
      onLeaveTable();
    });

    return () => {
      leaveTableSocket(initialTable.id, currentUser.id);
      unsubSocketAction();
      unsubSocketTable();
      unsubFirestoreTable();
      unsubSocketChat();
      unsubFirestoreChat();
      unsubSocketEmojis();
      unsubFirestoreEmojis();
      unsubKicked();
      unsubClosed();
    };
  }, [initialTable.id, currentUser.id]);

  // Persist active table session in browser storage for instant recovery on refresh
  useEffect(() => {
    if (table.id) {
      try {
        localStorage.setItem('poker_active_table_id', table.id);
      } catch {}
    }
  }, [table.id]);

  // When hand ends, start a 4-second countdown and automatically deal the next hand!
  useEffect(() => {
    if (table.stage !== 'hand_ended') {
      setNextHandCountdown(null);
      if (nextHandTimeoutRef.current) clearTimeout(nextHandTimeoutRef.current);
      return;
    }

    setNextHandCountdown(4);
    const countdownInterval = setInterval(() => {
      setNextHandCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    // Orchestrator executes at exactly 4000ms. Other clients have a 5500ms fallback
    const delay = isTableOrchestrator ? 4000 : 5500;
    if (nextHandTimeoutRef.current) clearTimeout(nextHandTimeoutRef.current);
    nextHandTimeoutRef.current = setTimeout(() => {
      startNextHand();
    }, delay);

    return () => {
      clearInterval(countdownInterval);
      if (nextHandTimeoutRef.current) clearTimeout(nextHandTimeoutRef.current);
    };
  }, [table.stage, table.handNumber, isTableOrchestrator]);

  // When table is waiting, human is seated, and bots are active, spawn bots to start game (Orchestrator only)
  useEffect(() => {
    if (!isTableOrchestrator) return;
    if (table.stage === 'waiting' && botConfig.isBotsActive === true && botConfig.autoJoinLeaveEnabled === true) {
      const activeCount = table.players.filter((p) => p !== null).length;
      const targetCount = botConfig.targetTableOccupancy || 4;

      if (activeCount < targetCount) {
        const spawnTimer = setTimeout(() => {
          setTable((prev) => {
            const hasHuman = prev.players.some((p) => p && p.isHuman);
            if (!hasHuman && prev.isCustomCreated) return prev;

            const updated = [...prev.players];
            let currentSeats = updated.filter((p) => p !== null).length;
            const target = botConfig.targetTableOccupancy || 4;

            for (let i = 0; i < updated.length && currentSeats < target; i++) {
              if (!updated[i]) {
                const newBot = createBotPlayer(
                  i,
                  prev.id,
                  prev.bigBlind,
                  prev.gameType,
                  undefined,
                  undefined,
                  updated
                );
                updated[i] = newBot;
                currentSeats++;
              }
            }

            const updatedTable = {
              ...prev,
              players: updated,
            };
            broadcastTableState(updatedTable);
            return updatedTable;
          });
        }, 1200);

        return () => clearTimeout(spawnTimer);
      }
    }
  }, [table.stage, table.players, botConfig.isBotsActive, botConfig.autoJoinLeaveEnabled, botConfig.targetTableOccupancy, isTableOrchestrator]);

  // When table is waiting and 2+ active players are present, automatically start the hand! (Orchestrator only)
  useEffect(() => {
    if (!isTableOrchestrator) return;
    if (table.stage === 'waiting') {
      const activeCount = table.players.filter((p) => p !== null && !p.isSittingOut).length;
      if (activeCount >= 2) {
        const startTimer = setTimeout(() => {
          startNextHand();
        }, 1500);
        return () => clearTimeout(startTimer);
      }
    }
  }, [table.stage, table.players, isTableOrchestrator]);

  // Live Turn Countdown Timer & Auto-Timeout Execution
  useEffect(() => {
    // If the game is not in an active playing street, reset timer
    if (table.stage === 'showdown' || table.stage === 'hand_ended' || table.stage === 'waiting') {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      return;
    }

    const currentSeat = table.players[table.currentTurnSeatIndex];
    if (!currentSeat || currentSeat.isFolded || currentSeat.isAllIn || currentSeat.isSittingOut) {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      return;
    }

    // Reset turn countdown time to table timeBank (default 15s)
    const initialTime = table.timeBank || 15;
    setTurnTimeLeft(initialTime);

    if (turnTimerRef.current) clearInterval(turnTimerRef.current);

    turnTimerRef.current = setInterval(() => {
      setTurnTimeLeft((prevTime) => {
        const nextTime = prevTime - 1;

        // Play warning tick sound for the local human player when time is running out (<= 5s)
        if (currentSeat.isHuman && currentSeat.id === currentUser.id && nextTime <= 5 && nextTime > 0) {
          soundManager.playTimerTick();
        }

        if (nextTime <= 0) {
          if (turnTimerRef.current) clearInterval(turnTimerRef.current);

          // Only the single authoritative table orchestrator executes the timeout action to prevent race conditions
          if (isTableOrchestrator) {
            handleTurnTimeout();
          }
          return 0;
        }
        return nextTime;
      });
    }, 1000);

    return () => {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
    };
  }, [table.currentTurnSeatIndex, table.stage, isTableOrchestrator, currentUser.id, table.timeBank]);

  // Handle Bot Turn automatically with human-like 4 to 9 second thinking time & selected Bot Difficulty (Orchestrator only)
  useEffect(() => {
    if (!isTableOrchestrator) return;
    if (table.stage === 'showdown' || table.stage === 'hand_ended' || table.stage === 'waiting') return;

    const currentSeat = table.players[table.currentTurnSeatIndex];
    if (currentSeat && !currentSeat.isHuman && !currentSeat.isFolded && !currentSeat.isAllIn) {
      if (botTurnTimeoutRef.current) clearTimeout(botTurnTimeoutRef.current);

      // Human-like thinking time delay: 4 to 9 seconds (minThinkSeconds to maxThinkSeconds)
      const minDelay = (botConfig.minThinkSeconds || 4) * 1000;
      const maxDelay = (botConfig.maxThinkSeconds || 9) * 1000;
      const delay = minDelay + Math.random() * (maxDelay - minDelay);

      botTurnTimeoutRef.current = setTimeout(() => {
        const currentHuman = table.players.find((p) => p && p.isHuman);
        const humanBonusProgression = (currentUser.bonusBalance ?? 0) + (isPlayerUsingBonus && currentHuman ? currentHuman.chips : 0);
        const isHumanActiveInHand = Boolean(currentHuman && !currentHuman.isFolded && !currentHuman.isSittingOut);

        const botAction = getBotAction(
          currentSeat,
          table.communityCards,
          table.currentHighBet,
          table.pot,
          table.bigBlind,
          table.stage,
          table.gameType,
          humanBonusProgression,
          isHumanActiveInHand,
          botConfig.botDifficulty || 'pro' // Uses current Admin Panel setting (pro by default)
        );

        if (botAction.action === 'fold') soundManager.playFoldSound();
        else if (botAction.action === 'check') soundManager.playCheckSound();
        else if (botAction.action === 'all_in') soundManager.playAllInSound();
        else soundManager.playChipSound();

        executePlayerAction(currentSeat.seatIndex, botAction.action, botAction.amount);
      }, delay);
    }

    return () => {
      if (botTurnTimeoutRef.current) clearTimeout(botTurnTimeoutRef.current);
    };
  }, [table.currentTurnSeatIndex, table.stage, botConfig, isTableOrchestrator]);

  // Auto-runout community cards when players are all-in and no more bets are possible (Orchestrator only)
  useEffect(() => {
    if (!isTableOrchestrator) return;
    if (table.stage === 'showdown' || table.stage === 'hand_ended' || table.stage === 'waiting') return;

    const nonFolded = table.players.filter((p) => p && !p.isFolded && !p.isSittingOut);
    if (nonFolded.length < 2) return;

    const canBetPlayers = nonFolded.filter((p) => p && !p.isAllIn && p.chips > 0);
    const isRoundSettled = nonFolded.every(
      (p) => p && (p.isAllIn || p.chips === 0 || p.currentBet === table.currentHighBet)
    );

    // If at most 1 player has chips remaining and current bets are settled, auto-deal next street
    if (canBetPlayers.length <= 1 && isRoundSettled) {
      const runoutTimer = setTimeout(() => {
        setTable((prev) => {
          if (prev.stage === 'showdown' || prev.stage === 'hand_ended' || prev.stage === 'waiting') return prev;
          const nextState = advanceStreet(prev);
          broadcastTableState(nextState);
          return nextState;
        });
      }, 1400);

      return () => clearTimeout(runoutTimer);
    }
  }, [table.stage, table.currentHighBet, table.players, isTableOrchestrator]);

  // Helper to immediately refund uncalled bets to larger-stack players
  const refundUncalledBets = (
    currentPlayers: (Player | null)[],
    currentPot: number,
    currentHighBet: number
  ): {
    updatedPlayers: (Player | null)[];
    updatedPot: number;
    updatedHighBet: number;
    refunds: { playerId: string; playerName: string; amount: number }[];
  } => {
    const activePlayers = currentPlayers.filter((p): p is Player => p !== null && !p.isFolded);
    if (activePlayers.length === 0) {
      return { updatedPlayers: currentPlayers, updatedPot: currentPot, updatedHighBet: currentHighBet, refunds: [] };
    }

    const refunds: { playerId: string; playerName: string; amount: number }[] = [];
    let pot = currentPot;
    let highBet = currentHighBet;
    let players = [...currentPlayers];

    if (activePlayers.length === 1) {
      // Single remaining player (all others folded)
      const sole = activePlayers[0];
      const foldedPlayers = currentPlayers.filter((p): p is Player => p !== null && p.isFolded);
      const maxOpponentBet = foldedPlayers.length > 0 ? Math.max(...foldedPlayers.map((p) => p.currentBet)) : 0;

      if (sole.currentBet > maxOpponentBet) {
        const excess = Number((sole.currentBet - maxOpponentBet).toFixed(2));
        if (excess > 0) {
          players = players.map((p) => {
            if (p && p.id === sole.id) {
              const newChips = Number((p.chips + excess).toFixed(2));
              return {
                ...p,
                chips: newChips,
                currentBet: maxOpponentBet,
                totalRoundBet: Number(Math.max(0, p.totalRoundBet - excess).toFixed(2)),
                isAllIn: newChips === 0,
              };
            }
            return p;
          });
          pot = Number(Math.max(0, pot - excess).toFixed(2));
          highBet = maxOpponentBet;
          refunds.push({ playerId: sole.id, playerName: sole.name, amount: excess });
        }
      }
    } else {
      // 2 or more active players: sort by currentBet descending
      const sorted = [...activePlayers].sort((a, b) => b.currentBet - a.currentBet);
      const highest = sorted[0];
      const secondHighest = sorted[1];

      if (highest.currentBet > secondHighest.currentBet) {
        const excess = Number((highest.currentBet - secondHighest.currentBet).toFixed(2));
        if (excess > 0) {
          players = players.map((p) => {
            if (p && p.id === highest.id) {
              const newChips = Number((p.chips + excess).toFixed(2));
              return {
                ...p,
                chips: newChips,
                currentBet: secondHighest.currentBet,
                totalRoundBet: Number(Math.max(0, p.totalRoundBet - excess).toFixed(2)),
                isAllIn: newChips === 0,
              };
            }
            return p;
          });
          pot = Number(Math.max(0, pot - excess).toFixed(2));
          highBet = secondHighest.currentBet;
          refunds.push({ playerId: highest.id, playerName: highest.name, amount: excess });
        }
      }
    }

    return { updatedPlayers: players, updatedPot: pot, updatedHighBet: highBet, refunds };
  };

  // Execute Action for a Player
  const executePlayerAction = (
    seatIndex: number, 
    action: PlayerActionType, 
    amount: number,
    isTimeoutAction: boolean = false
  ) => {
    setTable((prevTable) => {
      const updatedPlayers = [...prevTable.players];
      const player = updatedPlayers[seatIndex];
      if (!player) return prevTable;

      let newPot = prevTable.pot;
      let newHighBet = prevTable.currentHighBet;
      let newMinRaise = prevTable.minRaise;
      const updatedPlayer: Player = { ...player };

      if (!isTimeoutAction) {
        // Reset missed turns counter on conscious player action
        updatedPlayer.consecutiveMissedTurns = 0;
      } else {
        // Increment missed turns count on timeout
        const newMissed = (player.consecutiveMissedTurns || 0) + 1;
        updatedPlayer.consecutiveMissedTurns = newMissed;
        if (newMissed >= 3) {
          updatedPlayer.isSittingOut = true;
          updatedPlayer.isFolded = true;
          updatedPlayer.cards = [];
        }
      }

      if (action === 'fold') {
        updatedPlayer.isFolded = true;
        updatedPlayer.lastAction = { type: 'fold', timestamp: Date.now() };
      } else if (action === 'check') {
        updatedPlayer.lastAction = { type: 'check', timestamp: Date.now() };
      } else if (action === 'call') {
        const toCall = Math.min(amount, updatedPlayer.chips);
        updatedPlayer.chips = Number(Math.max(0, updatedPlayer.chips - toCall).toFixed(2));
        updatedPlayer.currentBet = Number((updatedPlayer.currentBet + toCall).toFixed(2));
        updatedPlayer.totalRoundBet = Number((updatedPlayer.totalRoundBet + toCall).toFixed(2));
        newPot = Number((newPot + toCall).toFixed(2));
        if (updatedPlayer.chips === 0) updatedPlayer.isAllIn = true;
        updatedPlayer.lastAction = { type: 'call', amount: toCall, timestamp: Date.now() };
      } else if (action === 'bet' || action === 'raise') {
        const addedChips = amount - updatedPlayer.currentBet;
        const actualAddition = Math.min(addedChips, updatedPlayer.chips);
        updatedPlayer.chips = Number(Math.max(0, updatedPlayer.chips - actualAddition).toFixed(2));
        updatedPlayer.currentBet = Number((updatedPlayer.currentBet + actualAddition).toFixed(2));
        updatedPlayer.totalRoundBet = Number((updatedPlayer.totalRoundBet + actualAddition).toFixed(2));
        newPot = Number((newPot + actualAddition).toFixed(2));
        if (updatedPlayer.currentBet > newHighBet) {
          newMinRaise = Number((updatedPlayer.currentBet - newHighBet).toFixed(2));
          newHighBet = updatedPlayer.currentBet;
        }
        if (updatedPlayer.chips === 0) updatedPlayer.isAllIn = true;
        updatedPlayer.lastAction = {
          type: action,
          amount: updatedPlayer.currentBet,
          timestamp: Date.now(),
        };
      } else if (action === 'all_in') {
        const allInChips = updatedPlayer.chips;
        updatedPlayer.chips = 0;
        updatedPlayer.currentBet = Number((updatedPlayer.currentBet + allInChips).toFixed(2));
        updatedPlayer.totalRoundBet = Number((updatedPlayer.totalRoundBet + allInChips).toFixed(2));
        newPot = Number((newPot + allInChips).toFixed(2));
        if (updatedPlayer.currentBet > newHighBet) {
          newMinRaise = Math.max(prevTable.bigBlind, Number((updatedPlayer.currentBet - newHighBet).toFixed(2)));
          newHighBet = updatedPlayer.currentBet;
        }
        updatedPlayer.isAllIn = true;
        updatedPlayer.lastAction = { type: 'all_in', amount: updatedPlayer.currentBet, timestamp: Date.now() };
      }

      updatedPlayers[seatIndex] = updatedPlayer;

      // 0. Zero-latency instant action broadcast to all connected devices
      try {
        emitPlayerActionSocket({
          tableId: prevTable.id,
          playerId: player.id,
          playerName: player.name,
          avatar: player.avatar,
          actionType: action,
          amount: action === 'fold' ? 0 : action === 'check' ? 0 : action === 'call' ? Math.min(amount, player.chips) : amount,
          seatIndex: seatIndex,
          chipsRemaining: updatedPlayer.chips,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn('Action socket emit error:', err);
      }

      // Update real-time HUD action stats for this player
      const actionLog = currentHandActionTrackingRef.current[player.id];
      if (actionLog) {
        if (prevTable.stage === 'preflop') {
          if (action === 'call' || action === 'bet' || action === 'raise' || action === 'all_in') {
            actionLog.vpip = true;
          }
          if (
            action === 'raise' ||
            (action === 'bet' && amount > prevTable.bigBlind) ||
            (action === 'all_in' && amount > prevTable.currentHighBet)
          ) {
            actionLog.pfr = true;
            actionLog.vpip = true;
          }
        } else if (prevTable.stage === 'flop') {
          actionLog.sawFlop = true;
          if (action === 'bet') actionLog.flopBets++;
          else if (action === 'raise') actionLog.flopRaises++;
          else if (action === 'call') actionLog.flopCalls++;
          else if (action === 'check') actionLog.flopChecks++;
          else if (action === 'all_in') {
            if (amount > prevTable.currentHighBet) actionLog.flopRaises++;
            else actionLog.flopCalls++;
          }
        } else if (prevTable.stage === 'turn') {
          actionLog.sawTurn = true;
          if (action === 'bet') actionLog.turnBets++;
          else if (action === 'raise') actionLog.turnRaises++;
          else if (action === 'call') actionLog.turnCalls++;
          else if (action === 'check') actionLog.turnChecks++;
          else if (action === 'all_in') {
            if (amount > prevTable.currentHighBet) actionLog.turnRaises++;
            else actionLog.turnCalls++;
          }
        } else if (prevTable.stage === 'river') {
          actionLog.sawRiver = true;
          if (action === 'bet') actionLog.riverBets++;
          else if (action === 'raise') actionLog.riverRaises++;
          else if (action === 'call') actionLog.riverCalls++;
          else if (action === 'check') actionLog.riverChecks++;
          else if (action === 'all_in') {
            if (amount > prevTable.currentHighBet) actionLog.riverRaises++;
            else actionLog.riverCalls++;
          }
        }
      }

      let nextResult: PokerTableState;

      // Check if only 1 active player remains (everyone else folded)
      const remainingUnfolded = updatedPlayers.filter((p) => p && !p.isFolded);
      if (remainingUnfolded.length === 1 && remainingUnfolded[0]) {
        nextResult = endHandWithSoleWinner(prevTable, updatedPlayers, remainingUnfolded[0], newPot);
      } else {
        // Check if betting round is complete
        const nonFolded = updatedPlayers.filter((p): p is Player => p !== null && !p.isFolded && !p.isSittingOut);
        
        // Every non-folded player must have matched newHighBet and acted, or be all-in
        const allMatchedOrAllIn = nonFolded.every(
          (p) => (p.currentBet === newHighBet && p.lastAction !== undefined) || p.isAllIn || p.chips === 0
        );
        // Is there any non-folded player with chips who has not yet matched the highest bet?
        const hasUncalledBet = nonFolded.some(
          (p) => !p.isAllIn && p.chips > 0 && p.currentBet < newHighBet
        );

        const isRoundDone = allMatchedOrAllIn && !hasUncalledBet;

        if (isRoundDone) {
          // Process uncalled bet refunds before advancing street
          const refundRes = refundUncalledBets(updatedPlayers, newPot, newHighBet);
          if (refundRes.refunds.length > 0) {
            soundManager.playChipSound();
            refundRes.refunds.forEach((r) => {
              const refundText = lang === 'az'
                ? `💰 ${r.playerName} üçün $${r.amount.toFixed(2)} çağırılmamış mərc dərhal balansına qaytarıldı.`
                : `💰 Uncalled bet of $${r.amount.toFixed(2)} returned immediately to ${r.playerName}.`;
              const refundMsg: ChatMessage = {
                id: `sys_refund_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                tableId: prevTable.id,
                senderId: 'system',
                senderName: 'Dealer',
                senderAvatar: '',
                text: refundText,
                message: refundText,
                timestamp: Date.now(),
                isSystem: true,
              };
              setChatMessages((prev) => [...prev, refundMsg]);
              sendTableChatMessage(prevTable.id, refundMsg);
            });
          }

          // Advance street
          nextResult = advanceStreet({
            ...prevTable,
            pot: refundRes.updatedPot,
            currentHighBet: refundRes.updatedHighBet,
            minRaise: newMinRaise,
            players: refundRes.updatedPlayers,
          });
        } else {
          // Find next player who can act (not folded, not all-in, has chips)
          const nextSeat = getNextActiveSeat(updatedPlayers, seatIndex);
          nextResult = {
            ...prevTable,
            pot: newPot,
            currentHighBet: newHighBet,
            minRaise: newMinRaise,
            players: updatedPlayers,
            currentTurnSeatIndex: nextSeat,
          };
        }
      }

      broadcastTableState(nextResult);
      return nextResult;
    });
  };

  // Find next active seat (player who can make an action)
  const getNextActiveSeat = (players: (Player | null)[], fromSeat: number): number => {
    const totalSeats = players.length;
    for (let i = 1; i <= totalSeats; i++) {
      const idx = (fromSeat + i) % totalSeats;
      const p = players[idx];
      if (p && !p.isFolded && !p.isAllIn && !p.isSittingOut && p.chips > 0) {
        return idx;
      }
    }
    return fromSeat;
  };

  // Turn Timeout (Auto Check/Fold & Sit Out after 3 consecutive missed turns)
  const handleTurnTimeout = () => {
    const currentSeat = table.players[table.currentTurnSeatIndex];
    if (!currentSeat) return;

    const toCall = table.currentHighBet - currentSeat.currentBet;
    const actionToTake: PlayerActionType = toCall === 0 ? 'check' : 'fold';
    const missedTurns = (currentSeat.consecutiveMissedTurns || 0) + 1;

    // Execute the action with isTimeoutAction = true to register the missed turn
    executePlayerAction(currentSeat.seatIndex, actionToTake, 0, true);

    if (missedTurns >= 3) {
      if (currentSeat.isHuman) {
        setSitOutNextHand(true);
      }
      const sitOutText = lang === 'az'
        ? `⚠️ ${currentSeat.name} 3 ardıcıl gedişi qaçırdığı üçün masanın durğunluğunun qarşısını almaq məqsədilə avtomatik "Masadan Kənarda" (Sitting Out) statusuna keçirildi.`
        : `⚠️ ${currentSeat.name} missed 3 consecutive turns and was automatically transitioned to 'Sitting Out' to prevent table stagnation.`;
      const sitOutMsg: ChatMessage = {
        id: `sys_sitout_${Date.now()}`,
        tableId: table.id,
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '',
        text: sitOutText,
        message: sitOutText,
        timestamp: Date.now(),
        isSystem: true,
      };
      setChatMessages((prev) => [...prev, sitOutMsg]);
      sendTableChatMessage(table.id, sitOutMsg);
    } else {
      const warnText = lang === 'az'
        ? `⏱️ ${currentSeat.name} vaxtı bitdi: Avtomatik ${actionToTake === 'check' ? 'Check' : 'Fold'} edildi (Qaçırılan gediş: ${missedTurns}/3). 3 ardıcıl qaçırılsa Masadan Kənar olacaqsınız.`
        : `⏱️ ${currentSeat.name} time expired: Auto-${actionToTake === 'check' ? 'Check' : 'Fold'} (Missed turns: ${missedTurns}/3). Missing 3 in a row transitions to Sitting Out.`;
      const warnMsg: ChatMessage = {
        id: `sys_warn_timeout_${Date.now()}`,
        tableId: table.id,
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '',
        text: warnText,
        message: warnText,
        timestamp: Date.now(),
        isSystem: true,
      };
      setChatMessages((prev) => [...prev, warnMsg]);
      sendTableChatMessage(table.id, warnMsg);
    }
  };

  // Advance street (Preflop -> Flop -> Turn -> River -> Showdown)
  const advanceStreet = (currentState: PokerTableState): PokerTableState => {
    // Process any uncalled bet refunds first
    const refundRes = refundUncalledBets(currentState.players, currentState.pot, currentState.currentHighBet);

    // Reset current round bets for next street
    const resetPlayers = refundRes.updatedPlayers.map((p) =>
      p ? { ...p, currentBet: 0, lastAction: undefined } : null
    );

    let nextStage: GameStage = currentState.stage;
    const newCommunity = [...currentState.communityCards];
    const deck = [...currentState.deck];

    if (currentState.stage === 'preflop') {
      nextStage = 'flop';
      soundManager.playCardDeal();
      // Deal 3 flop cards
      newCommunity.push(deck.pop()!, deck.pop()!, deck.pop()!);
      // Mark sawFlop for all non-folded players in tracking logs
      for (const p of resetPlayers) {
        if (p && !p.isFolded && currentHandActionTrackingRef.current[p.id]) {
          currentHandActionTrackingRef.current[p.id].sawFlop = true;
        }
      }
    } else if (currentState.stage === 'flop') {
      nextStage = 'turn';
      soundManager.playCardDeal();
      // Deal 1 turn card
      newCommunity.push(deck.pop()!);
      // Mark sawTurn for active players
      for (const p of resetPlayers) {
        if (p && !p.isFolded && currentHandActionTrackingRef.current[p.id]) {
          currentHandActionTrackingRef.current[p.id].sawTurn = true;
        }
      }
    } else if (currentState.stage === 'turn') {
      nextStage = 'river';
      soundManager.playCardDeal();
      // Deal 1 river card
      newCommunity.push(deck.pop()!);
      // Mark sawRiver for active players
      for (const p of resetPlayers) {
        if (p && !p.isFolded && currentHandActionTrackingRef.current[p.id]) {
          currentHandActionTrackingRef.current[p.id].sawRiver = true;
        }
      }
    } else if (currentState.stage === 'river') {
      nextStage = 'showdown';
      for (const p of resetPlayers) {
        if (p && !p.isFolded && currentHandActionTrackingRef.current[p.id]) {
          currentHandActionTrackingRef.current[p.id].sawShowdown = true;
        }
      }
      return resolveShowdown({
        ...currentState,
        stage: 'showdown',
        pot: refundRes.updatedPot,
        players: resetPlayers,
        communityCards: newCommunity,
        currentHighBet: 0,
      });
    }

    // Find first active player after dealer button
    const firstToAct = getNextActiveSeat(resetPlayers, currentState.dealerSeatIndex);

    return {
      ...currentState,
      stage: nextStage,
      pot: refundRes.updatedPot,
      players: resetPlayers,
      communityCards: newCommunity,
      deck,
      currentHighBet: 0,
      minRaise: currentState.bigBlind,
      currentTurnSeatIndex: firstToAct,
    };
  };

  // Resolve Showdown with Hand Evaluator & Side Pots
  const resolveShowdown = (finalState: PokerTableState): PokerTableState => {
    soundManager.playWinSound();

    // 1. Evaluate hand strength score for every contender
    const activeContenders = finalState.players
      .filter((p): p is Player => p !== null && !p.isFolded)
      .map((p) => {
        const evalResult = evaluateBestHand(p.cards, finalState.communityCards, finalState.gameType);
        return {
          ...p,
          handRankScore: evalResult.score,
          handRankName: lang === 'az' ? evalResult.rankNameAz : evalResult.rankName,
          bestFiveCards: evalResult.bestFiveCards,
        };
      });

    // 2. Calculate Side Pots based on players' totalRoundBet
    const allPlayersInHand = finalState.players.filter((p): p is Player => p !== null);
    const sidePots = calculateSidePots(allPlayersInHand);

    let totalRakeCollected = 0;
    let totalNetDistributed = 0;
    const playerWinAmounts = new Map<string, number>();
    const winningPlayersList: Player[] = [];

    if (sidePots.length === 0) {
      // Fallback if no side pots found (equal distribution of main pot)
      activeContenders.sort((a, b) => (b.handRankScore || 0) - (a.handRankScore || 0));
      const bestScore = activeContenders[0]?.handRankScore || 0;
      const winners = activeContenders.filter((c) => c.handRankScore === bestScore);
      const totalPot = finalState.pot;
      const rakeAmount = Number((totalPot * 0.10).toFixed(2));
      const netPot = Number(Math.max(0, totalPot - rakeAmount).toFixed(2));
      const winShare = Number((netPot / (winners.length || 1)).toFixed(2));

      totalRakeCollected = rakeAmount;
      totalNetDistributed = netPot;
      winners.forEach((w) => {
        playerWinAmounts.set(w.id, winShare);
        winningPlayersList.push(w);
      });
    } else {
      // Distribute each side pot / main pot slice to the best eligible contender(s)
      for (const potSlice of sidePots) {
        const eligibleContenders = activeContenders.filter((c) =>
          potSlice.eligiblePlayerIds.includes(c.id)
        );

        if (eligibleContenders.length === 0) continue;

        // If only 1 contender is eligible for this slice (e.g. uncalled bet portion), refund 100% with 0% rake
        if (eligibleContenders.length === 1) {
          const sole = eligibleContenders[0];
          const curr = playerWinAmounts.get(sole.id) || 0;
          playerWinAmounts.set(sole.id, Number((curr + potSlice.amount).toFixed(2)));
          if (!winningPlayersList.some((w) => w.id === sole.id)) {
            winningPlayersList.push(sole);
          }
          totalNetDistributed += potSlice.amount;
          continue;
        }

        // 2 or more eligible contenders: find best hand among them
        eligibleContenders.sort((a, b) => (b.handRankScore || 0) - (a.handRankScore || 0));
        const bestScore = eligibleContenders[0].handRankScore || 0;
        const potWinners = eligibleContenders.filter((c) => c.handRankScore === bestScore);

        const potRake = Number((potSlice.amount * 0.10).toFixed(2));
        const potNet = Number(Math.max(0, potSlice.amount - potRake).toFixed(2));
        const share = Number((potNet / (potWinners.length || 1)).toFixed(2));

        totalRakeCollected = Number((totalRakeCollected + potRake).toFixed(2));
        totalNetDistributed = Number((totalNetDistributed + potNet).toFixed(2));

        potWinners.forEach((w) => {
          const curr = playerWinAmounts.get(w.id) || 0;
          playerWinAmounts.set(w.id, Number((curr + share).toFixed(2)));
          if (!winningPlayersList.some((p) => p.id === w.id)) {
            winningPlayersList.push(w);
          }
        });
      }
    }

    const updatedPlayers = finalState.players.map((p) => {
      if (!p) return null;
      const winAmt = playerWinAmounts.get(p.id) || 0;
      const isWin = winAmt > 0;
      const evaluated = activeContenders.find((c) => c.id === p.id);
      return {
        ...p,
        chips: isWin ? Number((p.chips + winAmt).toFixed(2)) : p.chips,
        isWinner: isWin,
        winAmount: isWin ? winAmt : 0,
        handRankName: evaluated?.handRankName,
        bestFiveCards: evaluated?.bestFiveCards,
      };
    });

    const winningCards = winningPlayersList[0]?.bestFiveCards || [];
    const winnerNames = winningPlayersList.map((w) => w.name).join(' & ');
    const winnerHandName = winningPlayersList[0]?.handRankName || 'High Card';

    setWinnerBanner({
      name: winnerNames,
      amount: totalNetDistributed,
      totalPot: finalState.pot,
      rakeAmount: totalRakeCollected,
      handName: winnerHandName,
    });

    // Record Table Rake to Firestore & Admin Panel System
    if (totalRakeCollected > 0) {
      recordTableRake({
        tableId: finalState.id,
        tableName: finalState.name,
        gameType: finalState.gameType,
        handNumber: finalState.handNumber,
        totalPot: finalState.pot,
        rakePercent: 10,
        rakeAmount: totalRakeCollected,
        netPotWon: totalNetDistributed,
        winnerName: winnerNames,
        winnerAvatar: winningPlayersList[0]?.avatar,
        timestamp: Date.now(),
      });
    }

    if (winningPlayersList.some((w) => w.isHuman)) {
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
    }

    // Compile and finalize player action logs for the session stats
    const finalLogs: Record<string, PlayerHandActionLog> = { ...currentHandActionTrackingRef.current };
    for (const p of finalState.players) {
      if (!p) continue;
      const log = finalLogs[p.id];
      if (log) {
        const winAmt = playerWinAmounts.get(p.id) || 0;
        log.invested = p.totalRoundBet;
        log.wonAmount = winAmt;
        log.profit = Number((winAmt - p.totalRoundBet).toFixed(2));
        log.isWinner = winAmt > 0;
        log.cards = p.cards;
      }
    }

    // Save to Hand History with full player action logs
    const historyEntry: HandHistoryRecord = {
      id: `h_${Date.now()}_${finalState.handNumber}`,
      handNumber: finalState.handNumber,
      tableName: finalState.name,
      gameType: finalState.gameType,
      blinds: `$${finalState.smallBlind}/$${finalState.bigBlind}`,
      pot: finalState.pot,
      rake: totalRakeCollected,
      netPot: totalNetDistributed,
      communityCards: finalState.communityCards,
      winners: winningPlayersList.map((w) => ({
        name: w.name,
        avatar: w.avatar,
        amount: playerWinAmounts.get(w.id) || 0,
        handName: w.handRankName || winnerHandName,
        cards: w.cards,
      })),
      playerCards: humanPlayer ? humanPlayer.cards : [],
      playerProfit: winningPlayersList.some((w) => w.isHuman)
        ? Number(((playerWinAmounts.get(currentUser.id) || 0) - (humanPlayer?.totalRoundBet || 0)).toFixed(2))
        : Number((-(humanPlayer?.totalRoundBet || 0)).toFixed(2)),
      playerActionLogs: finalLogs,
      timestamp: Date.now(),
    };
    setHandHistory((prev) => [historyEntry, ...prev.slice(0, 49)]);

    // Schedule next hand in 4 seconds (Orchestrator only)
    if (isTableOrchestrator) {
      if (nextHandTimeoutRef.current) clearTimeout(nextHandTimeoutRef.current);
      nextHandTimeoutRef.current = setTimeout(() => {
        startNextHand();
      }, 4000);
    }

    return {
      ...finalState,
      stage: 'hand_ended',
      players: updatedPlayers,
      handWinners: winningPlayersList.map((w) => ({
        playerId: w.id,
        amount: playerWinAmounts.get(w.id) || 0,
        handName: w.handRankName || winnerHandName,
        winningCards: w.bestFiveCards || winningCards,
      })),
    };
  };

  // Sole winner when everyone folds
  const endHandWithSoleWinner = (
    prevTable: PokerTableState,
    players: (Player | null)[],
    winner: Player,
    finalPot: number
  ): PokerTableState => {
    soundManager.playWinSound();

    // 1. Process uncalled bet refunds if the sole winner bet more than any folded opponent
    const refundRes = refundUncalledBets(players, finalPot, prevTable.currentHighBet);
    const contestedPot = refundRes.updatedPot;

    // Calculate 10% Table Rake on contested pot only & Net Pot
    const rakePercent = 10;
    const rakeAmount = Number((contestedPot * 0.10).toFixed(2));
    const netPot = Number(Math.max(0, contestedPot - rakeAmount).toFixed(2));

    const updatedPlayers = refundRes.updatedPlayers.map((p) => {
      if (!p) return null;
      if (p.id === winner.id) {
        return {
          ...p,
          chips: Number((p.chips + netPot).toFixed(2)),
          isWinner: true,
          winAmount: netPot,
        };
      }
      return p;
    });

    setWinnerBanner({
      name: winner.name,
      amount: netPot,
      totalPot: contestedPot,
      rakeAmount,
      handName: lang === 'az' ? 'Rəqiblər fold etdi' : 'Everyone folded',
    });

    // Record 10% Table Rake to Firestore & Admin Panel System
    if (rakeAmount > 0) {
      recordTableRake({
        tableId: prevTable.id,
        tableName: prevTable.name,
        gameType: prevTable.gameType,
        handNumber: prevTable.handNumber,
        totalPot: contestedPot,
        rakePercent: 10,
        rakeAmount,
        netPotWon: netPot,
        winnerName: winner.name,
        winnerAvatar: winner.avatar,
        timestamp: Date.now(),
      });
    }

    if (winner.id === currentUser.id) {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.5 } });
    }

    // Compile and finalize player action logs for the foldout hand
    const finalLogs: Record<string, PlayerHandActionLog> = { ...currentHandActionTrackingRef.current };
    for (const p of players) {
      if (!p) continue;
      const log = finalLogs[p.id];
      if (log) {
        const isWin = p.id === winner.id;
        const winAmt = isWin ? netPot : 0;
        log.invested = p.totalRoundBet;
        log.wonAmount = winAmt;
        log.profit = Number((winAmt - p.totalRoundBet).toFixed(2));
        log.isWinner = isWin;
        log.cards = p.cards;
      }
    }

    // Save to Hand History with full player action logs
    const historyEntry: HandHistoryRecord = {
      id: `h_${Date.now()}_${prevTable.handNumber}`,
      handNumber: prevTable.handNumber,
      tableName: prevTable.name,
      gameType: prevTable.gameType,
      blinds: `$${prevTable.smallBlind}/$${prevTable.bigBlind}`,
      pot: contestedPot,
      rake: rakeAmount,
      netPot,
      communityCards: prevTable.communityCards,
      winners: [
        {
          name: winner.name,
          avatar: winner.avatar,
          amount: netPot,
          handName: lang === 'az' ? 'Rəqiblər fold etdi' : 'Everyone folded',
          cards: winner.cards,
        },
      ],
      playerCards: humanPlayer ? humanPlayer.cards : [],
      playerProfit: winner.id === currentUser.id
        ? Number((netPot - (humanPlayer?.totalRoundBet || 0)).toFixed(2))
        : Number((-(humanPlayer?.totalRoundBet || 0)).toFixed(2)),
      playerActionLogs: finalLogs,
      timestamp: Date.now(),
    };
    setHandHistory((prev) => [historyEntry, ...prev.slice(0, 49)]);

    // Schedule next hand in 4 seconds (Orchestrator only)
    if (isTableOrchestrator) {
      if (nextHandTimeoutRef.current) clearTimeout(nextHandTimeoutRef.current);
      nextHandTimeoutRef.current = setTimeout(() => {
        startNextHand();
      }, 4000);
    }

    return {
      ...prevTable,
      pot: contestedPot,
      stage: 'hand_ended',
      players: updatedPlayers,
      handWinners: [
        {
          playerId: winner.id,
          amount: netPot,
          handName: lang === 'az' ? 'Bütün oyunçular çəkildi' : 'All folded',
          winningCards: [],
        },
      ],
    };
  };

  // Start Next Hand (shuffles new deck, moves button, deals hole cards, posts SB/BB)
  const startNextHand = () => {
    setWinnerBanner(null);
    setHandsPlayedCount((prev) => prev + 1);
    soundManager.playCardDeal();

    setTable((prevTable) => {
      const deck = createDeck(prevTable.gameType);
      const totalSeats = prevTable.players.length;

      // 1. Process Player Lifecycles: Auto-eject players whose chips ran out & Bot Session checks
      const candidatePlayers: (Player | null)[] = [];
      const messagesToAdd: string[] = [];

      for (let idx = 0; idx < totalSeats; idx++) {
        const p = prevTable.players[idx];
        if (!p) {
          candidatePlayers.push(null);
          continue;
        }

        // Human Player Chip Check: Auto-Rebuy if chips drop below 20 BBs & Eject if balance depleted
        if (p.isHuman) {
          // Auto-Rebuy Feature: replenish to starting buy-in amount if chips drop below 20 Big Blinds
          if (p.id === currentUser.id && autoRebuy && p.chips < prevTable.bigBlind * 20 && !p.isSittingOut && !sitOutNextHand) {
            const targetStartingChips = p.initialChips && p.initialChips > 0 ? p.initialChips : prevTable.bigBlind * 50;
            const boundedTarget = Math.min(prevTable.maxBuyIn, Math.max(prevTable.minBuyIn, targetStartingChips));
            const neededChips = Number((boundedTarget - p.chips).toFixed(2));

            if (neededChips > 0) {
              const isBonus = isPlayerUsingBonus;
              const sourceBalance = isBonus ? userBonusBalance : userRealBalance;

              if (sourceBalance > 0) {
                const reloadAmount = Number(Math.min(neededChips, sourceBalance).toFixed(2));
                if (reloadAmount > 0) {
                  let newBonus = userBonusBalance;
                  let newReal = userRealBalance;

                  if (isBonus) {
                    newBonus = Number(Math.max(0, newBonus - reloadAmount).toFixed(2));
                  } else {
                    newReal = Number(Math.max(0, newReal - reloadAmount).toFixed(2));
                  }

                  onUpdateUserBalance(newReal, currentUser.playMoneyBalance, newBonus);
                  p.chips = Number((p.chips + reloadAmount).toFixed(2));
                  soundManager.playChipSound();

                  messagesToAdd.push(
                    lang === 'az'
                      ? `🔄 Auto-Rebuy: Çipləriniz 20 BB-dən aşağı düşdüyü üçün masaya +$${reloadAmount.toFixed(2)} əlavə olundu (Cari çiplər: $${p.chips.toFixed(2)}).`
                      : `🔄 Auto-Rebuy: Chips dropped below 20 BB, replenished +$${reloadAmount.toFixed(2)} back to starting buy-in (Total chips: $${p.chips.toFixed(2)}).`
                  );
                }
              }
            }
          }

          if (p.chips < prevTable.smallBlind || p.chips <= 0) {
            if (p.id === currentUser.id && p.chips > 0) {
              if (isPlayerUsingBonus) {
                onUpdateUserBalance(
                  currentUser.realBalance,
                  currentUser.playMoneyBalance,
                  Number(((currentUser.bonusBalance || 0) + p.chips).toFixed(2))
                );
              } else {
                onUpdateUserBalance(
                  Number((currentUser.realBalance + p.chips).toFixed(2)),
                  currentUser.playMoneyBalance,
                  currentUser.bonusBalance
                );
              }
            }
            messagesToAdd.push(
              lang === 'az'
                ? `⚠️ Masadakı bütün çipləriniz bitdi ($0.00)! Masadan avtomatik çıxarıldınız.`
                : `⚠️ All your table chips have run out ($0.00)! You were automatically removed from the seat.`
            );
            soundManager.playFoldSound();
            candidatePlayers.push(null);
            continue;
          }
          candidatePlayers.push(p);
          continue;
        }

        // Bot Checks:
        // 0. Master Deactivation Check: If bots are deactivated globally by admin, remove all bots immediately!
        if (botConfig.isBotsActive !== true) {
          candidatePlayers.push(null);
          continue;
        }

        // A. Session Duration (2 mins to 120 mins)
        const botJoinedAt = p.joinedAt || Date.now();
        const durationMinutes = p.sessionDurationMinutes || 15;
        const sessionMs = durationMinutes * 60 * 1000;
        const hasSessionExpired = Date.now() - botJoinedAt >= sessionMs;

        if (hasSessionExpired) {
          messagesToAdd.push(
            lang === 'az'
              ? `🚪 ${p.name} masadan ayrıldı (oyun vaxtı tamamlandı).`
              : `🚪 ${p.name} left the table (session completed).`
          );
          candidatePlayers.push(null);
          continue;
        }

        // B. Bust / Depleted Chips Check: If chips ran out, auto remove from table
        if (p.chips < prevTable.smallBlind || p.chips <= 0) {
          messagesToAdd.push(
            lang === 'az'
              ? `👋 ${p.name} masa pulu qurtardığı üçün masadan avtomatik çıxarıldı.`
              : `👋 ${p.name} ran out of table money and was removed from the table.`
          );
          candidatePlayers.push(null);
          continue;
        } else if (p.chips < prevTable.bigBlind * 2) {
          if (p.willRebuyOnBust) {
            // Rebuy chips to 50-100 BBs and continue!
            const reloadChips = Number((prevTable.bigBlind * (50 + Math.floor(Math.random() * 50))).toFixed(2));
            messagesToAdd.push(
              lang === 'az'
                ? `💰 ${p.name} balansını əlavə edərək oyuna davam edir (+$${reloadChips.toLocaleString()})`
                : `💰 ${p.name} reloaded balance and continues playing (+$${reloadChips.toLocaleString()})`
            );
            candidatePlayers.push({
              ...p,
              chips: reloadChips,
            });
          } else {
            // Leave table on low chips!
            messagesToAdd.push(
              lang === 'az'
                ? `👋 ${p.name} masa pulu qurtardığı üçün masadan avtomatik çıxarıldı.`
                : `👋 ${p.name} ran out of table chips and left the table.`
            );
            candidatePlayers.push(null);
            continue;
          }
        } else {
          candidatePlayers.push(p);
        }
      }

      // Dynamically auto-fill empty seats with new AI Bots if occupancy drops below target AND bots are active
      if (botConfig.isBotsActive === true && botConfig.autoJoinLeaveEnabled === true) {
        const targetCount = botConfig.targetTableOccupancy || 4;
        let currentOccupancy = candidatePlayers.filter((p) => p !== null).length;
        if (currentOccupancy < targetCount) {
          for (let sIdx = 0; sIdx < totalSeats && currentOccupancy < targetCount; sIdx++) {
            if (!candidatePlayers[sIdx]) {
              const newBot = createBotPlayer(
                sIdx,
                prevTable.id,
                prevTable.bigBlind,
                prevTable.gameType,
                undefined,
                undefined,
                candidatePlayers
              );
              candidatePlayers[sIdx] = newBot;
              currentOccupancy++;
              messagesToAdd.push(
                lang === 'az'
                  ? `👋 ${newBot.name} masaya qoşuldu.`
                  : `👋 ${newBot.name} joined the table.`
              );
            }
          }
        }
      }

      if (messagesToAdd.length > 0) {
        setChatMessages((prev) => [
          ...prev,
          ...messagesToAdd.map((txt, mIdx) => ({
            id: `sys_bot_cycle_${Date.now()}_${mIdx}`,
            senderName: 'System',
            senderAvatar: '',
            text: txt,
            timestamp: Date.now(),
            isSystem: true,
          })),
        ]);
      }

      // Identify active non-sitting-out players from remaining candidate players
      const activeSeatIndices: number[] = [];
      candidatePlayers.forEach((p, idx) => {
        if (p && !p.isSittingOut && !(p.isHuman && sitOutNextHand)) {
          activeSeatIndices.push(idx);
        }
      });

      // If less than 2 active players, wait for more players/bots
      if (activeSeatIndices.length < 2) {
        return {
          ...prevTable,
          stage: 'waiting',
          players: candidatePlayers,
          communityCards: [],
          deck,
          pot: 0,
          currentHighBet: 0,
        };
      }

      // Rotate Dealer Button to next active player
      let nextDealer = (prevTable.dealerSeatIndex + 1) % totalSeats;
      while (!candidatePlayers[nextDealer] || candidatePlayers[nextDealer]?.isSittingOut || (candidatePlayers[nextDealer]?.isHuman && sitOutNextHand)) {
        nextDealer = (nextDealer + 1) % totalSeats;
      }

      let sbSeat: number;
      let bbSeat: number;
      let utgSeat: number;

      if (activeSeatIndices.length === 2) {
        // Heads-up poker rules: Dealer is SB and acts first preflop; other player is BB
        sbSeat = nextDealer;
        bbSeat = activeSeatIndices.find((idx) => idx !== nextDealer)!;
        utgSeat = sbSeat; // SB acts first preflop in Heads-up
      } else {
        // Multi-way (3+ players):
        sbSeat = getNextActiveSeat(candidatePlayers, nextDealer);
        bbSeat = getNextActiveSeat(candidatePlayers, sbSeat);
        utgSeat = getNextActiveSeat(candidatePlayers, bbSeat);
      }

      const rawSbAmount = candidatePlayers[sbSeat]?.chips || 0;
      const rawBbAmount = candidatePlayers[bbSeat]?.chips || 0;
      const sbAmount = Number(Math.min(prevTable.smallBlind, rawSbAmount).toFixed(2));
      const bbAmount = Number(Math.min(prevTable.bigBlind, rawBbAmount).toFixed(2));

      const cardsPerPlayer = prevTable.gameType === 'omaha_plo' ? 4 : 2;

      // Deal hole cards to active players
      const newPlayers = candidatePlayers.map((p, idx) => {
        if (!p) return null;
        if (p.isSittingOut || (p.isHuman && sitOutNextHand)) {
          return {
            ...p,
            isSittingOut: true,
            cards: [],
            currentBet: 0,
            totalRoundBet: 0,
            isFolded: true,
            isAllIn: false,
            isWinner: false,
            winAmount: 0,
            handRankName: undefined,
            bestFiveCards: undefined,
            lastAction: undefined,
          };
        }

        const currentChips = p.chips;
        const dealtCards: Card[] = [];
        for (let i = 0; i < cardsPerPlayer; i++) {
          dealtCards.push(deck.pop()!);
        }

        let bet = 0;
        if (idx === sbSeat) bet = sbAmount;
        if (idx === bbSeat) bet = bbAmount;

        const remainingChips = Number(Math.max(0, currentChips - bet).toFixed(2));

        return {
          ...p,
          isSittingOut: false,
          chips: remainingChips,
          currentBet: bet,
          totalRoundBet: bet,
          cards: dealtCards,
          isFolded: false,
          isAllIn: remainingChips === 0,
          isWinner: false,
          winAmount: 0,
          handRankName: undefined,
          bestFiveCards: undefined,
          lastAction: idx === sbSeat ? { type: 'bet' as const, amount: sbAmount, timestamp: Date.now() } :
                      idx === bbSeat ? { type: 'bet' as const, amount: bbAmount, timestamp: Date.now() } : undefined,
        };
      });

      const initialPot = Number((sbAmount + bbAmount).toFixed(2));

      // Initialize real-time player action tracking logs for this new hand
      const newHandLogs: Record<string, PlayerHandActionLog> = {};
      newPlayers.forEach((p, idx) => {
        if (!p || p.isSittingOut) return;
        newHandLogs[p.id] = {
          playerId: p.id,
          playerName: p.name,
          avatar: p.avatar,
          isHuman: p.isHuman,
          seatIndex: idx,
          isSmallBlind: idx === sbSeat,
          isBigBlind: idx === bbSeat,
          vpip: false,
          pfr: false,
          flopBets: 0,
          flopRaises: 0,
          flopCalls: 0,
          flopChecks: 0,
          turnBets: 0,
          turnRaises: 0,
          turnCalls: 0,
          turnChecks: 0,
          riverBets: 0,
          riverRaises: 0,
          riverCalls: 0,
          riverChecks: 0,
          sawFlop: false,
          sawTurn: false,
          sawRiver: false,
          sawShowdown: false,
          invested: p.currentBet || 0,
          wonAmount: 0,
          profit: 0,
          isWinner: false,
          cards: p.cards,
        };
      });
      currentHandActionTrackingRef.current = newHandLogs;

      const newHandState: PokerTableState = {
        ...prevTable,
        stage: 'preflop',
        pot: initialPot,
        sidePots: [],
        communityCards: [],
        deck,
        handNumber: prevTable.handNumber + 1,
        dealerSeatIndex: nextDealer,
        smallBlindSeatIndex: sbSeat,
        bigBlindSeatIndex: bbSeat,
        currentHighBet: prevTable.bigBlind,
        minRaise: prevTable.bigBlind,
        currentTurnSeatIndex: utgSeat,
        players: newPlayers,
        handWinners: [],
      };

      broadcastTableState(newHandState);
      return newHandState;
    });
  };

  // Rejoin table from sitting out
  const handleJoinTable = () => {
    soundManager.playButtonClick();
    setSitOutNextHand(false);
    if (humanPlayer) {
      setTable((prev) => {
        const players = [...prev.players];
        const p = players[humanSeatIndex];
        if (p) {
          players[humanSeatIndex] = {
            ...p,
            isSittingOut: false,
            consecutiveMissedTurns: 0,
          };
        }
        const updated = { ...prev, players };
        broadcastTableState(updated);
        return updated;
      });

      const rejoinText = lang === 'az'
        ? '✅ Masaya yenidən qatıldınız! Növbəti əldə kartlar paylanacaq.'
        : '✅ You have rejoined the table! You will receive cards on the next deal.';
      const rejoinMsg: ChatMessage = {
        id: `sys_rejoin_${Date.now()}`,
        tableId: table.id,
        senderId: 'system',
        senderName: 'Dealer',
        senderAvatar: '',
        text: rejoinText,
        message: rejoinText,
        timestamp: Date.now(),
        isSystem: true,
      };
      setChatMessages((prev) => [...prev, rejoinMsg]);
      sendTableChatMessageSocket(table.id, rejoinMsg);
      sendTableChatMessage(table.id, rejoinMsg);
    }
  };

  // Rebuy chips with Real + Bonus balance support
  const handleRebuy = () => {
    soundManager.playChipSound();
    if (humanPlayer) {
      const isBonus = isPlayerUsingBonus;
      const sourceBalance = isBonus ? userBonusBalance : userRealBalance;

      if (sourceBalance < rebuyAmount) {
        soundManager.playButtonClick();
        setChatMessages((prev) => [
          ...prev,
          {
            id: `sys_rebuy_err_${Date.now()}`,
            senderName: 'System',
            senderAvatar: '',
            text: lang === 'az'
              ? (isBonus ? '⚠️ Bonus balansınızda kifayət qədər vəsait yoxdur.' : '⚠️ Real balansınızda kifayət qədər vəsait yoxdur.')
              : '⚠️ Insufficient balance for rebuy.',
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
        return;
      }

      let newBonus = userBonusBalance;
      let newReal = userRealBalance;

      if (isBonus) {
        newBonus = Number(Math.max(0, newBonus - rebuyAmount).toFixed(2));
      } else {
        newReal = Number(Math.max(0, newReal - rebuyAmount).toFixed(2));
      }

      onUpdateUserBalance(newReal, currentUser.playMoneyBalance, newBonus);

      setTable((prev) => {
        const players = [...prev.players];
        players[humanSeatIndex] = {
          ...humanPlayer,
          chips: Number((humanPlayer.chips + rebuyAmount).toFixed(2)),
        };
        return { ...prev, players };
      });
      setShowRebuyModal(false);
    }
  };

  // Seat Selection & Buy-In Handler (Supports Real + Bonus balance)
  const handleEmptySeatClick = (seatIdx: number) => {
    if (humanPlayer) return; // already seated
    soundManager.playButtonClick();
    setSelectedSeatIndex(seatIdx);

    // Default to bonus if real balance is zero
    const preferredSource = userRealBalance <= 0 && userBonusBalance > 0 ? 'bonus' : (userRealBalance > 0 ? 'real' : 'bonus');
    setBuyInFundingSource(preferredSource);

    const sourceBalance = preferredSource === 'bonus' ? userBonusBalance : userRealBalance;
    const minAmount = table.minBuyIn;
    const maxAmount = Math.min(table.maxBuyIn, sourceBalance > 0 ? sourceBalance : table.maxBuyIn);
    const recommendedAmount = Math.min(
      maxAmount,
      Math.max(minAmount, table.bigBlind * 50)
    );

    setBuyInAmount(recommendedAmount > 0 ? recommendedAmount : minAmount);
    setShowBuyInModal(true);
  };

  // Confirm Buy-In and Take Seat
  const handleConfirmBuyIn = () => {
    if (selectedSeatIndex === null) return;

    const isBonusFunding = buyInFundingSource === 'bonus';
    const sourceBalance = isBonusFunding ? userBonusBalance : userRealBalance;

    if (sourceBalance < buyInAmount) {
      soundManager.playButtonClick();
      setChatMessages((prev) => [
        ...prev,
        {
          id: `sys_err_${Date.now()}`,
          senderName: 'System',
          senderAvatar: '',
          text: lang === 'az'
            ? (isBonusFunding
                ? '⚠️ Bonus balansınızda kifayət qədər vəsait yoxdur!'
                : '⚠️ Real balansınızda kifayət qədər vəsait yoxdur! Zəhmət olmasa Kassir bölməsindən depozit edin.')
            : '⚠️ Insufficient balance for buy-in!',
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
      return;
    }

    soundManager.playChipSound();
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });

    setIsPlayerUsingBonus(isBonusFunding);

    let newBonus = userBonusBalance;
    let newReal = userRealBalance;

    if (isBonusFunding) {
      newBonus = Number(Math.max(0, newBonus - buyInAmount).toFixed(2));
    } else {
      newReal = Number(Math.max(0, newReal - buyInAmount).toFixed(2));
    }

    onUpdateUserBalance(newReal, currentUser.playMoneyBalance, newBonus);

    const isMidHand = table.stage !== 'waiting' && table.stage !== 'hand_ended';

    setTable((prev) => {
      const updatedPlayers = [...prev.players];
      const newHumanPlayer: Player = {
        id: currentUser.id,
        name: currentUser.username,
        avatar: currentUser.avatar,
        chips: buyInAmount,
        initialChips: buyInAmount,
        currentBet: 0,
        totalRoundBet: 0,
        cards: [],
        isFolded: false,
        isAllIn: false,
        isSittingOut: isMidHand, // If hand is ongoing, wait until next hand
        isDisconnected: false,
        isHuman: true,
        seatIndex: selectedSeatIndex,
        vipLevel: currentUser.vipLevel || 1,
        vipXp: currentUser.vipXp || 0,
        selectedAvatarFrame: currentUser.selectedAvatarFrame || 'default',
        joinedAt: Date.now(),
      };
      updatedPlayers[selectedSeatIndex] = newHumanPlayer;

      const updated = {
        ...prev,
        players: updatedPlayers,
      };
      broadcastTableState(updated);
      joinTableSeatInFirestoreAtomic(prev.id, selectedSeatIndex, newHumanPlayer, updated);
      return updated;
    });

    setShowBuyInModal(false);

    const seatText = isMidHand
      ? (lang === 'az'
          ? `🎉 ${currentUser.username} masaya oturdu ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})!`
          : `🎉 ${currentUser.username} sat down ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})!`)
      : (lang === 'az'
          ? `🎉 ${currentUser.username} masaya oturdu ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})! Oyun başlayır.`
          : `🎉 ${currentUser.username} sat down ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})! Game starts.`);

    const seatMessage: ChatMessage = {
      id: `sys_seat_${Date.now()}`,
      tableId: table.id,
      senderId: currentUser.id || 'system',
      senderName: 'System',
      senderAvatar: '',
      text: seatText,
      message: seatText,
      timestamp: Date.now(),
      isSystem: true,
    };

    setChatMessages((prev) => [...prev, seatMessage]);
    sendTableChatMessageSocket(table.id, seatMessage);
    sendTableChatMessage(table.id, seatMessage);
  };

  // Exit Table & Cash Out remaining chips to real/bonus balance
  const handleExitTable = () => {
    soundManager.playButtonClick();

    const playerToExit = table.players.find((p) => p && p.id === currentUser.id);
    const uncommittedChips = playerToExit ? Number(Math.max(0, playerToExit.chips).toFixed(2)) : 0;

    // Return ONLY remaining uncommitted table chips to user wallet
    if (playerToExit && uncommittedChips > 0) {
      if (isPlayerUsingBonus) {
        onUpdateUserBalance(
          currentUser.realBalance,
          currentUser.playMoneyBalance,
          Number(((currentUser.bonusBalance || 0) + uncommittedChips).toFixed(2))
        );
      } else {
        onUpdateUserBalance(
          Number((currentUser.realBalance + uncommittedChips).toFixed(2)),
          currentUser.playMoneyBalance,
          currentUser.bonusBalance
        );
      }
    }

    // Unseat player from table in Firestore and resolve hand cleanly if in progress
    if (playerToExit) {
      const exitSeatIndex = playerToExit.seatIndex;
      const updatedPlayers = [...table.players];
      updatedPlayers[exitSeatIndex] = null;

      let nextTableState: PokerTableState;
      const isMidHand = table.stage !== 'waiting' && table.stage !== 'hand_ended';

      if (isMidHand) {
        const remainingContenders = updatedPlayers.filter(
          (p): p is Player => p !== null && !p.isFolded && !p.isSittingOut
        );

        if (remainingContenders.length === 1) {
          // Sole remaining contender immediately wins the entire pot!
          nextTableState = endHandWithSoleWinner(table, updatedPlayers, remainingContenders[0], table.pot);
        } else if (remainingContenders.length > 1) {
          let nextTurn = table.currentTurnSeatIndex;
          if (nextTurn === exitSeatIndex) {
            nextTurn = getNextActiveSeat(updatedPlayers, exitSeatIndex);
          }
          nextTableState = {
            ...table,
            players: updatedPlayers,
            currentTurnSeatIndex: nextTurn,
          };
        } else {
          nextTableState = {
            ...table,
            stage: 'waiting',
            players: updatedPlayers,
            pot: 0,
            communityCards: [],
            handWinners: [],
          };
        }
      } else {
        const seatedCount = updatedPlayers.filter((p) => p !== null).length;
        nextTableState = {
          ...table,
          players: updatedPlayers,
          stage: seatedCount < 2 ? 'waiting' : table.stage,
        };
      }

      setTable(nextTableState);
      broadcastTableState(nextTableState);
      emitPlayerLeaveSocket(table.id, currentUser.id, exitSeatIndex);
      leaveTableSeatInFirestoreAtomic(table.id, exitSeatIndex, currentUser.id, nextTableState);
      leaveTableSocket(table.id, currentUser.id, exitSeatIndex);

      const leaveText = lang === 'az'
        ? `🚪 ${currentUser.username} masadan ayrıldı (${uncommittedChips > 0 ? `$${uncommittedChips.toLocaleString()} balansa qaytarıldı` : 'bütün çiplərini uduzdu'}).`
        : `🚪 ${currentUser.username} left the table (${uncommittedChips > 0 ? `$${uncommittedChips.toLocaleString()} returned to balance` : 'lost all chips'}).`;
      const leaveMsg: ChatMessage = {
        id: `sys_leave_${Date.now()}`,
        tableId: table.id,
        senderId: currentUser.id || 'system',
        senderName: 'System',
        senderAvatar: '',
        text: leaveText,
        message: leaveText,
        timestamp: Date.now(),
        isSystem: true,
      };
      sendTableChatMessageSocket(table.id, leaveMsg);
      sendTableChatMessage(table.id, leaveMsg);
    }

    try {
      localStorage.removeItem('poker_active_table_id');
    } catch {}

    onLeaveTable();
  };

  // Send message in chat
  const handleSendMessage = (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const now = Date.now();
    const newMsg: ChatMessage = {
      id: `chat_${now}_${Math.random().toString(36).substring(2, 7)}`,
      tableId: table.id,
      senderId: currentUser.id || 'anonymous_player',
      senderName: currentUser.username || 'Player',
      senderAvatar: currentUser.avatar || '',
      text: trimmed,
      message: trimmed,
      timestamp: now,
      isSystem: false,
    };
    setChatMessages((prev) => [...prev, newMsg]);
    sendTableChatMessageSocket(table.id, newMsg);
    sendTableChatMessage(table.id, newMsg);
    triggerSpeechBubble(currentUser.username, trimmed);

    // Bot friendly replies with bilingual phrases
    if (Math.random() > 0.35) {
      setTimeout(() => {
        const botReplies = lang === 'az' ? [
          'Gözəl əl! 🔥',
          'Uğurlar hamıya! 🍀',
          'Yaxşı oyun! (GG) 👏',
          'Uff, bəxt gətirmədi...',
          'Poker həyat tərzidir 🃏',
          'Vamos! 🚀',
          'Təşəkkürlər! 🙏',
          'Çek yoxsa reyz?',
          'Əla blef idi! 😎',
        ] : [
          'Nice hand! 🔥',
          'Good luck all! 🍀',
          'Good game! (GG) 👏',
          'Uff, bad beat...',
          'Poker is life 🃏',
          'Vamos! 🚀',
          'Thank you! 🙏',
          'Check or raise?',
          'Nice bluff! 😎',
        ];
        const randomBot = table.players.find((p) => p && !p.isHuman);
        if (randomBot) {
          const botReplyText = botReplies[Math.floor(Math.random() * botReplies.length)];
          const botNow = Date.now();
          const botMsg: ChatMessage = {
            id: `b_chat_${botNow}_${Math.random().toString(36).substring(2, 7)}`,
            tableId: table.id,
            senderId: randomBot.id || `bot_${randomBot.seatIndex}`,
            senderName: randomBot.name || 'Bot',
            senderAvatar: randomBot.avatar || '',
            text: botReplyText,
            message: botReplyText,
            timestamp: botNow,
            isSystem: false,
          };
          setChatMessages((prev) => [...prev, botMsg]);
          sendTableChatMessageSocket(table.id, botMsg);
          sendTableChatMessage(table.id, botMsg);
          triggerSpeechBubble(randomBot.name, botReplyText);
        }
      }, 1400);
    }
  };

  // Floating Emoji reaction
  const handleSendEmoji = (emoji: string) => {
    const newEmoji: FloatingEmoji = {
      id: `emo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      seatIndex: humanSeatIndex,
      emoji,
      timestamp: Date.now(),
    };
    setFloatingEmojis((prev) => [...prev, newEmoji]);
    sendTableEmojiSocket(table.id, newEmoji);
    sendTableEmoji(table.id, newEmoji);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((e) => e.id !== newEmoji.id));
    }, 2500);
  };

  // Felt color theme styles
  const feltThemes = {
    emerald: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-800 via-emerald-900 to-emerald-950 border-emerald-700/80',
    sapphire: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-800 via-blue-900 to-slate-950 border-blue-700/80',
    crimson: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-900 via-red-950 to-zinc-950 border-rose-800/80',
    charcoal: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-900 to-black border-zinc-700/80',
  }[feltColor];

  // Mathematical Seat Coordinate Calculation for 2-max, 6-max, and 9-max oval table
  const getSeatCoordinates = (seatIdx: number, totalCapacity: number) => {
    // Offset so human player is always positioned centered at the bottom, or standard 0 if spectator
    const referenceIndex = humanSeatIndex >= 0 ? humanSeatIndex : 0;
    const relativeIndex = (seatIdx - referenceIndex + totalCapacity) % totalCapacity;

    if (totalCapacity === 2) {
      return relativeIndex === 0
        ? { left: '50%', top: '91%', transform: 'translate(-50%, -50%)' }
        : { left: '50%', top: '9%', transform: 'translate(-50%, -50%)' };
    }

    if (totalCapacity === 6) {
      const positions = [
        { left: '50%', top: '91%' }, // Bottom Center (Human)
        { left: '13%', top: '74%' }, // Bottom Left
        { left: '13%', top: '26%' }, // Top Left
        { left: '50%', top: '9%' },  // Top Center
        { left: '87%', top: '26%' }, // Top Right
        { left: '87%', top: '74%' }, // Bottom Right
      ];
      const p = positions[relativeIndex] || positions[0];
      return { ...p, transform: 'translate(-50%, -50%)' };
    }

    // 9-max positions
    const positions9 = [
      { left: '50%', top: '91%' }, // 0 (Human bottom)
      { left: '26%', top: '85%' }, // 1
      { left: '9%', top: '65%' },  // 2
      { left: '9%', top: '35%' },  // 3
      { left: '28%', top: '9%' },  // 4
      { left: '72%', top: '9%' },  // 5
      { left: '91%', top: '35%' }, // 6
      { left: '91%', top: '65%' }, // 7
      { left: '74%', top: '85%' }, // 8
    ];
    const p = positions9[relativeIndex] || positions9[0];
    return { ...p, transform: 'translate(-50%, -50%)' };
  };

  return (
    <div className="relative w-full max-w-full h-[calc(100dvh-54px)] max-h-[calc(100dvh-54px)] bg-zinc-950 flex flex-col justify-between overflow-hidden select-none px-2 py-1 sm:px-3 sm:py-1.5">
      {/* Left Slide-out Drawer (Matching 00:08 in video) */}
      <AnimatePresence>
        {isLeftDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeftDrawerOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Slide-out Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-72 max-w-[85vw] h-full bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between z-10 shadow-2xl p-4 text-zinc-200"
            >
              <div className="space-y-4">
                {/* Header in Drawer */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-zinc-950 font-black shadow">
                      ♠
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white tracking-wide">POKER ARENA</h3>
                      <p className="text-[10px] text-amber-400/80 font-mono font-bold">
                        {table.name} (${table.smallBlind}/${table.bigBlind})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsLeftDrawerOpen(false)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items in Drawer (Exact items from video 00:08) */}
                <nav className="space-y-1.5">
                  {/* 1. Masanı tərk et */}
                  <button
                    onClick={() => {
                      setIsLeftDrawerOpen(false);
                      handleExitTable();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      <LogOut className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold">{lang === 'az' ? 'Masanı tərk et' : 'Leave table'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                  </button>

                  {/* 2. Lobbiyə */}
                  <button
                    onClick={() => {
                      setIsLeftDrawerOpen(false);
                      onLeaveTable();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      <Home className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold">{lang === 'az' ? 'Lobbiyə' : 'To Lobby'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                  </button>

                  {/* 3. Parametrlər */}
                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        setIsLeftDrawerOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3">
                        <Settings className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
                        <span className="text-xs font-semibold">{lang === 'az' ? 'Parametrlər' : 'Settings'}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                    </button>
                  )}

                  {/* 4. Paylamalarım (Hand History / Stats) */}
                  <button
                    onClick={() => {
                      setIsLeftDrawerOpen(false);
                      setShowStatsModal(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      <History className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold">{lang === 'az' ? 'Paylamalarım (Statistika)' : 'My Hands (Stats)'}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                  </button>

                  {/* 5. Poker qaydaları */}
                  {onOpenHandRankings && (
                    <button
                      onClick={() => {
                        setIsLeftDrawerOpen(false);
                        onOpenHandRankings();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3">
                        <BookOpen className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold">{lang === 'az' ? 'Poker qaydaları' : 'Poker rules'}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                    </button>
                  )}

                  {/* 6. Dəstək */}
                  {onOpenSupport && (
                    <button
                      onClick={() => {
                        setIsLeftDrawerOpen(false);
                        onOpenSupport();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 text-zinc-300 hover:text-white transition-all cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold">{lang === 'az' ? 'Dəstək' : 'Support'}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                    </button>
                  )}
                </nav>
              </div>

              {/* User Balance Footer in Drawer */}
              <div className="border-t border-zinc-800/80 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-400 block">{lang === 'az' ? 'Hesab Balansı' : 'Account Balance'}</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">${totalUsableBalance.toFixed(2)}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={() => {
                      setIsLeftDrawerOpen(false);
                      handleExitTable();
                      onLogout();
                    }}
                    className="px-2 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-800/40 text-red-300 text-[11px] font-bold transition-all cursor-pointer"
                  >
                    {lang === 'az' ? 'Çıxış' : 'Logout'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Jackpot Modal */}
      <AnimatePresence>
        {showJackpotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowJackpotModal(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border-2 border-amber-500/80 rounded-3xl p-6 shadow-2xl z-10 text-center"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-300 flex items-center justify-center text-zinc-950 font-black text-2xl shadow-lg shadow-amber-500/40 animate-pulse">
                JP
              </div>
              <h3 className="text-lg font-black text-amber-300 mt-3 tracking-wide">
                BAD BEAT JACKPOT
              </h3>
              <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 font-mono my-2 drop-shadow">
                ${jackpotPool.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {lang === 'az'
                  ? 'Kare (Four of a Kind) və ya daha güclü əllə uduzan oyunçu və masa iştirakçıları Jackpot fondunu bölüşür!'
                  : 'Bad beat with Four of a Kind or better triggers the mega progressive Jackpot for the table!'}
              </p>
              <button
                onClick={() => setShowJackpotModal(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-black text-xs shadow-lg transition-all cursor-pointer"
              >
                {lang === 'az' ? 'Bağla' : 'Close'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Table Control Bar (Exact Video Layout: 00:00 - 00:20) */}
      <div className="flex items-center justify-between z-20 px-1 max-w-4xl mx-auto w-full h-10 shrink-0">
        {/* Left Side: Hamburger Menu & Multi-Table Tab Pill */}
        <div className="flex items-center space-x-2">
          {/* Hamburger Menu (Opens Left Drawer) */}
          <button
            onClick={() => {
              soundManager.playButtonClick();
              setIsLeftDrawerOpen(true);
            }}
            id="table_hamburger_menu_btn"
            title={lang === 'az' ? 'Masa Menyu' : 'Table Menu'}
            className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 hover:text-white transition-all shadow cursor-pointer active:scale-95 flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Table Tab Pill ([===] [+]) */}
          <div className="flex items-center bg-zinc-900/90 border border-zinc-800/90 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => {
                soundManager.playButtonClick();
                setShowStatsModal(true);
              }}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-zinc-800 text-zinc-200 text-xs font-semibold cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline font-bold">{table.name}</span>
              <span className="sm:hidden font-bold">#1</span>
            </button>
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onLeaveTable();
              }}
              title={lang === 'az' ? 'Yeni Masa Aç' : 'Add Table'}
              className="px-2 py-1 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-md transition-colors cursor-pointer text-sm font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Right Side: JP Badge, Refresh Table, Settings, Social/Chat */}
        <div className="flex items-center space-x-1.5">
          {/* JP (Jackpot) Coin Badge */}
          <button
            onClick={() => {
              soundManager.playButtonClick();
              setShowJackpotModal(true);
            }}
            id="table_jp_badge_btn"
            title={lang === 'az' ? 'Jackpot Fondu: $14,250.75' : 'Jackpot Pool: $14,250.75'}
            className="flex items-center space-x-1 px-2 py-1 rounded-full bg-gradient-to-r from-amber-600/30 to-yellow-500/20 border border-amber-500/50 hover:border-amber-400 text-amber-300 text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-zinc-950 font-black text-[9px] flex items-center justify-center shadow">
              JP
            </div>
            <span className="font-mono text-[11px] hidden sm:inline">${(jackpotPool / 1000).toFixed(1)}k</span>
          </button>

          {/* Table Refresh Button */}
          <button
            onClick={handleManualTableRefresh}
            id="table_refresh_btn"
            title={lang === 'az' ? 'Masanı yenilə' : 'Refresh Table'}
            className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all shadow cursor-pointer active:scale-95"
          >
            <RotateCw className={`w-4 h-4 ${isRefreshingTable ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Table Settings Modal Button */}
          {onOpenSettings && (
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onOpenSettings();
              }}
              id="table_settings_btn"
              title={lang === 'az' ? 'Masa Parametrləri' : 'Settings'}
              className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all shadow cursor-pointer active:scale-95"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Chat / Room Share Button */}
          <button
            onClick={handleShareRoomLink}
            id="table_share_btn"
            title={lang === 'az' ? 'Masa Linkini Kopyala' : 'Share Table'}
            className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-all shadow cursor-pointer active:scale-95"
          >
            {copiedRoomToast ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Stadium Poker Table Canvas (Matching Video: 00:00 - 00:20) */}
      <div className="relative flex-1 flex items-center justify-center my-auto w-full max-w-4xl mx-auto px-1">
        {/* Outer Dark Wooden / Leather Padded Rail with Gold Trim */}
        <div className="relative w-full h-[320px] sm:h-[360px] md:h-[390px] lg:h-[410px] rounded-[150px] sm:rounded-[180px] md:rounded-[210px] bg-gradient-to-b from-zinc-900 via-black to-zinc-900 p-3 sm:p-4 shadow-[0_15px_50px_rgba(0,0,0,0.9)] border-4 border-amber-900/50 flex items-center justify-center">
          
          {/* Subtle Outer Rail Gold Inlay Line */}
          <div className="absolute inset-1 sm:inset-1.5 rounded-[144px] sm:rounded-[174px] md:rounded-[204px] border border-amber-500/20 pointer-events-none" />

          {/* Inner Deep Emerald Felt Area */}
          <div className={`relative w-full h-full rounded-[138px] sm:rounded-[168px] md:rounded-[198px] ${feltThemes} border-2 border-emerald-600/40 shadow-[inset_0_10px_35px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center overflow-hidden`}>
            
            {/* Table Watermark & Clean Betting Line */}
            <div className="absolute inset-4 sm:inset-7 rounded-[120px] sm:rounded-[150px] md:rounded-[180px] border border-white/10 pointer-events-none" />
            
            {/* Center Felt Markings (Matching Video: Hand #, Bank, Logo, Stakes) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0">
              {/* Hand #7996971 */}
              <div className="text-[10px] sm:text-xs font-mono font-bold text-white/40 tracking-wider mb-0.5">
                Hand #{table.handNumber ? 7990000 + table.handNumber : '7996971'}
              </div>

              {/* Bank: $ X (Center Pot Text Display) */}
              <div className="flex flex-col items-center my-0.5">
                <span className="text-[11px] sm:text-xs font-bold text-white/70 tracking-wide">
                  Bank:
                </span>
                <span className="text-base sm:text-lg font-black text-amber-300 font-mono tracking-tight drop-shadow">
                  ${table.pot.toLocaleString()}
                </span>
              </div>

              {/* Center PINCO / POKER ARENA Logo Watermark */}
              <div className="flex flex-col items-center my-1 opacity-25">
                <span className="text-2xl sm:text-3xl font-black text-red-500 tracking-wider">
                  PINCO
                </span>
                <span className="text-[8px] sm:text-[9px] font-black text-amber-300 bg-amber-950/80 px-2 py-0.2 rounded-full border border-amber-400/40 tracking-widest uppercase -mt-0.5">
                  POKER
                </span>
              </div>

              {/* Bottom Felt Table Info & Stakes */}
              <div className="text-[9px] sm:text-[10.5px] font-semibold text-white/40 tracking-wide mt-1 text-center">
                <span>{table.name || 'Legends Table #2'}</span>
                <span className="mx-1">•</span>
                <span>Hold'em No Limit Stakes: ${table.smallBlind} / ${table.bigBlind}</span>
              </div>
            </div>

            {/* Center Active Pot, Side Pots & Community Cards */}
            <div className="relative z-10 flex flex-col items-center justify-center space-y-1 mt-6 sm:mt-7">
              {/* Side pots if any */}
              {table.sidePots && table.sidePots.length > 0 && (
                <div className="flex items-center space-x-1.5">
                  {table.sidePots.map((sp, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-950/85 border border-blue-500/40 px-2 py-0.5 rounded-full text-[9px] font-bold text-blue-300 flex items-center space-x-1 backdrop-blur-sm shadow"
                    >
                      <span className="w-3 h-3 rounded-full bg-blue-500/30 text-blue-300 flex items-center justify-center text-[8px] font-bold">
                        ${idx + 1}
                      </span>
                      <span className="font-mono">${sp.amount}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 5 Community Cards (Flop, Turn, River) */}
              <div className="flex items-center space-x-1">
                {[0, 1, 2, 3, 4].map((index) => {
                  const card = table.communityCards[index];
                  const isWinningCard = table.handWinners.some((hw) =>
                    hw.winningCards?.some((wc) => wc.id === card?.id)
                  );

                  return (
                    <div
                      key={index}
                      className="w-7 h-10 sm:w-8 sm:h-11 md:w-9 md:h-12 rounded border border-white/20 bg-black/40 flex items-center justify-center shadow-lg transition-all"
                    >
                      {card ? (
                        <PlayingCard
                          card={card}
                          size="xs"
                          isFourColor={isFourColor}
                          isHighlighted={isWinningCard}
                          delay={index * 0.1}
                        />
                      ) : (
                        <div className="w-4 h-7 rounded border border-dashed border-white/10 opacity-20" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Winner Banner or Street Stage Indicator */}
              {winnerBanner ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center bg-zinc-950/95 border border-amber-400/90 px-3 py-1 rounded-xl shadow-2xl backdrop-blur-md z-20"
                >
                  <div className="flex items-center space-x-1.5">
                    <Crown className="w-3.5 h-3.5 text-yellow-400 animate-bounce" />
                    <span className="text-[11px] font-black text-amber-300">{winnerBanner.name}</span>
                    <span className="text-[11px] font-black text-emerald-400 font-mono">+${winnerBanner.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 text-[8.5px] text-zinc-300 mt-0.5">
                    <span>{winnerBanner.handName}</span>
                    {winnerBanner.rakeAmount !== undefined && winnerBanner.rakeAmount > 0 && (
                      <span className="text-amber-400 font-bold bg-amber-950/90 px-1 rounded border border-amber-500/40">
                        Rake: -${winnerBanner.rakeAmount.toFixed(2)}
                      </span>
                    )}
                    {nextHandCountdown !== null && (
                      <span className="text-amber-300 font-black bg-amber-500/25 border border-amber-400/60 px-1.5 rounded-full animate-pulse">
                        {lang === 'az' ? `${nextHandCountdown}s` : `${nextHandCountdown}s`}
                      </span>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="text-[9px] sm:text-[10px] font-bold text-white/70 tracking-wider uppercase bg-black/40 px-2.5 py-0.5 rounded-full flex items-center space-x-1.5 border border-white/10 backdrop-blur-sm">
                  <span>
                    {table.stage === 'preflop' && 'Pre-Flop'}
                    {table.stage === 'flop' && 'Flop'}
                    {table.stage === 'turn' && 'Turn'}
                    {table.stage === 'river' && 'River'}
                    {table.stage === 'showdown' && 'Showdown'}
                    {table.stage === 'hand_ended' && (lang === 'az' ? 'Əl bitdi' : 'Hand Ended')}
                  </span>
                  {table.stage === 'hand_ended' && nextHandCountdown !== null && (
                    <span className="text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.2 rounded-full border border-amber-500/40 animate-pulse text-[8.5px]">
                      {lang === 'az' ? `${nextHandCountdown}s sonra` : `In ${nextHandCountdown}s`}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Players & Empty Seat Nodes ON Table Rail */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {table.players.map((player, seatIdx) => {
              const coords = getSeatCoordinates(seatIdx, table.capacity);

              if (!player) {
                if (!humanPlayer) {
                  return (
                    <div
                      key={`empty_seat_${seatIdx}`}
                      style={{
                        position: 'absolute',
                        top: coords.top,
                        left: coords.left,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="flex flex-col items-center pointer-events-auto z-30"
                    >
                      {/* Empty Seat Gold Circle with Downward Arrow (Exact match to video: 00:00 - 00:20) */}
                      <button
                        type="button"
                        onClick={() => handleEmptySeatClick(seatIdx)}
                        id={`take_empty_seat_btn_${seatIdx}`}
                        title={lang === 'az' ? 'Oturmaq üçün klikləyin' : 'Click to sit'}
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-amber-500/80 bg-zinc-950/80 hover:bg-zinc-900 hover:border-amber-300 flex items-center justify-center text-amber-400 font-black text-xl sm:text-2xl shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:shadow-[0_0_20px_rgba(245,158,11,0.7)] transition-all transform hover:scale-110 active:scale-95 cursor-pointer animate-pulse"
                      >
                        ↓
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty_seat_${seatIdx}`}
                    style={{
                      position: 'absolute',
                      top: coords.top,
                      left: coords.left,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className="flex flex-col items-center pointer-events-none opacity-25"
                  >
                    <div className="w-8 h-8 rounded-full border border-dashed border-white/20 bg-zinc-950/30 flex items-center justify-center" />
                  </div>
                );
              }

              const isCurrentTurn = table.currentTurnSeatIndex === seatIdx && table.stage !== 'showdown' && table.stage !== 'hand_ended';
              const isDealer = table.dealerSeatIndex === seatIdx;
              const isSB = table.smallBlindSeatIndex === seatIdx;
              const isBB = table.bigBlindSeatIndex === seatIdx;
              const isTopSeat = parseInt(coords.top, 10) < 50;

              const isCardsRevealed = (player.id === currentUser.id) || table.stage === 'showdown' || table.stage === 'hand_ended';
              let playerHandScore: { rankName: string; rankNameAz: string } | null = null;
              if (isCardsRevealed && player.cards && player.cards.length > 0 && table.communityCards && table.communityCards.length >= 3) {
                try {
                  playerHandScore = evaluateBestHand(player.cards, table.communityCards, table.gameType);
                } catch {
                  playerHandScore = null;
                }
              }

              // Player cards element - placed on table felt in front of avatar ONLY if NOT folded and NOT sitting out
              const cardsElement = !player.isFolded && !player.isSittingOut && player.cards && player.cards.length > 0 ? (
                <div className={`flex flex-col items-center z-10 ${isTopSeat ? 'mt-0.5' : 'mb-0.5'}`}>
                  <div className={`flex items-center transition-all ${isCardsRevealed ? 'space-x-1' : '-space-x-3.5'}`}>
                    {player.cards.map((c, cIdx) => (
                      <PlayingCard
                        key={c.id || cIdx}
                        card={c}
                        hidden={!isCardsRevealed}
                        size="xs"
                        isFourColor={isFourColor}
                        isHighlighted={table.handWinners.some((hw) => hw.winningCards?.some((wc) => wc.id === c.id))}
                        className="transition-transform duration-200 shadow-md scale-90 sm:scale-95"
                      />
                    ))}
                  </div>

                  {/* Small white text right next to cards showing hand rank (e.g. Straight, Flush, Two Pair) */}
                  {isCardsRevealed && playerHandScore && (
                    <div className="mt-0.5 text-[7.5px] sm:text-[8px] font-bold text-white bg-zinc-950/90 border border-white/30 px-1.5 py-0.2 rounded shadow whitespace-nowrap drop-shadow flex items-center space-x-1">
                      <span>{lang === 'az' ? playerHandScore.rankNameAz : playerHandScore.rankName}</span>
                    </div>
                  )}
                </div>
              ) : null;

              // Player bet chip element - placed on table felt towards center
              const betChipsElement = player.currentBet > 0 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`${isTopSeat ? 'mt-0.5' : 'mb-0.5'} bg-amber-500/20 border border-amber-500/60 px-1.5 py-0.2 rounded-full text-[8.5px] font-bold text-amber-300 shadow flex items-center space-x-1`}
                >
                  <span className="w-1 h-1 rounded-full bg-amber-400" />
                  <span>${player.currentBet}</span>
                </motion.div>
              );

              // Player Note from Local Storage
              const playerNote = playerNotes[player.name.trim().toLowerCase()];
              const playerNotePreset = playerNote?.color ? getPresetByColor(playerNote.color) : undefined;
              const isOpponent = player.name.toLowerCase() !== currentUser.username.toLowerCase();

              // Circular Profile Avatar and Details
              const profileElement = (
                <div 
                  onClick={() => {
                    soundManager.playButtonClick();
                    setNoteTargetPlayer(player);
                  }}
                  title={
                    playerNote
                      ? `${player.name} [${playerNote.label || playerNotePreset?.labelEn || 'Note'}]: ${playerNote.noteText || ''}`
                      : `${player.name} (${lang === 'az' ? 'Qeyd əlavə etmək üçün klikləyin' : 'Click to add color note'})`
                  }
                  className="relative flex flex-col items-center cursor-pointer group select-none"
                >
                  {/* Real-time Player Speech Bubble */}
                  <AnimatePresence>
                    {playerSpeechBubbles[player.name] && (
                      <motion.div
                        initial={{ opacity: 0, y: isTopSeat ? -6 : 6, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: isTopSeat ? -4 : 4, scale: 0.8 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                        className={`absolute ${
                          isTopSeat ? 'top-full mt-3' : 'bottom-full mb-3'
                        } left-1/2 -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap`}
                      >
                        <div className="relative bg-zinc-950/95 border border-amber-400/90 text-amber-300 px-2.5 py-1 rounded-xl shadow-2xl shadow-black text-[11px] font-bold backdrop-blur-md flex items-center space-x-1">
                          <span>{playerSpeechBubbles[player.name].text}</span>
                          <div
                            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-950 border-amber-400/90 transform rotate-45 ${
                              isTopSeat ? '-top-1 border-t border-l' : '-bottom-1 border-b border-r'
                            }`}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div
                    className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all flex items-center justify-center group-hover:scale-105 active:scale-95 ${
                      player.isWinner
                        ? 'scale-105'
                        : player.isSittingOut || player.isFolded
                        ? 'opacity-40 grayscale'
                        : ''
                    }`}
                  >
                    {/* Turn Timer Circular Progress */}
                    {isCurrentTurn && (
                      <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 pointer-events-none z-20">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="46%"
                          className="stroke-amber-400 stroke-[2.5] fill-none transition-all duration-1000 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                          strokeDasharray="100"
                          strokeDashoffset={`${100 - (turnTimeLeft / table.timeBank) * 100}`}
                          strokeLinecap="round"
                        />
                      </svg>
                    )}

                    {/* VIP Framed Avatar Component */}
                    <AvatarWithFrame
                      src={player.avatar}
                      alt={player.name}
                      size="sm"
                      frameId={player.selectedAvatarFrame || (player.id === currentUser.id ? currentUser.selectedAvatarFrame : undefined) || 'default'}
                      vipLevel={player.vipLevel || (player.id === currentUser.id ? currentUser.vipLevel : 1)}
                      isWinner={player.isWinner}
                      className="w-full h-full"
                    />

                    {/* Color-Coded Note Badge on Top-Right of Avatar */}
                    {playerNotePreset ? (
                      <div
                        className={`absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full ${playerNotePreset.badgeBg} text-zinc-950 text-[7px] font-black shadow-md border border-white/40 flex items-center space-x-0.5 z-30 transition-transform group-hover:scale-110`}
                      >
                        <Tag className="w-2 h-2 fill-current" />
                      </div>
                    ) : playerNote ? (
                      <div
                        className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded-full bg-amber-400 text-zinc-950 text-[7px] font-black shadow-md border border-white/40 flex items-center space-x-0.5 z-30"
                      >
                        <Edit3 className="w-2 h-2" />
                      </div>
                    ) : null}

                    {/* Golden WIN Overlay directly over Winner's Profile Avatar */}
                    {player.isWinner && (
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 border border-yellow-200 flex flex-col items-center justify-center z-30 shadow-[0_0_15px_rgba(250,204,21,1)]"
                      >
                        <span className="text-[9px] font-black text-zinc-950 uppercase tracking-widest drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
                          WIN
                        </span>
                      </motion.div>
                    )}

                    {/* "Masadan kənar" Overlay on top of Circular Avatar */}
                    {player.isSittingOut && (
                      <div className="absolute inset-0 rounded-full bg-zinc-950/85 backdrop-blur-[1px] flex flex-col items-center justify-center z-30 border border-amber-500/70 p-0.5">
                        <span className="text-[6.5px] sm:text-[7px] font-black text-amber-400 uppercase tracking-tighter text-center leading-tight drop-shadow">
                          {t.sitting_out}
                        </span>
                      </div>
                    )}

                    {/* Dealer / SB / BB Buttons on circle edge */}
                    {isDealer && (
                      <div className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-white text-zinc-950 font-black text-[8px] border border-zinc-400 flex items-center justify-center shadow z-20">
                        {t.dealer_btn}
                      </div>
                    )}
                    {isSB && (
                      <div className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-500 text-zinc-950 font-black text-[7.5px] shadow z-20">
                        {t.sb_badge}
                      </div>
                    )}
                    {isBB && (
                      <div className="absolute -top-1 -right-1 px-1 rounded-full bg-blue-500 text-white font-black text-[7.5px] shadow z-20">
                        {t.bb_badge}
                      </div>
                    )}

                    {/* ALL-IN Badge */}
                    {player.isAllIn && (
                      <div className="absolute -bottom-1 -left-1 px-1 rounded-full bg-red-600 text-white font-black text-[7.5px] z-20 shadow">
                        ALL-IN
                      </div>
                    )}

                    {/* Consecutive Missed Turns AFK Badge (1/3 or 2/3 warning indicator) */}
                    {!player.isSittingOut && (player.consecutiveMissedTurns || 0) > 0 && (
                      <div
                        title={
                          lang === 'az'
                            ? `${player.consecutiveMissedTurns}/3 gediş qaçırılıb (3 ardıcıl qaçırılsa Masadan Kənar olacaq)`
                            : `${player.consecutiveMissedTurns}/3 missed turns (3 will auto sit-out)`
                        }
                        className="absolute -bottom-1 -left-1 bg-amber-500 text-zinc-950 font-mono font-black text-[7px] px-1 py-0.2 rounded-full z-20 shadow border border-amber-300 flex items-center space-x-0.5"
                      >
                        <span>⏱️</span>
                        <span>{player.consecutiveMissedTurns}/3</span>
                      </div>
                    )}

                    {/* Turn Timer Countdown Seconds */}
                    {isCurrentTurn && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-400 text-zinc-950 font-mono font-black text-[8px] px-0.5 rounded-full z-20 shadow">
                        {turnTimeLeft}s
                      </div>
                    )}
                  </div>

                  {/* Underneath Profile: Player Name, Table Balance & Action */}
                  <div className="flex flex-col items-center mt-0.5 space-y-0.2">
                    {/* Player Name */}
                    <div className="text-[9px] font-bold max-w-[72px] truncate text-center leading-tight drop-shadow flex items-center justify-center space-x-0.5 group-hover:text-amber-300 transition-colors">
                      {player.name.toUpperCase() === 'ADMIN' ? (
                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.7)] flex items-center space-x-0.5">
                          <span>👑</span>
                          <span>ADMIN</span>
                        </span>
                      ) : (
                        <span className="text-white group-hover:text-amber-300">{player.name}</span>
                      )}
                      {player.vipLevel > 1 && player.name.toUpperCase() !== 'ADMIN' && <Crown className="w-2 h-2 text-amber-400 shrink-0" />}
                    </div>

                    {/* Table Balance (Masa Balansı) */}
                    <div className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold shadow text-center leading-none flex items-center justify-center space-x-1 bg-zinc-950/90 border border-emerald-500/50 text-emerald-400">
                      <span>${player.chips.toLocaleString()}</span>
                    </div>

                    {/* Color-Coded Note Badge Indicator below balance */}
                    {playerNote && (
                      <div
                        className={`mt-0.5 px-1.5 py-0.2 rounded-full text-[7px] font-bold border flex items-center space-x-0.5 max-w-[76px] truncate shadow-sm ${
                          playerNotePreset
                            ? `${playerNotePreset.bgClass} ${playerNotePreset.borderClass} ${playerNotePreset.textClass}`
                            : 'bg-zinc-900 border-zinc-750 text-zinc-300'
                        }`}
                      >
                        <span className={`w-1 h-1 rounded-full ${playerNotePreset?.badgeBg || 'bg-amber-400'} shrink-0`} />
                        <span className="truncate">
                          {playerNote.label || (playerNotePreset ? (lang === 'az' ? playerNotePreset.labelAz.split(' ')[0] : playerNotePreset.labelEn.split(' ')[0]) : (lang === 'az' ? 'Qeyd' : 'Note'))}
                        </span>
                      </div>
                    )}

                    {/* Action status tag */}
                    {player.isWinner ? (
                      <span className="text-[8px] text-amber-300 font-black bg-zinc-950/95 px-1.5 py-0.2 rounded-full border border-amber-400/90 shadow uppercase text-center leading-none">
                        WIN +${player.winAmount > 0 ? player.winAmount.toLocaleString() : table.pot.toLocaleString()}
                      </span>
                    ) : player.isSittingOut ? (
                      <span className="text-[7.5px] text-amber-400 font-bold bg-zinc-950/90 px-1 py-0.2 rounded-full border border-amber-500/60 uppercase text-center leading-none">
                        {t.sitting_out}
                      </span>
                    ) : player.isFolded ? (
                      <span className="text-[8px] text-red-400 font-semibold bg-zinc-950/80 px-1 py-0.2 rounded-full border border-red-900/50">
                        {t.folded}
                      </span>
                    ) : player.lastAction ? (
                      <span className="text-[8px] text-amber-300 font-bold uppercase bg-zinc-950/80 px-1 py-0.2 rounded-full border border-amber-500/40 truncate max-w-[70px]">
                        {player.lastAction.type} {player.lastAction.amount ? `$${player.lastAction.amount}` : ''}
                      </span>
                    ) : null}
                  </div>
                </div>
              );

              return (
                <div
                  key={player.id}
                  style={coords}
                  className="absolute z-20 flex flex-col items-center pointer-events-auto"
                >
                  {/* Floating Emoji over player */}
                  {floatingEmojis.filter((e) => e.seatIndex === seatIdx).map((e) => (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: 1, y: -30, scale: 1.3 }}
                      exit={{ opacity: 0, y: -50 }}
                      className="absolute -top-5 text-2xl pointer-events-none z-40"
                    >
                      {e.emoji}
                    </motion.div>
                  ))}

                  {/* Positioning for Top vs Bottom seats so cards are always on table in front of player */}
                  {isTopSeat ? (
                    <>
                      {profileElement}
                      {cardsElement}
                      {betChipsElement}
                    </>
                  ) : (
                    <>
                      {betChipsElement}
                      {cardsElement}
                      {profileElement}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Area: Action Control Panel or Spectator Prompt */}
      <div className="relative z-30 w-full max-w-xl mx-auto space-y-1">
        {!humanPlayer ? (
          /* Spectator Mode Banner with Open Seat Prompt */
          <div className="bg-zinc-950/95 border border-amber-500/40 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center space-x-2.5 text-left">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <span className="text-amber-400 font-black">
                    {lang === 'az' ? 'İzləyici Rejimi' : 'Spectator Mode'}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    (${table.smallBlind}/${table.bigBlind})
                  </span>
                </h4>
                <p className="text-[10.5px] text-zinc-300 leading-tight">
                  {lang === 'az'
                    ? 'Oyuna başlamaq üçün masadakı boş yerlərdən (+ Otur) birinə klikləyin.'
                    : 'Click any empty seat (+ Sit) to join the table.'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] text-zinc-400 block">{lang === 'az' ? 'Balansınız' : 'Balance'}</span>
              <span className="text-xs font-black text-emerald-400 font-mono">
                ${totalUsableBalance.toFixed(2)}
              </span>
              {userBonusBalance > 0 && (
                <span className="text-[9.5px] text-amber-400 block font-medium">
                  (+${userBonusBalance.toFixed(2)} Bonus)
                </span>
              )}
            </div>
          </div>
        ) : humanPlayer.isSittingOut ? (
          <div className="bg-zinc-950/95 border border-amber-500/50 p-2.5 sm:p-3 rounded-xl flex items-center justify-between gap-2 shadow-xl backdrop-blur-md">
            <div className="flex items-center space-x-2 text-left">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 text-amber-400">
                <PlayCircle className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                  <span className="text-amber-400 font-black">{t.sit_out_auto_title}</span>
                  <span className="text-[10px] font-normal text-zinc-400">
                    ({lang === 'az' ? 'Masa durğunluğunun qarşısı alındı' : 'Prevented table stagnation'})
                  </span>
                </h4>
                <p className="text-[10.5px] text-zinc-300 leading-tight mt-0.5">
                  {(humanPlayer.consecutiveMissedTurns || 0) >= 3
                    ? t.sit_out_auto_desc
                    : (lang === 'az'
                        ? 'Masadakı cari əl yekunlaşan kimi növbəti ələ avtomatik başlayacaqsınız.'
                        : 'You will join the next hand as soon as it begins.')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleJoinTable}
              id="im_back_rejoin_table_btn"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black text-xs shadow-lg flex items-center justify-center space-x-1.5 transition-all transform active:scale-95 cursor-pointer ring-1 ring-emerald-400/50 shrink-0"
            >
              <PlayCircle className="w-4 h-4 text-zinc-950" />
              <span>{t.sit_out_im_back}</span>
            </button>
          </div>
        ) : (
          /* Action Controls (Active turn or Pre-actions) */
          <ActionControls
            player={humanPlayer}
            table={table}
            isMyTurn={isHumanTurn}
            onAction={(action, amount) => {
              if (humanPlayer) {
                executePlayerAction(humanPlayer.seatIndex, action, amount);
              }
            }}
            lang={lang}
            preAction={preAction}
            onSetPreAction={setPreAction}
            sitOutNextHand={sitOutNextHand}
            onToggleSitOutNextHand={setSitOutNextHand}
            turnTimeLeft={turnTimeLeft}
            maxTimeBank={table.timeBank || 15}
          />
        )}

        {/* Bottom Options: Quick Phrases Bar & Chat Toggle */}
        <div className="flex items-center justify-between gap-2 px-1">
          {/* Direct 1-Click Quick Phrases shortcuts */}
          <div className="hidden sm:flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center space-x-1 mr-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{lang === 'az' ? 'Tez Fraza:' : 'Quick:'}</span>
            </span>
            {QUICK_CHAT_PHRASES.slice(0, 4).map((phrase) => (
              <button
                key={`quick_bar_${phrase.id}`}
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  handleSendMessage(getQuickPhraseText(phrase, lang));
                }}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-amber-500/20 hover:border-amber-400/60 border border-zinc-800 text-[11px] font-semibold text-zinc-300 hover:text-amber-300 whitespace-nowrap transition-all shadow-sm active:scale-95 cursor-pointer flex items-center space-x-1"
              >
                <span>{getQuickPhraseText(phrase, lang)}</span>
              </button>
            ))}
          </div>

          {/* Table Chat Widget */}
          <div className="ml-auto">
            <TableChat
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onSendEmoji={handleSendEmoji}
              lang={lang}
              isOpen={isChatOpen}
              onToggle={() => setIsChatOpen(!isChatOpen)}
            />
          </div>
        </div>
      </div>

      {/* Buy-In Modal (When clicking empty seat) */}
      {showBuyInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-950 border border-amber-500/50 rounded-2xl p-5 sm:p-6 max-w-sm w-full text-zinc-100 shadow-2xl space-y-4 shadow-black/90"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{lang === 'az' ? 'Masaya Otur (Bay-in)' : 'Table Buy-In'}</h3>
                  <div className="text-[11px] text-amber-400 font-mono font-bold">
                    {table.name} • ${table.smallBlind}/${table.bigBlind}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBuyInModal(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Balance Selector: Bonus ilə oyna vs Real Balans */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                {lang === 'az' ? 'Ödəniş Mənbəyini Seçin:' : 'Select Balance Source:'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Bonus Balance Option */}
                <button
                  type="button"
                  onClick={() => {
                    setBuyInFundingSource('bonus');
                    const maxAmt = Math.min(table.maxBuyIn, userBonusBalance > 0 ? userBonusBalance : table.maxBuyIn);
                    setBuyInAmount(Math.max(table.minBuyIn, Math.min(maxAmt, table.bigBlind * 50)));
                    soundManager.playButtonClick();
                  }}
                  id="buyin_select_bonus_source_btn"
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    buyInFundingSource === 'bonus'
                      ? 'bg-amber-500/20 border-amber-400 shadow-md shadow-amber-500/10 text-white ring-1 ring-amber-400/50'
                      : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                    <Gift className="w-3.5 h-3.5" />
                    <span>{lang === 'az' ? 'Bonus Balans' : 'Bonus Balance'}</span>
                  </div>
                  <div className="text-sm font-black font-mono text-white mt-0.5">
                    ${userBonusBalance.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {userBonusBalance >= table.minBuyIn
                      ? (lang === 'az' ? 'Oynamaq mümkündür' : 'Available to play')
                      : (lang === 'az' ? 'Kifayət etmir' : 'Insufficient')}
                  </div>
                </button>

                {/* Real Balance Option */}
                <button
                  type="button"
                  onClick={() => {
                    setBuyInFundingSource('real');
                    const maxAmt = Math.min(table.maxBuyIn, userRealBalance > 0 ? userRealBalance : table.maxBuyIn);
                    setBuyInAmount(Math.max(table.minBuyIn, Math.min(maxAmt, table.bigBlind * 50)));
                    soundManager.playButtonClick();
                  }}
                  id="buyin_select_real_source_btn"
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    buyInFundingSource === 'real'
                      ? 'bg-emerald-500/20 border-emerald-400 shadow-md shadow-emerald-500/10 text-white ring-1 ring-emerald-400/50'
                      : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-400">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{lang === 'az' ? 'Real Balans' : 'Real Balance'}</span>
                  </div>
                  <div className="text-sm font-black font-mono text-white mt-0.5">
                    ${userRealBalance.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {userRealBalance >= table.minBuyIn
                      ? (lang === 'az' ? 'Oynamaq mümkündür' : 'Available to play')
                      : (lang === 'az' ? 'Balans yoxdur' : 'No funds')}
                  </div>
                </button>
              </div>
            </div>

            {/* Stakes Range info */}
            <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl flex justify-between items-center text-[11px] text-zinc-400">
              <span>{lang === 'az' ? 'Masa Limitləri:' : 'Table Limits:'}</span>
              <span className="font-mono text-zinc-200">
                Min: <strong className="text-amber-400">${table.minBuyIn.toFixed(2)}</strong> — Max: <strong className="text-amber-400">${table.maxBuyIn.toFixed(2)}</strong>
              </span>
            </div>

            {/* Buy-in Amount Selector */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-zinc-300">
                  {lang === 'az' ? 'Masaya daxil edəcəyiniz çip məbləği:' : 'Buy-in Amount:'}
                </span>
                <span className={`font-mono font-bold text-base ${buyInFundingSource === 'bonus' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  ${buyInAmount.toFixed(2)} {buyInFundingSource === 'bonus' ? 'Bonus' : 'USD'}
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={table.minBuyIn}
                max={Math.max(
                  table.minBuyIn,
                  Math.min(table.maxBuyIn, buyInFundingSource === 'bonus' ? userBonusBalance : userRealBalance)
                )}
                step={table.bigBlind}
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(Number(e.target.value))}
                className={`w-full bg-zinc-800 rounded-lg cursor-pointer h-2.5 ${
                  buyInFundingSource === 'bonus' ? 'accent-amber-400' : 'accent-emerald-400'
                }`}
              />

              {/* Quick Presets */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { label: 'Min', val: table.minBuyIn },
                  { label: '50 BB', val: table.bigBlind * 50 },
                  { label: '100 BB', val: table.bigBlind * 100 },
                  { label: 'Max', val: Math.min(table.maxBuyIn, buyInFundingSource === 'bonus' ? userBonusBalance : userRealBalance) },
                ].map((btn, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const curBalance = buyInFundingSource === 'bonus' ? userBonusBalance : userRealBalance;
                      const clampedVal = Math.min(
                        Math.min(table.maxBuyIn, curBalance),
                        Math.max(table.minBuyIn, btn.val)
                      );
                      setBuyInAmount(clampedVal > 0 ? clampedVal : table.minBuyIn);
                      soundManager.playButtonClick();
                    }}
                    className={`py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                      buyInAmount === btn.val
                        ? (buyInFundingSource === 'bonus' ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-emerald-500/20 border-emerald-400 text-emerald-300')
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note about joining next hand */}
            <div className="text-[10.5px] text-zinc-400 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/80 leading-tight">
              💡 {lang === 'az'
                ? 'Masaya oturduqda oyun artıq davam edirsə, masadakı əl bitən kimi avtomatik növbəti ələ kartlarınız paylanacaq.'
                : 'If a hand is currently underway, you will automatically receive cards at the start of the next deal.'}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBuyInModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold transition-colors cursor-pointer"
              >
                {lang === 'az' ? 'Ləğv et' : 'Cancel'}
              </button>

              {/* Dynamic Action Button: Bonus ilə oyna / Real Balans ilə Otur */}
              {buyInFundingSource === 'bonus' ? (
                <button
                  type="button"
                  onClick={handleConfirmBuyIn}
                  disabled={userBonusBalance < table.minBuyIn}
                  id="confirm_bonus_buyin_seat_btn"
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center space-x-1.5 ${
                    userBonusBalance >= table.minBuyIn
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 active:scale-95 cursor-pointer shadow-amber-500/20'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>{lang === 'az' ? '🎁 Bonus ilə oyna' : '🎁 Play with Bonus'} (${buyInAmount.toFixed(2)})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmBuyIn}
                  disabled={userRealBalance < table.minBuyIn}
                  id="confirm_real_buyin_seat_btn"
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center space-x-1.5 ${
                    userRealBalance >= table.minBuyIn
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 active:scale-95 cursor-pointer shadow-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>${buyInAmount.toFixed(2)} {lang === 'az' ? 'ilə Otur' : 'Buy-In'}</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Re-Buy Modal */}
      {showRebuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-zinc-100 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">{t.add_chips}</h3>
            <p className="text-xs text-zinc-400">
              {lang === 'az'
                ? 'Masanın maksimum limitinə qədər çip əlavə edin'
                : 'Top-up chips to table maximum limit'}
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span>{lang === 'az' ? 'Məbləğ' : 'Amount'}</span>
                <span className="text-amber-400">${rebuyAmount}</span>
              </div>
              <input
                type="range"
                min={table.bigBlind * 20}
                max={table.maxBuyIn}
                step={table.bigBlind * 5}
                value={rebuyAmount}
                onChange={(e) => setRebuyAmount(Number(e.target.value))}
                className="w-full accent-amber-400 bg-zinc-800 rounded-lg cursor-pointer h-2"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRebuyModal(false)}
                className="flex-1 py-2 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-bold hover:bg-zinc-800"
              >
                {lang === 'az' ? 'Ləğv et' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleRebuy}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold"
              >
                +${rebuyAmount} {lang === 'az' ? 'Əlavə Et' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Note & Color Tagging Modal (Persisted in Local Storage) */}
      <PlayerNoteModal
        player={noteTargetPlayer}
        isOpen={!!noteTargetPlayer}
        onClose={() => setNoteTargetPlayer(null)}
        lang={lang}
        onNoteUpdated={handleRefreshPlayerNotes}
      />

      {/* Session Table Stats & HUD Modal */}
      <TableStatsModal
        isOpen={showStatsModal}
        onClose={() => setShowStatsModal(false)}
        handHistory={handHistory}
        currentUserId={currentUser.id}
        currentUsername={currentUser.username}
        lang={lang}
        tableName={table.name}
      />
    </div>
  );
};
