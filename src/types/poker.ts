export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export type GameType = 'texas_holdem' | 'omaha_plo' | 'short_deck' | 'mtt_tournament' | 'sit_and_go';
export type LimitType = 'no_limit' | 'pot_limit' | 'fixed_limit';
export type StakesTier = 'micro' | 'low' | 'mid' | 'high';
export type TableCapacity = 2 | 6 | 9;
export type FeltColor = 
  | 'emerald' 
  | 'sapphire' 
  | 'crimson' 
  | 'charcoal' 
  | 'midnight_blue' 
  | 'royal_velvet' 
  | 'cyber_neon' 
  | 'ruby_luxury' 
  | 'diamond_prestige' 
  | 'galactic_void' 
  | 'golden_mirage';

export type AvatarFrameId = 
  | 'default' 
  | 'silver_chrome' 
  | 'gold_ace' 
  | 'platinum_pulse' 
  | 'ruby_dragon' 
  | 'diamond_shimmer' 
  | 'obsidian_galaxy' 
  | 'crown_olympus';

export type GameStage = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'hand_ended';

export type PlayerActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | 'sit_out' | 'none';

export type BotDifficulty = 'weak' | 'medium' | 'pro';

export interface BotSystemConfig {
  isBotsActive: boolean; // Master toggle: true = active bots in tables, false = remove all bots from tables
  botDifficulty: BotDifficulty; // 'pro' by default as requested
  autoJoinLeaveEnabled: boolean;
  minThinkSeconds: number; // 4s
  maxThinkSeconds: number; // 9s
  targetTableOccupancy: number; // e.g. 3-4 players per table
  updatedAt?: number;
}

export type CurrencyType = 'USD' | 'EUR' | 'AZN' | 'USDT' | 'PLAY';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  chips: number;
  initialChips: number;
  currentBet: number;
  totalRoundBet: number;
  cards: Card[];
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  consecutiveMissedTurns?: number;
  isDisconnected: boolean;
  isHuman: boolean;
  seatIndex: number;
  lastAction?: {
    type: PlayerActionType;
    amount?: number;
    timestamp: number;
  };
  handRankScore?: number;
  handRankName?: string;
  bestFiveCards?: Card[];
  isWinner?: boolean;
  winAmount?: number;
  timeRemaining?: number; // seconds
  vipLevel: number;
  vipXp?: number;
  avatarFrame?: AvatarFrameId;
  selectedAvatarFrame?: AvatarFrameId;
  joinedAt?: number;
  sessionDurationMinutes?: number;
  willRebuyOnBust?: boolean;
  isThinking?: boolean;
}

export interface SidePot {
  amount: number;
  eligiblePlayerIds: string[];
}

export interface PokerTableState {
  id: string;
  name: string;
  gameType: GameType;
  limitType: LimitType;
  stakesTier: StakesTier;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  capacity: TableCapacity;
  timeBank: number; // 15 or 30 seconds
  isPrivate: boolean;
  passcode?: string;
  feltColor: FeltColor;
  
  // Active game state
  stage: GameStage;
  pot: number;
  sidePots: SidePot[];
  communityCards: Card[];
  currentTurnSeatIndex: number;
  dealerSeatIndex: number;
  smallBlindSeatIndex: number;
  bigBlindSeatIndex: number;
  currentHighBet: number;
  minRaise: number;
  players: (Player | null)[];
  handNumber: number;
  deck: Card[];
  handWinners: {
    playerId: string;
    amount: number;
    handName: string;
    winningCards: Card[];
  }[];
  
  // Table metadata
  avgPot: number;
  handsPerHour: number;
  createdById?: string;
  isCustomCreated?: boolean;
  updatedAt?: number;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  avatar: string;
  currency: CurrencyType;
  realBalance: number;
  bonusBalance?: number;
  hasClaimedSpecialBonus?: boolean;
  bonusQuestStartTime?: number; // timestamp when $5 bonus was claimed / registered
  bonusTurnoverCompleted?: boolean; // whether $100 turnover was achieved
  playMoneyBalance: number;
  activeCurrencyMode: 'real' | 'play';
  vipLevel: number;
  vipXp: number;
  selectedAvatarFrame?: AvatarFrameId;
  selectedFeltColor?: FeltColor;
  unlockedFrames?: AvatarFrameId[];
  unlockedFeltColors?: FeltColor[];
  is2FAEnabled: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  twoFactorSecret?: string;
  lastDepositApprovedAt?: number;
  lastDepositApprovedAmount?: number;
  totalHandsPlayed: number;
  handsWon: number;
  biggestPotWon: number;
  isSittingOut?: boolean;
  consecutiveMissedTurns?: number;
  createdAt: string;
}

export const GOLDEN_ACE_AVATAR = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FFF275"/><stop offset="50%" stop-color="%23F59E0B"/><stop offset="100%" stop-color="%23D97706"/></linearGradient><radialGradient id="bgGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%2327272a"/><stop offset="100%" stop-color="%2309090b"/></radialGradient></defs><circle cx="50" cy="50" r="47" fill="url(%23bgGrad)" stroke="url(%23goldGrad)" stroke-width="3"/><path d="M50 18 C46 28 32 36 32 46 C32 54 38 60 46 60 C48 60 49 59 50 58 C51 59 52 60 54 60 C62 60 68 54 68 46 C68 36 54 28 50 18 Z" fill="url(%23goldGrad)"/><path d="M47 58 L45 74 L55 74 L53 58 Z" fill="url(%23goldGrad)"/><text x="50" y="88" font-family="sans-serif" font-size="11" font-weight="900" fill="%23FBBF24" text-anchor="middle" letter-spacing="1">ADMIN</text><polygon points="50,9 52,14 56,14 53,17 54,21 50,19 46,21 47,17 44,14 48,14" fill="%23FDE047"/></svg>`;

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'buy_in' | 'cash_out' | 'bonus';
  amount: number;
  currency: CurrencyType;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  paymentMethod: string;
  txHash?: string;
}

export interface PlayerHandActionLog {
  playerId: string;
  playerName: string;
  avatar?: string;
  isHuman: boolean;
  seatIndex: number;
  isSmallBlind?: boolean;
  isBigBlind?: boolean;
  // Preflop metrics
  vpip: boolean; // Voluntarily Put $ in Pot preflop
  pfr: boolean;  // Pre-flop raise / bet
  // Street Action Counts
  flopBets: number;
  flopRaises: number;
  flopCalls: number;
  flopChecks: number;
  turnBets: number;
  turnRaises: number;
  turnCalls: number;
  turnChecks: number;
  riverBets: number;
  riverRaises: number;
  riverCalls: number;
  riverChecks: number;
  // Streets Reached
  sawFlop: boolean;
  sawTurn: boolean;
  sawRiver: boolean;
  sawShowdown: boolean;
  // Financials & Result
  invested: number;
  wonAmount: number;
  profit: number;
  isWinner: boolean;
  cards?: Card[];
}

export interface PlayerSessionStats {
  playerId: string;
  playerName: string;
  avatar?: string;
  isHuman: boolean;
  totalHands: number;
  vpipHands: number;
  pfrHands: number;
  vpipPercent: number;
  pfrPercent: number;
  totalPostflopBets: number;
  totalPostflopRaises: number;
  totalPostflopCalls: number;
  totalPostflopChecks: number;
  aggressionFactor: number;
  isAfInfinite?: boolean;
  aggressionFrequency: number;
  sawFlopCount: number;
  sawShowdownCount: number;
  wtsdPercent: number;
  handsWon: number;
  winRatePercent: number;
  netProfit: number;
  playerStyle: 'TAG' | 'LAG' | 'NIT' | 'FISH' | 'MANIAC' | 'BALANCED';
  styleLabel: string;
  styleDescription: string;
  streetBreakdown: {
    flop: { bets: number; raises: number; calls: number; checks: number; af: number };
    turn: { bets: number; raises: number; calls: number; checks: number; af: number };
    river: { bets: number; raises: number; calls: number; checks: number; af: number };
  };
}

export interface HandHistoryRecord {
  id: string;
  handNumber: number;
  tableName: string;
  gameType: GameType;
  blinds: string;
  pot: number;
  rake?: number;
  netPot?: number;
  communityCards: Card[];
  winners: {
    name: string;
    avatar: string;
    amount: number;
    handName: string;
    cards?: Card[];
  }[];
  playerCards: Card[];
  playerProfit: number;
  timestamp: number;
  playerActionLogs?: Record<string, PlayerHandActionLog>;
}

export interface TableRakeRecord {
  id: string;
  tableId?: string;
  tableName: string;
  gameType: GameType | string;
  handNumber: number;
  totalPot: number;
  rakePercent: number; // 10%
  rakeAmount: number; // 10% of pot
  netPotWon: number;
  winnerName: string;
  winnerAvatar?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  tableId?: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  message?: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface FloatingEmoji {
  id: string;
  seatIndex: number;
  emoji: string;
  timestamp: number;
}
