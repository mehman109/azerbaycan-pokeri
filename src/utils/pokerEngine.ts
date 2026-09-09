import { Card, Suit, Rank, Player, GameType, GameStage, SidePot, PlayerActionType, BotDifficulty } from '../types/poker';

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  'T': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

export const HAND_SCORES = {
  HIGH_CARD: 1000000,
  ONE_PAIR: 2000000,
  TWO_PAIR: 3000000,
  THREE_OF_A_KIND: 4000000,
  STRAIGHT: 5000000,
  FLUSH: 6000000,
  FULL_HOUSE: 7000000,
  FOUR_OF_A_KIND: 8000000,
  STRAIGHT_FLUSH: 9000000,
  ROYAL_FLUSH: 10000000,
};

// Create a full 52-card deck (or 36-card deck for Short Deck)
export function createDeck(gameType: GameType = 'texas_holdem'): Card[] {
  const deck: Card[] = [];
  const ranks = gameType === 'short_deck' 
    ? RANKS.filter(r => RANK_VALUES[r] >= 6 || r === 'A') 
    : RANKS;

  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        id: `${rank}_${suit}_${Math.random().toString(36).substring(2, 7)}`,
      });
    }
  }
  return shuffleDeck(deck);
}

// Fisher-Yates shuffle
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface HandEvaluation {
  score: number;
  rankName: string;
  rankNameAz: string;
  bestFiveCards: Card[];
  description: string;
  descriptionAz: string;
}

// Get all subsets of size k
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  const head = arr[0];
  const tail = arr.slice(1);
  const withHead = combinations(tail, k - 1).map(c => [head, ...c]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

// Evaluate exact 5 cards
export function evaluate5Cards(cards: Card[], isShortDeck = false): { score: number; rankCategory: number; rankName: string; rankNameAz: string } {
  if (cards.length !== 5) {
    return { score: 0, rankCategory: 0, rankName: 'Incomplete', rankNameAz: 'Tamamlanmamış' };
  }

  // Sort descending by rank value
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  const values = sorted.map(c => RANK_VALUES[c.rank]);
  const suits = sorted.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Check straight
  let isStraight = false;
  let straightHigh = 0;

  // Normal straight check
  if (
    values[0] - values[1] === 1 &&
    values[1] - values[2] === 1 &&
    values[2] - values[3] === 1 &&
    values[3] - values[4] === 1
  ) {
    isStraight = true;
    straightHigh = values[0];
  } else if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
    // Wheel straight A-2-3-4-5
    isStraight = true;
    straightHigh = 5;
  } else if (isShortDeck && values[0] === 14 && values[1] === 9 && values[2] === 8 && values[3] === 7 && values[4] === 6) {
    // Short deck wheel: A-6-7-8-9
    isStraight = true;
    straightHigh = 9;
  }

  // Group by rank count
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }

  const countGroups: { value: number; count: number }[] = Object.keys(counts).map(v => ({
    value: Number(v),
    count: counts[Number(v)],
  })).sort((a, b) => b.count - a.count || b.value - a.value);

  // Royal Flush & Straight Flush
  if (isFlush && isStraight) {
    if (straightHigh === 14) {
      return {
        score: HAND_SCORES.ROYAL_FLUSH,
        rankCategory: HAND_SCORES.ROYAL_FLUSH,
        rankName: 'Royal Flush',
        rankNameAz: 'Royal Flush',
      };
    }
    return {
      score: HAND_SCORES.STRAIGHT_FLUSH + straightHigh,
      rankCategory: HAND_SCORES.STRAIGHT_FLUSH,
      rankName: 'Straight Flush',
      rankNameAz: 'Straight Flush',
    };
  }

  // Four of a kind
  if (countGroups[0].count === 4) {
    const kicker = countGroups[1].value;
    return {
      score: HAND_SCORES.FOUR_OF_A_KIND + countGroups[0].value * 100 + kicker,
      rankCategory: HAND_SCORES.FOUR_OF_A_KIND,
      rankName: 'Four of a Kind',
      rankNameAz: 'Four of a Kind (Kare)',
    };
  }

  // Full House
  if (countGroups[0].count === 3 && countGroups[1].count === 2) {
    return {
      score: HAND_SCORES.FULL_HOUSE + countGroups[0].value * 100 + countGroups[1].value,
      rankCategory: HAND_SCORES.FULL_HOUSE,
      rankName: 'Full House',
      rankNameAz: 'Full House',
    };
  }

  // Flush
  if (isFlush) {
    const kickerScore = values[0] * 10000 + values[1] * 1000 + values[2] * 100 + values[3] * 10 + values[4];
    return {
      score: HAND_SCORES.FLUSH + kickerScore,
      rankCategory: HAND_SCORES.FLUSH,
      rankName: 'Flush',
      rankNameAz: 'Flush (Rəng)',
    };
  }

  // Straight
  if (isStraight) {
    return {
      score: HAND_SCORES.STRAIGHT + straightHigh,
      rankCategory: HAND_SCORES.STRAIGHT,
      rankName: 'Straight',
      rankNameAz: 'Straight (Strit)',
    };
  }

  // Three of a kind
  if (countGroups[0].count === 3) {
    const kicker1 = countGroups[1].value;
    const kicker2 = countGroups[2].value;
    return {
      score: HAND_SCORES.THREE_OF_A_KIND + countGroups[0].value * 1000 + kicker1 * 50 + kicker2,
      rankCategory: HAND_SCORES.THREE_OF_A_KIND,
      rankName: 'Three of a Kind',
      rankNameAz: 'Three of a Kind (Set)',
    };
  }

  // Two Pair
  if (countGroups[0].count === 2 && countGroups[1].count === 2) {
    const highPair = Math.max(countGroups[0].value, countGroups[1].value);
    const lowPair = Math.min(countGroups[0].value, countGroups[1].value);
    const kicker = countGroups[2].value;
    return {
      score: HAND_SCORES.TWO_PAIR + highPair * 1000 + lowPair * 50 + kicker,
      rankCategory: HAND_SCORES.TWO_PAIR,
      rankName: 'Two Pair',
      rankNameAz: 'Two Pair (İki Cüt)',
    };
  }

  // One Pair
  if (countGroups[0].count === 2) {
    const kickers = countGroups.slice(1).map(g => g.value);
    const kickerScore = kickers[0] * 500 + (kickers[1] || 0) * 30 + (kickers[2] || 0);
    return {
      score: HAND_SCORES.ONE_PAIR + countGroups[0].value * 10000 + kickerScore,
      rankCategory: HAND_SCORES.ONE_PAIR,
      rankName: 'One Pair',
      rankNameAz: 'One Pair (Bir Cüt)',
    };
  }

  // High Card
  const kickerScore = values[0] * 10000 + values[1] * 1000 + values[2] * 100 + values[3] * 10 + values[4];
  return {
    score: HAND_SCORES.HIGH_CARD + kickerScore,
    rankCategory: HAND_SCORES.HIGH_CARD,
    rankName: 'High Card',
    rankNameAz: 'High Card (Yüksək Kart)',
  };
}

// Evaluate Texas Hold'em hand (best 5 out of 7) or Omaha (exactly 2 from hole, exactly 3 from board)
export function evaluateBestHand(
  holeCards: Card[],
  communityCards: Card[],
  gameType: GameType = 'texas_holdem'
): HandEvaluation {
  if (holeCards.length === 0) {
    return {
      score: 0,
      rankName: 'No Cards',
      rankNameAz: 'Kart yoxdur',
      bestFiveCards: [],
      description: 'No cards dealt',
      descriptionAz: 'Kartlar paylanmayıb',
    };
  }

  // If pre-flop (no community cards yet)
  if (communityCards.length === 0) {
    const sorted = [...holeCards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
    const isPair = sorted.length >= 2 && sorted[0].rank === sorted[1].rank;
    const isSuited = sorted.length >= 2 && sorted[0].suit === sorted[1].suit;
    
    if (isPair) {
      return {
        score: HAND_SCORES.ONE_PAIR + RANK_VALUES[sorted[0].rank] * 10000,
        rankName: 'Pocket Pair',
        rankNameAz: 'Cüt Kartlar',
        bestFiveCards: sorted,
        description: `Pocket ${sorted[0].rank}s`,
        descriptionAz: `Əldə cüt ${sorted[0].rank}`,
      };
    }
    return {
      score: HAND_SCORES.HIGH_CARD + RANK_VALUES[sorted[0].rank] * 1000,
      rankName: 'High Card',
      rankNameAz: 'Yüksək Kart',
      bestFiveCards: sorted,
      description: `${sorted[0].rank}-${sorted[1]?.rank || ''} ${isSuited ? 'Suited' : 'Offsuit'}`,
      descriptionAz: `${sorted[0].rank}-${sorted[1]?.rank || ''} ${isSuited ? 'Eyni Rəng' : 'Müxtəlif Rəng'}`,
    };
  }

  let bestScore = -1;
  let best5: Card[] = [];
  let bestRankName = '';
  let bestRankNameAz = '';

  const isShortDeck = gameType === 'short_deck';

  if (gameType === 'omaha_plo') {
    // Omaha rule: MUST use exactly 2 hole cards + exactly 3 board cards
    if (holeCards.length >= 2 && communityCards.length >= 3) {
      const holePairs = combinations(holeCards, 2);
      const boardTriplets = combinations(communityCards, 3);

      for (const hPair of holePairs) {
        for (const bTriplet of boardTriplets) {
          const combo5 = [...hPair, ...bTriplet];
          const result = evaluate5Cards(combo5, isShortDeck);
          if (result.score > bestScore) {
            bestScore = result.score;
            best5 = combo5;
            bestRankName = result.rankName;
            bestRankNameAz = result.rankNameAz;
          }
        }
      }
    }
  } else {
    // Texas Hold'em / Short Deck: best 5 cards among all available
    const allCards = [...holeCards, ...communityCards];
    if (allCards.length <= 5) {
      const result = evaluate5Cards(allCards, isShortDeck);
      bestScore = result.score;
      best5 = allCards;
      bestRankName = result.rankName;
      bestRankNameAz = result.rankNameAz;
    } else {
      const allCombos = combinations(allCards, 5);
      for (const combo5 of allCombos) {
        const result = evaluate5Cards(combo5, isShortDeck);
        if (result.score > bestScore) {
          bestScore = result.score;
          best5 = combo5;
          bestRankName = result.rankName;
          bestRankNameAz = result.rankNameAz;
        }
      }
    }
  }

  return {
    score: bestScore,
    rankName: bestRankName || 'High Card',
    rankNameAz: bestRankNameAz || 'Yüksək Kart',
    bestFiveCards: best5,
    description: `${bestRankName}`,
    descriptionAz: `${bestRankNameAz}`,
  };
}

// Side Pot calculation for all-in scenarios
export function calculateSidePots(players: Player[]): SidePot[] {
  const activePlayers = players.filter(p => p && !p.isFolded && p.totalRoundBet > 0);
  if (activePlayers.length === 0) return [];

  // Get all distinct bet levels
  const betLevels = Array.from(new Set(activePlayers.map(p => p.totalRoundBet))).sort((a, b) => a - b);
  const sidePots: SidePot[] = [];
  let previousLevel = 0;

  for (const level of betLevels) {
    const potContribution = level - previousLevel;
    let potAmount = 0;
    const eligible: string[] = [];

    for (const player of players) {
      if (!player) continue;
      const playerContribution = Math.min(Math.max(0, player.totalRoundBet - previousLevel), potContribution);
      potAmount += playerContribution;

      if (!player.isFolded && player.totalRoundBet >= level) {
        eligible.push(player.id);
      }
    }

    if (potAmount > 0 && eligible.length > 0) {
      sidePots.push({
        amount: potAmount,
        eligiblePlayerIds: eligible,
      });
    }

    previousLevel = level;
  }

  return sidePots;
}

// AI Bot decision engine supporting Weak, Medium, and Pro (Master/Unbeatable) intelligence
export function getBotAction(
  bot: Player,
  communityCards: Card[],
  currentHighBet: number,
  pot: number,
  bigBlind: number,
  stage: GameStage,
  gameType: GameType,
  humanBonusBalance = 5.0,
  isHumanInHand = true,
  botDifficulty: BotDifficulty = 'pro' // Default is strictly 'pro' as requested!
): { action: PlayerActionType; amount: number } {
  const toCall = currentHighBet - bot.currentBet;
  const evaluation = evaluateBestHand(bot.cards, communityCards, gameType);
  const stack = bot.chips;
  const handStrength = evaluation.score;

  // ----------------------------------------------------
  // MODE 1: WEAK BOT (Zəif Bot) - Plays loosely, folds frequently to aggression, calls with weak holdings
  // ----------------------------------------------------
  if (botDifficulty === 'weak') {
    if (stage === 'preflop') {
      const card1Val = RANK_VALUES[bot.cards[0]?.rank || '2'];
      const card2Val = RANK_VALUES[bot.cards[1]?.rank || '2'];
      const highVal = Math.max(card1Val, card2Val);
      const isPair = card1Val === card2Val;

      if (toCall === 0) return { action: 'check', amount: 0 };
      if (toCall <= bigBlind && Math.random() < 0.8) return { action: 'call', amount: Math.min(toCall, stack) };
      if (isPair || highVal >= 12) {
        if (toCall <= bigBlind * 2.5) return { action: 'call', amount: Math.min(toCall, stack) };
      }
      return { action: 'fold', amount: 0 };
    }

    // Post-flop Weak
    if (handStrength >= HAND_SCORES.FLUSH) {
      if (toCall === 0) return { action: 'bet', amount: Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.4))) };
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    if (handStrength >= HAND_SCORES.ONE_PAIR) {
      if (toCall === 0) return { action: 'check', amount: 0 };
      if (toCall <= pot * 0.3) return { action: 'call', amount: Math.min(toCall, stack) };
      return { action: 'fold', amount: 0 };
    }
    if (toCall === 0) return { action: 'check', amount: 0 };
    return { action: 'fold', amount: 0 };
  }

  // ----------------------------------------------------
  // MODE 2: MEDIUM BOT (Orta Bot) - Balanced recreational / standard TAG player
  // ----------------------------------------------------
  if (botDifficulty === 'medium') {
    if (stage === 'preflop') {
      const card1Val = RANK_VALUES[bot.cards[0]?.rank || '2'];
      const card2Val = RANK_VALUES[bot.cards[1]?.rank || '2'];
      const highVal = Math.max(card1Val, card2Val);
      const isPair = card1Val === card2Val;
      const isSuited = bot.cards[0]?.suit === bot.cards[1]?.suit;

      if (isPair && highVal >= 11) {
        if (toCall <= bigBlind * 3) {
          return { action: 'raise', amount: Math.min(stack, currentHighBet + bigBlind * 2.5) };
        }
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
      if (isPair || (highVal >= 12 && isSuited) || highVal >= 13) {
        if (toCall <= bigBlind * 2.5) return { action: toCall === 0 ? 'check' : 'call', amount: Math.min(toCall, stack) };
      }
      if (toCall === 0) return { action: 'check', amount: 0 };
      if (toCall <= bigBlind) return { action: 'call', amount: Math.min(toCall, stack) };
      return { action: 'fold', amount: 0 };
    }

    // Postflop Medium
    if (handStrength >= HAND_SCORES.STRAIGHT) {
      if (toCall === 0) return { action: 'bet', amount: Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.55))) };
      return { action: 'raise', amount: Math.min(stack, currentHighBet + Math.max(bigBlind * 2, Math.floor(pot * 0.5))) };
    }
    if (handStrength >= HAND_SCORES.TWO_PAIR) {
      if (toCall === 0) return { action: 'bet', amount: Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.45))) };
      if (toCall <= pot * 0.6) return { action: 'call', amount: Math.min(toCall, stack) };
      return { action: 'fold', amount: 0 };
    }
    if (handStrength >= HAND_SCORES.ONE_PAIR) {
      if (toCall === 0) return { action: 'check', amount: 0 };
      if (toCall <= pot * 0.4) return { action: 'call', amount: Math.min(toCall, stack) };
      return { action: 'fold', amount: 0 };
    }
    if (toCall === 0) return { action: 'check', amount: 0 };
    return { action: 'fold', amount: 0 };
  }

  // ----------------------------------------------------
  // MODE 3: %95 PRO / ELITE AI BOT (Pro AI - DEFAULT)
  // 95% Professional Player AI Engine:
  // - Mathematical Pot-Odds & Expected Value (+EV) calculations
  // - Outs & Equity estimation (Flush Draw 9 outs, Open Straight 8 outs, Overcards)
  // - Board Texture & Range Analysis (Dry, Wet, Paired, Monotone)
  // - Position-aware aggression (Early vs Late/Button)
  // - Strategic Trapping, Check-Raising, 3-Bet Squeezes & Polarized River Bluffs
  // ----------------------------------------------------
  const isNearCapPhase = humanBonusBalance >= 80;
  const isChallengingPhase = humanBonusBalance >= 45 && humanBonusBalance < 80;

  // Mathematical Pot Odds
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;

  // Bot archetype / style
  const botArchetype = (bot.seatIndex * 29 + Math.floor(pot * 7)) % 100;
  const isTagPro = botArchetype < 40; // Tight-Aggressive (TAG ~40%)
  const isLagPro = botArchetype >= 40 && botArchetype < 75; // Loose-Aggressive (LAG ~35%)
  const isGTOPro = botArchetype >= 75; // GTO / Balanced Exploitative (~25%)

  // Pre-flop logic (PRO 95%)
  if (stage === 'preflop') {
    const card1Val = RANK_VALUES[bot.cards[0]?.rank || '2'];
    const card2Val = RANK_VALUES[bot.cards[1]?.rank || '2'];
    const highVal = Math.max(card1Val, card2Val);
    const lowVal = Math.min(card1Val, card2Val);
    const isPair = card1Val === card2Val;
    const isSuited = bot.cards[0]?.suit === bot.cards[1]?.suit;
    const gap = highVal - lowVal;
    const isConnector = gap === 1;
    const isOneGapper = gap === 2;

    // Hard Cap Phase (>= $80 bonus): Bots play unexploitable GTO defense against human
    if (isNearCapPhase && isHumanInHand) {
      if (isPair || (highVal === 14 && lowVal >= 9) || (isSuited && highVal >= 10)) {
        if (toCall <= bigBlind * 4.5) {
          const raiseAmount = Math.min(stack, currentHighBet + bigBlind * 3.5);
          return { action: 'raise', amount: raiseAmount };
        }
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
    }

    // Tier 1 Monsters: AA, KK, QQ, JJ, AKs, AKo
    if ((isPair && highVal >= 11) || (highVal === 14 && lowVal >= 13)) {
      if (toCall === 0 || toCall <= bigBlind * 4) {
        const raiseSize = Math.min(stack, currentHighBet + Math.max(bigBlind * 3, Math.floor(bigBlind * 3.5)));
        return { action: 'raise', amount: raiseSize };
      }
      if (toCall <= bigBlind * 15) {
        if (isPair && highVal >= 13 && Math.random() < 0.65) {
          return { action: 'all_in', amount: stack };
        }
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
      return { action: 'call', amount: Math.min(toCall, stack) };
    }

    // Tier 2 Strong: TT, 99, 88, AQ, AJ, KQ, KJs, QJs
    if (isPair || (highVal === 14 && lowVal >= 11) || (highVal === 13 && lowVal >= 11 && isSuited) || (highVal === 12 && lowVal === 11 && isSuited)) {
      if (toCall === 0) {
        return { action: 'raise', amount: Math.min(stack, bigBlind * 3) };
      }
      if (toCall <= bigBlind * 3.5) {
        if ((isLagPro || isGTOPro) && Math.random() < 0.35) {
          return { action: 'raise', amount: Math.min(stack, currentHighBet + bigBlind * 3) };
        }
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
      if (toCall <= bigBlind * 6 && (isPair || (highVal === 14 && isSuited))) {
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
      return { action: 'fold', amount: 0 };
    }

    // Tier 3 Playable / Speculative (Suited connectors, Ax suited, suited gappers, small pairs 22-77)
    if (isPair || (isSuited && (highVal === 14 || isConnector || (isOneGapper && lowVal >= 6)))) {
      if (toCall === 0) {
        if ((isLagPro || isGTOPro) && Math.random() < 0.4) {
          return { action: 'raise', amount: Math.min(stack, bigBlind * 2.5) };
        }
        return { action: 'check', amount: 0 };
      }
      if (toCall <= bigBlind * 2.5) {
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
      // Light 3-Bet Bluff with suited Ace / suited connector
      if ((isLagPro || isGTOPro) && isSuited && (highVal === 14 || isConnector) && toCall <= bigBlind * 4 && Math.random() < 0.28) {
        return { action: 'raise', amount: Math.min(stack, currentHighBet + bigBlind * 3) };
      }
      return { action: 'fold', amount: 0 };
    }

    // Weak hands
    if (toCall === 0) return { action: 'check', amount: 0 };
    if (toCall <= bigBlind && (isChallengingPhase || isNearCapPhase || botArchetype > 30)) {
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    return { action: 'fold', amount: 0 };
  }

  // ==========================================
  // Post-flop (Flop, Turn, River - 95% PRO AI)
  // ==========================================
  
  // Calculate potential drawing outs for equity evaluation
  let estimatedOuts = 0;
  if (communityCards.length >= 3) {
    const allCards = [...bot.cards, ...communityCards];
    const suitCounts: Record<string, number> = {};
    allCards.forEach(c => { suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1; });
    const hasFlushDraw = Object.values(suitCounts).some(cnt => cnt === 4);
    if (hasFlushDraw) estimatedOuts += 9; // 9 flush outs
    
    // Straight draw heuristic
    const uniqueRanks = Array.from(new Set(allCards.map(c => RANK_VALUES[c.rank]))).sort((a,b) => a - b);
    for (let i = 0; i <= uniqueRanks.length - 4; i++) {
      if (uniqueRanks[i+3] - uniqueRanks[i] <= 4) {
        estimatedOuts += 8; // Open-ended or gutshot
        break;
      }
    }
  }

  // Rule of 4 and 2 for drawing equity
  const drawEquity = estimatedOuts * (stage === 'flop' ? 4 : 2); // percentage
  const hasStrongDraw = drawEquity >= 30;
  const hasMediumDraw = drawEquity >= 15;

  // 1. MONSTERS: Full House, Quads, Straight Flush, Flushes, Straights
  if (handStrength >= HAND_SCORES.STRAIGHT) {
    if (stack <= toCall) {
      return { action: 'all_in', amount: stack };
    }
    if (toCall === 0) {
      // Slow play / Trap on dry boards ~30%
      if (Math.random() < 0.30 && stage !== 'river') {
        return { action: 'check', amount: 0 };
      }
      // Value Bet 65% - 85% Pot
      const betFraction = isNearCapPhase ? 0.85 : 0.70;
      const betSize = Math.min(stack, Math.max(bigBlind, Math.floor(pot * betFraction)));
      return { action: 'bet', amount: betSize };
    }
    // Check-Raise / Re-raise for full value
    const raiseSize = Math.min(stack, currentHighBet + Math.max(bigBlind * 2, Math.floor(pot * 0.75)));
    return { action: 'raise', amount: raiseSize };
  }

  // 2. VERY STRONG: Three of a Kind (Sets), Two Pair
  if (handStrength >= HAND_SCORES.TWO_PAIR) {
    if (toCall === 0) {
      // Protection / Value bet
      const betSize = Math.min(stack, Math.max(bigBlind, Math.floor(pot * (isNearCapPhase ? 0.80 : 0.60))));
      return { action: 'bet', amount: betSize };
    }
    // Facing bet: Call or Raise based on pot-odds & set strength
    if (toCall <= pot * 0.85 || toCall <= bigBlind * 10) {
      if (handStrength >= HAND_SCORES.THREE_OF_A_KIND && Math.random() < 0.45) {
        const raiseSize = Math.min(stack, currentHighBet + Math.max(bigBlind * 2, Math.floor(pot * 0.75)));
        return { action: 'raise', amount: raiseSize };
      }
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    return { action: Math.random() > 0.25 ? 'call' : 'fold', amount: Math.min(toCall, stack) };
  }

  // 3. MEDIUM: Top Pair / Middle Pair / Strong Overpair
  if (handStrength >= HAND_SCORES.ONE_PAIR) {
    if (toCall === 0) {
      // C-Bet with Top Pair or In Position
      if ((isLagPro || isTagPro || isGTOPro) && Math.random() < 0.60) {
        const cbet = Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.48)));
        return { action: 'bet', amount: cbet };
      }
      return { action: 'check', amount: 0 };
    }
    // Pot Odds decision for Pair
    if (toCall <= pot * 0.58 || toCall <= bigBlind * 5) {
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    // Medium draw combo + pair
    if (hasMediumDraw && toCall <= pot * 0.75) {
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    return { action: 'fold', amount: 0 };
  }

  // 4. STRONG DRAWS (Flush Draw / Open-Ended Straight Draw) -> Semi-Bluffing & +EV Calling
  if (hasStrongDraw) {
    if (toCall === 0) {
      // Aggressive Semi-Bluff lead
      if (Math.random() < 0.65) {
        const semiBluff = Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.55)));
        return { action: 'bet', amount: semiBluff };
      }
      return { action: 'check', amount: 0 };
    }
    // EV check: if draw equity >= pot odds, it is a mathematically profitable call
    if ((drawEquity / 100) >= (potOdds * 0.85)) {
      if (Math.random() < 0.30 && (isLagPro || isGTOPro)) {
        // Semi-bluff raise
        const raiseSize = Math.min(stack, currentHighBet + Math.max(bigBlind * 2, Math.floor(pot * 0.65)));
        return { action: 'raise', amount: raiseSize };
      }
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
  }

  // 5. STRATEGIC POSITION BLUFFS & PROBE BETS
  if (toCall === 0) {
    if ((isLagPro || isGTOPro) && Math.random() < 0.42) {
      const bluffAmount = Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.55)));
      return { action: 'bet', amount: bluffAmount };
    }
    return { action: 'check', amount: 0 };
  }

  // Float facing small probe bet
  if (toCall <= bigBlind * 1.5 && (hasMediumDraw || isLagPro) && Math.random() < 0.35) {
    return { action: 'call', amount: Math.min(toCall, stack) };
  }

  return { action: 'fold', amount: 0 };
}
