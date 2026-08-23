import { Card, Suit, Rank, Player, GameType, GameStage, SidePot, PlayerActionType } from '../types/poker';

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

// AI Bot decision engine with realistic poker styles and adaptive bonus progression intelligence
export function getBotAction(
  bot: Player,
  communityCards: Card[],
  currentHighBet: number,
  pot: number,
  bigBlind: number,
  stage: GameStage,
  gameType: GameType,
  humanBonusBalance = 5.0,
  isHumanInHand = true
): { action: PlayerActionType; amount: number } {
  const toCall = currentHighBet - bot.currentBet;
  const evaluation = evaluateBestHand(bot.cards, communityCards, gameType);
  const stack = bot.chips;

  // Dynamic Adaptive Bot Difficulty based on Human Bonus progression:
  // Phase 1 ($5 to <$60): 80% winning chance for human (bots play softer/looser, fold to human bets)
  // Phase 2 ($60 to $85+): Bots become 70% stronger, tighter & aggressive, preventing easy crossing of $85 cap
  const isSoftPhase = humanBonusBalance < 60;
  const isHardPhase = humanBonusBalance >= 60;
  const isHardCapPhase = humanBonusBalance >= 80; // Extra tight defense near $85

  // Bot personality noise factor
  const aggressionSeed = (bot.seatIndex * 17 + Math.floor(pot)) % 100;
  const isAggressive = isHardPhase ? aggressionSeed > 35 : aggressionSeed > 75;

  // Pre-flop logic
  if (stage === 'preflop') {
    const card1Val = RANK_VALUES[bot.cards[0]?.rank || '2'];
    const card2Val = RANK_VALUES[bot.cards[1]?.rank || '2'];
    const highVal = Math.max(card1Val, card2Val);
    const isPair = card1Val === card2Val;
    const isSuited = bot.cards[0]?.suit === bot.cards[1]?.suit;

    // In Soft Phase (<$60 bonus): bots fold non-premium hands easily to human raises (80% human win chance support)
    if (isSoftPhase && isHumanInHand && toCall > bigBlind * 2.5) {
      // Unless bot holds AA or KK, fold 80% of the time to human preflop aggression
      if (!(isPair && highVal >= 13)) {
        if (Math.random() < 0.80) {
          return { action: 'fold', amount: 0 };
        }
      }
    }

    // In Hard Phase (>= $60 bonus): bots defend aggressively and 3-bet
    if (isHardPhase) {
      // 3-bet / re-raise with broadway or pairs
      if (isPair && highVal >= 10 || (highVal === 14 && card1Val + card2Val >= 25)) {
        if (toCall <= bigBlind * 4) {
          const raiseAmount = Math.min(stack, currentHighBet + bigBlind * 3.5);
          return { action: 'raise', amount: raiseAmount };
        }
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
    }

    // Premium hands: AA, KK, QQ, JJ, AK
    if ((isPair && highVal >= 11) || (highVal === 14 && card1Val + card2Val >= 27)) {
      if (toCall === 0 || toCall <= bigBlind * 3) {
        const raiseAmount = Math.min(stack, currentHighBet + bigBlind * (isAggressive ? 3 : 2));
        return { action: 'raise', amount: raiseAmount };
      }
      return { action: 'call', amount: Math.min(toCall, stack) };
    }

    // Medium hands: TT, 99, 88, AQ, AJ, KQ, suited connectors
    if (isPair || (highVal >= 12 && isSuited) || (highVal >= 13)) {
      if (toCall <= bigBlind * 3) {
        return { action: toCall === 0 ? 'check' : 'call', amount: Math.min(toCall, stack) };
      }
      return { action: 'fold', amount: 0 };
    }

    // Weak hands
    if (toCall === 0) {
      return { action: 'check', amount: 0 };
    }
    if (toCall <= bigBlind && (isHardPhase || aggressionSeed > 40)) {
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    return { action: 'fold', amount: 0 };
  }

  // Post-flop logic (Flop, Turn, River)
  const handStrength = evaluation.score;

  // Soft Phase (<$60 bonus) post-flop adjustments:
  if (isSoftPhase && isHumanInHand) {
    // If facing human bet/raise and bot does not have monster, fold 80% of the time
    if (toCall > 0 && handStrength < HAND_SCORES.THREE_OF_A_KIND) {
      if (Math.random() < 0.78) {
        return { action: 'fold', amount: 0 };
      }
    }
    // If human checked, bot checks back generously with weak/medium hands to give free card
    if (toCall === 0 && handStrength < HAND_SCORES.TWO_PAIR) {
      return { action: 'check', amount: 0 };
    }
  }

  // Hard Phase (>= $60 bonus) post-flop adjustments (70% stronger, sharp value bets and tough calls):
  if (isHardPhase && isHumanInHand) {
    // Sharp check-raise or value bet with Two Pair+
    if (handStrength >= HAND_SCORES.TWO_PAIR) {
      if (toCall === 0) {
        const betSize = Math.min(stack, Math.max(bigBlind, Math.floor(pot * (isHardCapPhase ? 0.75 : 0.6))));
        return { action: 'bet', amount: betSize };
      }
      if (handStrength >= HAND_SCORES.THREE_OF_A_KIND) {
        const raiseSize = Math.min(stack, currentHighBet + Math.max(bigBlind * 2, Math.floor(pot * 0.7)));
        return { action: 'raise', amount: raiseSize };
      }
      return { action: 'call', amount: Math.min(toCall, stack) };
    }

    // Call down bluffs with Top Pair / Good Pair
    if (handStrength >= HAND_SCORES.ONE_PAIR) {
      if (toCall <= pot * 0.65 || toCall <= bigBlind * 6) {
        return { action: 'call', amount: Math.min(toCall, stack) };
      }
    }
  }

  // Monsters: Full house, Quads, Straight Flush, Flushes
  if (handStrength >= HAND_SCORES.STRAIGHT) {
    if (stack <= toCall) {
      return { action: 'all_in', amount: stack };
    }
    if (toCall === 0) {
      const betSize = Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.6)));
      return { action: 'bet', amount: betSize };
    }
    const raiseSize = Math.min(stack, currentHighBet + Math.max(bigBlind * 2, Math.floor(pot * 0.5)));
    return { action: 'raise', amount: raiseSize };
  }

  // Strong: Three of a kind, Two Pair
  if (handStrength >= HAND_SCORES.TWO_PAIR) {
    if (toCall === 0) {
      if (isAggressive && Math.random() > 0.4) {
        const betSize = Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.4)));
        return { action: 'bet', amount: betSize };
      }
      return { action: 'check', amount: 0 };
    }
    if (toCall <= pot * 0.6 || toCall <= bigBlind * 5) {
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    return { action: Math.random() > 0.5 ? 'call' : 'fold', amount: Math.min(toCall, stack) };
  }

  // Medium: Top Pair / Middle Pair
  if (handStrength >= HAND_SCORES.ONE_PAIR) {
    if (toCall === 0) {
      return { action: 'check', amount: 0 };
    }
    if (toCall <= pot * 0.35 || toCall <= bigBlind * 2) {
      return { action: 'call', amount: Math.min(toCall, stack) };
    }
    return { action: 'fold', amount: 0 };
  }

  // Bluff opportunity on River / Flop
  if (toCall === 0) {
    if (isAggressive && Math.random() < 0.25) {
      const bluffAmount = Math.min(stack, Math.max(bigBlind, Math.floor(pot * 0.5)));
      return { action: 'bet', amount: bluffAmount };
    }
    return { action: 'check', amount: 0 };
  }

  // High card facing bet
  return { action: 'fold', amount: 0 };
}
