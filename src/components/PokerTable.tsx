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
  BotSystemConfig
} from '../types/poker';
import { translations, Language } from '../utils/translations';
import { PlayingCard } from './PlayingCard';
import { ActionControls } from './ActionControls';
import { TableChat } from './TableChat';
import { 
  evaluateBestHand, 
  getBotAction, 
  createDeck, 
  calculateSidePots 
} from '../utils/pokerEngine';
import { createBotPlayer } from '../utils/mockData';
import { soundManager } from '../utils/audioEngine';
import confetti from 'canvas-confetti';
import { recordTableRake, subscribeToBotSystemConfig, fetchBotSystemConfigFromFirestore } from '../services/firebase';
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
  Percent
} from 'lucide-react';

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
}) => {
  const t = translations[lang];
  const [table, setTable] = useState<PokerTableState>(initialTable);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(initialTable.timeBank);
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

  // Identify human player seat
  const humanPlayer = table.players.find((p) => p && p.isHuman) || null;
  const humanSeatIndex = humanPlayer ? humanPlayer.seatIndex : 0;
  const isHumanTurn = table.currentTurnSeatIndex === humanSeatIndex && table.stage !== 'showdown' && table.stage !== 'hand_ended' && table.stage !== 'waiting';

  // Evaluate human current best hand
  const humanHandEval = humanPlayer && humanPlayer.cards.length > 0
    ? evaluateBestHand(humanPlayer.cards, table.communityCards, table.gameType)
    : null;

  // Turn Timer countdown effect
  useEffect(() => {
    if (table.stage === 'showdown' || table.stage === 'hand_ended' || table.stage === 'waiting') {
      if (turnTimerRef.current) clearInterval(turnTimerRef.current);
      return;
    }

    setTurnTimeLeft(table.timeBank);
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
  }, [table.currentTurnSeatIndex, table.stage]);

  const [handsPlayedCount, setHandsPlayedCount] = useState<number>(0);

  // Real-time Bot Settings from Admin Panel / Firestore (Pro mode active by default)
  const [botConfig, setBotConfig] = useState<BotSystemConfig>({
    isBotsActive: true,
    botDifficulty: 'pro',
    autoJoinLeaveEnabled: true,
    minThinkSeconds: 4,
    maxThinkSeconds: 9,
    targetTableOccupancy: 4,
  });

  useEffect(() => {
    // Initial fetch
    fetchBotSystemConfigFromFirestore().then((cfg) => {
      if (cfg) setBotConfig(cfg);
    });

    // Real-time listener so whenever admin changes difficulty or timer, all tables update live
    const unsubscribe = subscribeToBotSystemConfig((cfg) => {
      if (cfg) {
        setBotConfig(cfg);
        // If bots were just deactivated, instantly remove all bots from the table
        if (cfg.isBotsActive === false) {
          setTable((prev) => {
            const hasBots = prev.players.some((p) => p && !p.isHuman);
            if (!hasBots) return prev;
            return {
              ...prev,
              players: prev.players.map((p) => (p && !p.isHuman ? null : p)),
              stage: prev.players.filter((p) => p && p.isHuman).length < 2 ? 'waiting' : prev.stage,
            };
          });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // When table is waiting, human is seated, and bots are active, spawn bots to start game
  useEffect(() => {
    if (table.stage === 'waiting' && botConfig.isBotsActive !== false && botConfig.autoJoinLeaveEnabled) {
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

            return {
              ...prev,
              players: updated,
            };
          });
        }, 1200);

        return () => clearTimeout(spawnTimer);
      }
    }
  }, [table.stage, table.players, botConfig.isBotsActive, botConfig.autoJoinLeaveEnabled, botConfig.targetTableOccupancy]);

  // When table is waiting and 2+ active players are present, automatically start the hand!
  useEffect(() => {
    if (table.stage === 'waiting') {
      const activeCount = table.players.filter((p) => p !== null && !p.isSittingOut).length;
      if (activeCount >= 2) {
        const startTimer = setTimeout(() => {
          startNextHand();
        }, 1500);
        return () => clearTimeout(startTimer);
      }
    }
  }, [table.stage, table.players]);

  // Handle Bot Turn automatically with human-like 4 to 9 second thinking time & selected Bot Difficulty
  useEffect(() => {
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
  }, [table.currentTurnSeatIndex, table.stage, botConfig]);

  // Execute Action for a Player
  const executePlayerAction = (seatIndex: number, action: PlayerActionType, amount: number) => {
    setTable((prevTable) => {
      const updatedPlayers = [...prevTable.players];
      const player = updatedPlayers[seatIndex];
      if (!player) return prevTable;

      let newPot = prevTable.pot;
      let newHighBet = prevTable.currentHighBet;
      let newMinRaise = prevTable.minRaise;
      const updatedPlayer: Player = { ...player };

      if (action === 'fold') {
        updatedPlayer.isFolded = true;
        updatedPlayer.lastAction = { type: 'fold', timestamp: Date.now() };
      } else if (action === 'check') {
        updatedPlayer.lastAction = { type: 'check', timestamp: Date.now() };
      } else if (action === 'call') {
        const toCall = Math.min(amount, updatedPlayer.chips);
        updatedPlayer.chips -= toCall;
        updatedPlayer.currentBet += toCall;
        updatedPlayer.totalRoundBet += toCall;
        newPot += toCall;
        if (updatedPlayer.chips === 0) updatedPlayer.isAllIn = true;
        updatedPlayer.lastAction = { type: 'call', amount: toCall, timestamp: Date.now() };
      } else if (action === 'bet' || action === 'raise') {
        const addedChips = amount - updatedPlayer.currentBet;
        const actualAddition = Math.min(addedChips, updatedPlayer.chips);
        updatedPlayer.chips -= actualAddition;
        updatedPlayer.currentBet += actualAddition;
        updatedPlayer.totalRoundBet += actualAddition;
        newPot += actualAddition;
        if (updatedPlayer.currentBet > newHighBet) {
          newMinRaise = updatedPlayer.currentBet - newHighBet;
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
        updatedPlayer.currentBet += allInChips;
        updatedPlayer.totalRoundBet += allInChips;
        newPot += allInChips;
        if (updatedPlayer.currentBet > newHighBet) {
          newMinRaise = Math.max(prevTable.bigBlind, updatedPlayer.currentBet - newHighBet);
          newHighBet = updatedPlayer.currentBet;
        }
        updatedPlayer.isAllIn = true;
        updatedPlayer.lastAction = { type: 'all_in', amount: updatedPlayer.currentBet, timestamp: Date.now() };
      }

      updatedPlayers[seatIndex] = updatedPlayer;

      // Check if only 1 active player remains (everyone else folded)
      const remainingUnfolded = updatedPlayers.filter((p) => p && !p.isFolded);
      if (remainingUnfolded.length === 1 && remainingUnfolded[0]) {
        return endHandWithSoleWinner(prevTable, updatedPlayers, remainingUnfolded[0], newPot);
      }

      // Check if betting round is complete
      const activePlayers = updatedPlayers.filter((p) => p && !p.isFolded && !p.isAllIn);
      const isRoundDone = updatedPlayers.every((p) => {
        if (!p || p.isFolded || p.isAllIn) return true;
        return p.currentBet === newHighBet && p.lastAction !== undefined;
      });

      if (isRoundDone || activePlayers.length <= 1) {
        // Advance street
        return advanceStreet({
          ...prevTable,
          pot: newPot,
          currentHighBet: newHighBet,
          minRaise: newMinRaise,
          players: updatedPlayers,
        });
      }

      // Find next player to act
      const nextSeat = getNextActiveSeat(updatedPlayers, seatIndex);

      return {
        ...prevTable,
        pot: newPot,
        currentHighBet: newHighBet,
        minRaise: newMinRaise,
        players: updatedPlayers,
        currentTurnSeatIndex: nextSeat,
      };
    });
  };

  // Find next active seat
  const getNextActiveSeat = (players: (Player | null)[], fromSeat: number): number => {
    const totalSeats = players.length;
    for (let i = 1; i <= totalSeats; i++) {
      const idx = (fromSeat + i) % totalSeats;
      const p = players[idx];
      if (p && !p.isFolded && !p.isAllIn && !p.isSittingOut) {
        return idx;
      }
    }
    return fromSeat;
  };

  // Turn Timeout (Auto Check/Fold & Sit Out)
  const handleTurnTimeout = () => {
    const currentSeat = table.players[table.currentTurnSeatIndex];
    if (!currentSeat) return;

    const toCall = table.currentHighBet - currentSeat.currentBet;
    if (toCall === 0) {
      executePlayerAction(currentSeat.seatIndex, 'check', 0);
    } else {
      executePlayerAction(currentSeat.seatIndex, 'fold', 0);

      // Auto fold on timeout and mark as sitting out (masadan kənar)
      setTable((prev) => {
        const updatedPlayers = [...prev.players];
        const p = updatedPlayers[currentSeat.seatIndex];
        if (p) {
          updatedPlayers[currentSeat.seatIndex] = {
            ...p,
            isSittingOut: true,
            isFolded: true,
            cards: [],
          };
        }
        return { ...prev, players: updatedPlayers };
      });

      if (currentSeat.isHuman) {
        setSitOutNextHand(true);
        setChatMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            senderName: 'Dealer',
            senderAvatar: '',
            text: lang === 'az'
              ? 'Vaxtınız bitdiyi üçün əliniz pasa atıldı və masadan kənara keçirildiniz.'
              : 'Time expired. You folded and are now sitting out.',
            timestamp: Date.now(),
            isSystem: true,
          },
        ]);
      }
    }
  };

  // Advance street (Preflop -> Flop -> Turn -> River -> Showdown)
  const advanceStreet = (currentState: PokerTableState): PokerTableState => {
    // Reset current round bets for next street
    const resetPlayers = currentState.players.map((p) =>
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
    } else if (currentState.stage === 'flop') {
      nextStage = 'turn';
      soundManager.playCardDeal();
      // Deal 1 turn card
      newCommunity.push(deck.pop()!);
    } else if (currentState.stage === 'turn') {
      nextStage = 'river';
      soundManager.playCardDeal();
      // Deal 1 river card
      newCommunity.push(deck.pop()!);
    } else if (currentState.stage === 'river') {
      nextStage = 'showdown';
      return resolveShowdown({
        ...currentState,
        stage: 'showdown',
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

    // Sort by hand strength score descending
    activeContenders.sort((a, b) => (b.handRankScore || 0) - (a.handRankScore || 0));
    const bestScore = activeContenders[0]?.handRankScore || 0;
    const winners = activeContenders.filter((c) => c.handRankScore === bestScore);

    // Calculate 10% Masa Faizi (Table Rake) & Net Pot
    const totalPot = finalState.pot;
    const rakePercent = 10;
    const rakeAmount = Number((totalPot * 0.10).toFixed(2));
    const netPot = Number(Math.max(0, totalPot - rakeAmount).toFixed(2));
    const winShare = Number((netPot / (winners.length || 1)).toFixed(2));

    const updatedPlayers = finalState.players.map((p) => {
      if (!p) return null;
      const isWin = winners.some((w) => w.id === p.id);
      const evaluated = activeContenders.find((c) => c.id === p.id);
      return {
        ...p,
        chips: isWin ? Number((p.chips + winShare).toFixed(2)) : p.chips,
        isWinner: isWin,
        winAmount: isWin ? winShare : 0,
        handRankName: evaluated?.handRankName,
        bestFiveCards: evaluated?.bestFiveCards,
      };
    });

    const winningCards = winners[0]?.bestFiveCards || [];
    const winnerNames = winners.map((w) => w.name).join(' & ');
    const winnerHandName = winners[0]?.handRankName || 'High Card';

    setWinnerBanner({
      name: winnerNames,
      amount: netPot,
      totalPot,
      rakeAmount,
      handName: winnerHandName,
    });

    // Record 10% Table Rake to Firestore & Admin Panel System
    if (rakeAmount > 0) {
      recordTableRake({
        tableId: finalState.id,
        tableName: finalState.name,
        gameType: finalState.gameType,
        handNumber: finalState.handNumber,
        totalPot,
        rakePercent: 10,
        rakeAmount,
        netPotWon: netPot,
        winnerName: winnerNames,
        winnerAvatar: winners[0]?.avatar,
        timestamp: Date.now(),
      });
    }

    if (winners.some((w) => w.isHuman)) {
      confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
      // In-table winnings accumulate in player.chips and are returned to the proper balance upon table exit
    }

    // Save to Hand History
    const historyEntry: HandHistoryRecord = {
      id: `h_${Date.now()}`,
      handNumber: finalState.handNumber,
      tableName: finalState.name,
      gameType: finalState.gameType,
      blinds: `$${finalState.smallBlind}/$${finalState.bigBlind}`,
      pot: totalPot,
      rake: rakeAmount,
      netPot: netPot,
      communityCards: finalState.communityCards,
      winners: winners.map((w) => ({
        name: w.name,
        avatar: w.avatar,
        amount: winShare,
        handName: winnerHandName,
        cards: w.cards,
      })),
      playerCards: humanPlayer ? humanPlayer.cards : [],
      playerProfit: winners.some((w) => w.isHuman)
        ? winShare - (humanPlayer?.totalRoundBet || 0)
        : -(humanPlayer?.totalRoundBet || 0),
      timestamp: Date.now(),
    };
    setHandHistory((prev) => [historyEntry, ...prev.slice(0, 19)]);

    // Schedule next hand in 4 seconds
    if (nextHandTimeoutRef.current) clearTimeout(nextHandTimeoutRef.current);
    nextHandTimeoutRef.current = setTimeout(() => {
      startNextHand();
    }, 4000);

    return {
      ...finalState,
      stage: 'hand_ended',
      players: updatedPlayers,
      handWinners: winners.map((w) => ({
        playerId: w.id,
        amount: winShare,
        handName: winnerHandName,
        winningCards,
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

    // Calculate 10% Table Rake & Net Pot
    const totalPot = finalPot;
    const rakePercent = 10;
    const rakeAmount = Number((totalPot * 0.10).toFixed(2));
    const netPot = Number(Math.max(0, totalPot - rakeAmount).toFixed(2));

    const updatedPlayers = players.map((p) => {
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
      totalPot,
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
        totalPot,
        rakePercent: 10,
        rakeAmount,
        netPotWon: netPot,
        winnerName: winner.name,
        winnerAvatar: winner.avatar,
        timestamp: Date.now(),
      });
    }

    if (winner.isHuman) {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.5 } });
      // In-table winnings accumulate in player.chips and are returned to the proper balance upon table exit
    }

    // Schedule next hand in 4 seconds
    if (nextHandTimeoutRef.current) clearTimeout(nextHandTimeoutRef.current);
    nextHandTimeoutRef.current = setTimeout(() => {
      startNextHand();
    }, 4000);

    return {
      ...prevTable,
      pot: finalPot,
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

        // Human Player Chip Check: If chips ran out (< smallBlind), auto remove from table seat!
        if (p.isHuman) {
          if (p.chips < prevTable.smallBlind || p.chips <= 0) {
            messagesToAdd.push(
              lang === 'az'
                ? `⚠️ Masadakı bütün çipləriniz bitdi! Masadan avtomatik çıxarıldınız.`
                : `⚠️ All your table chips have run out! You were automatically removed from the seat.`
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
        if (botConfig.isBotsActive === false) {
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
      if (botConfig.isBotsActive !== false && botConfig.autoJoinLeaveEnabled) {
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

      return {
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
          };
        }
        return { ...prev, players };
      });

      setChatMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          senderName: 'System',
          senderAvatar: '',
          text: lang === 'az'
            ? 'Masaya yenidən qatıldınız! Növbəti əldə oyuna davam edəcəksiniz.'
            : 'You have rejoined the table! You will receive cards on the next deal.',
          timestamp: Date.now(),
          isSystem: true,
        },
      ]);
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
        vipLevel: currentUser.vipLevel,
        joinedAt: Date.now(),
      };
      updatedPlayers[selectedSeatIndex] = newHumanPlayer;

      return {
        ...prev,
        players: updatedPlayers,
      };
    });

    setShowBuyInModal(false);

    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys_seat_${Date.now()}`,
        senderName: 'System',
        senderAvatar: '',
        text: isMidHand
          ? (lang === 'az'
              ? `🎉 Masaya uğurla oturdunuz ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})! Cari əl bitdikdən dərhal sonra növbəti ələ daxil olacaqsınız.`
              : `🎉 Seated successfully ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})! You will receive cards immediately after this hand ends.`)
          : (lang === 'az'
              ? `🎉 Masaya uğurla oturdunuz ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})! Oyun başlayır.`
              : `🎉 Seated successfully ($${buyInAmount.toLocaleString()} ${isBonusFunding ? 'Bonus' : 'Real'})! Game starts.`),
        timestamp: Date.now(),
        isSystem: true,
      },
    ]);
  };

  // Exit Table & Cash Out remaining chips to balance
  const handleExitTable = () => {
    soundManager.playButtonClick();
    if (humanPlayer && humanPlayer.chips > 0) {
      if (isPlayerUsingBonus) {
        onUpdateUserBalance(
          currentUser.realBalance,
          currentUser.playMoneyBalance,
          Number(((currentUser.bonusBalance || 0) + humanPlayer.chips).toFixed(2))
        );
      } else {
        onUpdateUserBalance(
          Number((currentUser.realBalance + humanPlayer.chips).toFixed(2)),
          currentUser.playMoneyBalance,
          currentUser.bonusBalance
        );
      }
    }
    onLeaveTable();
  };

  // Send message in chat
  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: `chat_${Date.now()}`,
      senderName: currentUser.username,
      senderAvatar: currentUser.avatar,
      text,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, newMsg]);

    // Bot friendly replies
    if (Math.random() > 0.4) {
      setTimeout(() => {
        const botReplies = [
          'Nice hand!',
          'Good luck all!',
          'Gg!',
          'Uff, bad beat...',
          'Poker is life 🔥',
          'Vamos!',
          'Check or raise?',
        ];
        const randomBot = table.players.find((p) => p && !p.isHuman);
        if (randomBot) {
          setChatMessages((prev) => [
            ...prev,
            {
              id: `b_chat_${Date.now()}`,
              senderName: randomBot.name,
              senderAvatar: randomBot.avatar,
              text: botReplies[Math.floor(Math.random() * botReplies.length)],
              timestamp: Date.now(),
            },
          ]);
        }
      }, 1500);
    }
  };

  // Floating Emoji reaction
  const handleSendEmoji = (emoji: string) => {
    const newEmoji: FloatingEmoji = {
      id: `emo_${Date.now()}`,
      seatIndex: humanSeatIndex,
      emoji,
      timestamp: Date.now(),
    };
    setFloatingEmojis((prev) => [...prev, newEmoji]);
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
    // Offset so human player is always positioned centered at the bottom
    const relativeIndex = (seatIdx - humanSeatIndex + totalCapacity) % totalCapacity;

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
    <div className="relative w-full max-w-full h-[calc(100dvh-54px)] max-h-[calc(100dvh-54px)] bg-zinc-950 flex flex-col justify-between overflow-hidden select-none px-2 py-1.5 sm:px-3 sm:py-2">
      {/* Top Table Control Bar */}
      <div className="flex items-center justify-between z-20 px-1 max-w-4xl mx-auto w-full">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {/* Small Exit Button (Lobby) */}
          <button
            onClick={handleExitTable}
            id="table_leave_btn"
            className="flex items-center space-x-1 py-1 px-2.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors shadow cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.leave_table}</span>
          </button>

          {/* Direct Logout / Girişə Qayıt Button */}
          {onLogout && (
            <button
              onClick={() => {
                handleExitTable();
                onLogout();
              }}
              id="table_logout_btn"
              className="flex items-center space-x-1 py-1 px-2.5 rounded-lg bg-gradient-to-r from-red-950/80 to-zinc-900 hover:from-red-900/90 hover:to-zinc-850 border border-red-800/50 hover:border-red-600 text-red-300 hover:text-white text-xs font-bold transition-all shadow cursor-pointer active:scale-95"
              title={lang === 'az' ? 'Hesabdan çıxış et və giriş/qeydiyyat ekranına qayıt' : 'Log out to sign-in / registration screen'}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === 'az' ? 'Çıxış (Girişə Qayıt)' : 'Logout'}</span>
            </button>
          )}

          {/* Table Details Badge */}
          <div className="flex items-center space-x-2 bg-zinc-900/80 border border-zinc-800 px-2.5 py-0.5 rounded-lg text-xs">
            <span className="font-bold text-white text-xs">{table.name}</span>
            <span className="text-zinc-500">•</span>
            <span className="text-amber-400 font-mono font-semibold text-xs">
              ${table.smallBlind}/${table.bigBlind}
            </span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-400 text-xs">
              #{table.handNumber}
            </span>
          </div>
        </div>

        {/* Right Quick Tools: Settings, Support, Hand Rankings */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {onOpenHandRankings && (
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onOpenHandRankings();
              }}
              title={lang === 'az' ? 'Poker Kombinasiyaları & Qaydalar' : 'Hand Rankings'}
              className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenSupport && (
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onOpenSupport();
              }}
              title={lang === 'az' ? 'Adminlə Canlı Əlaqə & Dəstək' : 'Live Support'}
              className="flex items-center space-x-1 py-1 px-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all shadow cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'az' ? 'Dəstək' : 'Support'}</span>
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onOpenSettings();
              }}
              title={lang === 'az' ? 'Masa və Səs Ayarları' : 'Settings'}
              className="flex items-center space-x-1 py-1 px-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors shadow cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'az' ? 'Ayarlar' : 'Settings'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Oval Poker Table Canvas */}
      <div className="relative flex-1 flex items-center justify-center my-1 w-full max-w-4xl mx-auto px-1">
        {/* Outer Wooden / Leather Rail */}
        <div className="relative w-full h-[270px] sm:h-[310px] md:h-[340px] lg:h-[360px] rounded-[130px] sm:rounded-[170px] md:rounded-[200px] bg-gradient-to-b from-amber-950 via-zinc-950 to-amber-950 p-2.5 sm:p-3.5 shadow-2xl shadow-black border-4 border-amber-900/60 flex items-center justify-center">
          
          {/* Inner Felt Area */}
          <div className={`relative w-full h-full rounded-[115px] sm:rounded-[155px] md:rounded-[185px] ${feltThemes} border-2 shadow-inner flex flex-col items-center justify-center overflow-hidden`}>
            
            {/* Table Watermark & Betting Line */}
            <div className="absolute inset-5 sm:inset-9 rounded-[95px] sm:rounded-[135px] border border-white/10 pointer-events-none" />
            <div className="absolute flex flex-col items-center justify-center opacity-15 pointer-events-none">
              <span className="text-4xl sm:text-6xl font-black text-white tracking-widest font-mono">
                ♠ ♥ ♦ ♣
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-white tracking-widest mt-0.5">
                POKER ARENA PRO
              </span>
            </div>

            {/* Center Felt: Pots & Community Cards */}
            <div className="relative z-10 flex flex-col items-center justify-center space-y-2">
              {/* Main Pot & Side Pots Display */}
              <div className="flex items-center space-x-1.5">
                <div className="bg-zinc-950/85 border border-amber-500/40 px-2.5 py-0.5 rounded-full shadow-lg flex items-center space-x-1.5 backdrop-blur-sm">
                  <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-zinc-950 font-black text-[10px] shadow">
                    $
                  </div>
                  <span className="text-xs sm:text-sm font-black text-amber-400 font-mono tracking-tight">
                    ${table.pot.toLocaleString()}
                  </span>
                </div>

                {/* Side pots if any */}
                {table.sidePots.map((sp, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-950/85 border border-blue-500/40 px-2 py-0.5 rounded-full text-[10px] font-bold text-blue-300 flex items-center space-x-1 backdrop-blur-sm"
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-500/30 text-blue-300 flex items-center justify-center text-[9px] font-bold">
                      ${idx + 1}
                    </span>
                    <span className="font-mono font-bold">${sp.amount}</span>
                  </div>
                ))}
              </div>

              {/* 5 Community Cards (Flop, Turn, River) - Compact Size */}
              <div className="flex items-center space-x-1">
                {[0, 1, 2, 3, 4].map((index) => {
                  const card = table.communityCards[index];
                  const isWinningCard = table.handWinners.some((hw) =>
                    hw.winningCards?.some((wc) => wc.id === card?.id)
                  );

                  return (
                    <div
                      key={index}
                      className="w-7 h-10 sm:w-8 sm:h-11 rounded border border-white/15 bg-black/25 flex items-center justify-center shadow-md"
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
                          <div className="w-4 h-7 rounded border border-dashed border-white/10 opacity-30" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Game Stage & Street indicator or Winner Banner */}
                {winnerBanner ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center bg-zinc-950/95 border border-amber-400/80 px-3 py-1 rounded-xl shadow-xl backdrop-blur-md"
                  >
                    <div className="flex items-center space-x-1.5">
                      <Crown className="w-3.5 h-3.5 text-yellow-400 animate-bounce" />
                      <span className="text-[11px] font-black text-amber-300">{winnerBanner.name}</span>
                      <span className="text-[11px] font-black text-emerald-400 font-mono">+${winnerBanner.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-[8.5px] text-zinc-300">
                      <span>{winnerBanner.handName}</span>
                      {winnerBanner.rakeAmount !== undefined && winnerBanner.rakeAmount > 0 && (
                        <span className="text-amber-400 font-bold bg-amber-950/90 px-1 py-0.2 rounded border border-amber-500/40">
                          Masa Faizi (10%): -${winnerBanner.rakeAmount.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-[9.5px] font-semibold text-white/60 tracking-wider uppercase bg-black/30 px-2.5 py-0.5 rounded-full">
                    {table.stage === 'preflop' && 'Pre-Flop'}
                    {table.stage === 'flop' && 'Flop'}
                    {table.stage === 'turn' && 'Turn'}
                    {table.stage === 'river' && 'River'}
                    {table.stage === 'showdown' && 'Showdown'}
                    {table.stage === 'hand_ended' && (lang === 'az' ? 'Əl bitdi' : 'Hand Ended')}
                  </div>
                )}
              </div>
          </div>

          {/* Render Players ON the Table Rail (outside inner clipping container) */}
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
                      <button
                        type="button"
                        onClick={() => handleEmptySeatClick(seatIdx)}
                        id={`take_empty_seat_btn_${seatIdx}`}
                        className="group flex flex-col items-center p-1 rounded-2xl bg-zinc-950/90 border-2 border-dashed border-emerald-500/70 hover:border-amber-400 hover:bg-zinc-900 shadow-xl hover:shadow-amber-500/20 transition-all transform hover:scale-110 active:scale-95 cursor-pointer"
                      >
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-500/20 group-hover:bg-amber-500/25 flex items-center justify-center text-emerald-400 group-hover:text-amber-300">
                          <PlusCircle className="w-5 h-5 animate-pulse" />
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-black text-emerald-300 group-hover:text-amber-300 uppercase tracking-tighter mt-0.5 whitespace-nowrap px-1">
                          {lang === 'az' ? '+ Otur' : '+ Sit'}
                        </span>
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
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-dashed border-white/20 bg-zinc-950/30 flex items-center justify-center" />
                  </div>
                );
              }

              const isCurrentTurn = table.currentTurnSeatIndex === seatIdx && table.stage !== 'showdown' && table.stage !== 'hand_ended';
              const isDealer = table.dealerSeatIndex === seatIdx;
              const isSB = table.smallBlindSeatIndex === seatIdx;
              const isBB = table.bigBlindSeatIndex === seatIdx;
              const isTopSeat = parseInt(coords.top, 10) < 50;

              const isCardsRevealed = player.isHuman || table.stage === 'showdown' || table.stage === 'hand_ended';
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

              // Circular Profile Avatar and Details
              const profileElement = (
                <div className="relative flex flex-col items-center">
                  <div
                    className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full transition-all flex items-center justify-center ${
                      player.isWinner
                        ? 'ring-3 ring-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.85)] scale-105'
                        : isCurrentTurn
                        ? 'ring-2 ring-amber-400 shadow-sm shadow-amber-400/40'
                        : player.isSittingOut || player.isFolded
                        ? 'opacity-40 grayscale'
                        : 'ring-1 ring-zinc-700'
                    }`}
                  >
                    {/* Turn Timer Circular Progress */}
                    {isCurrentTurn && (
                      <svg className="absolute -inset-0.5 w-[calc(100%+4px)] h-[calc(100%+4px)] -rotate-90 pointer-events-none z-10">
                        <circle
                          cx="50%"
                          cy="50%"
                          r="46%"
                          className="stroke-amber-400 stroke-[2] fill-none transition-all duration-1000"
                          strokeDasharray="100"
                          strokeDashoffset={`${100 - (turnTimeLeft / table.timeBank) * 100}`}
                          strokeLinecap="round"
                        />
                      </svg>
                    )}

                    {/* Circular Avatar Image */}
                    <img
                      src={player.avatar}
                      alt={player.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover border border-zinc-900 bg-zinc-900 shadow-sm"
                    />

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
                    <div className="text-[9px] font-bold max-w-[72px] truncate text-center leading-tight drop-shadow flex items-center justify-center space-x-0.5">
                      {player.name.toUpperCase() === 'ADMIN' ? (
                        <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.7)] flex items-center space-x-0.5">
                          <span>👑</span>
                          <span>ADMIN</span>
                        </span>
                      ) : (
                        <span className="text-white">{player.name}</span>
                      )}
                      {player.vipLevel > 1 && player.name.toUpperCase() !== 'ADMIN' && <Crown className="w-2 h-2 text-amber-400 shrink-0" />}
                    </div>

                    {/* Table Balance (Masa Balansı) */}
                    <div
                      className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold shadow text-center leading-none flex items-center justify-center space-x-1 ${
                        player.isHuman && isPlayerUsingBonus
                          ? 'bg-amber-950/90 border border-amber-500/60 text-amber-300'
                          : 'bg-zinc-950/90 border border-emerald-500/50 text-emerald-400'
                      }`}
                    >
                      <span>${player.chips.toLocaleString()}</span>
                      {player.isHuman && isPlayerUsingBonus && (
                        <span className="text-[7px] font-black text-amber-400 uppercase tracking-tighter px-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                          Bonus
                        </span>
                      )}
                    </div>

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
          <div className="bg-zinc-950/95 border border-emerald-500/50 p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-xl backdrop-blur-md">
            <div className="flex items-center space-x-2 text-left">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <PlayCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center space-x-1">
                  <span className="text-amber-400 font-black">{t.sitting_out}</span>
                  <span className="text-[10px] font-normal text-zinc-400">
                    ({lang === 'az' ? 'Cari əl bitdikdən sonra daxil olacaqsınız' : 'Waiting for next hand'})
                  </span>
                </h4>
                <p className="text-[10px] text-zinc-400 leading-tight">
                  {lang === 'az'
                    ? 'Masadakı cari əl yekunlaşan kimi növbəti ələ avtomatik başlayacaqsınız.'
                    : 'You will automatically join the game once the ongoing hand completes.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleJoinTable}
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-black text-xs shadow-lg flex items-center justify-center space-x-1.5 transition-all transform active:scale-95 cursor-pointer ring-1 ring-emerald-400/40 shrink-0"
            >
              <PlayCircle className="w-3.5 h-3.5 text-zinc-950" />
              <span>{t.join_table_btn}</span>
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
          />
        )}

        {/* Bottom Options: Chat Toggle */}
        <div className="flex items-center justify-end px-1">
          {/* Table Chat Widget */}
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
    </div>
  );
};
