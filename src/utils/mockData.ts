import { PokerTableState, Player, Card, GameType, LimitType, StakesTier, TableCapacity, FeltColor } from '../types/poker';
import { createDeck } from './pokerEngine';

export const BOT_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517462964-21fdcec3f25b?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1528892952291-009c663ce843?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1546961329-78bef0414d7c?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150&auto=format&fit=crop&q=80',
];

export const BOT_NAMES = [
  'Tural',
  'Tərlan',
  'Turqut',
  'İxtiyar',
  'Aysel',
  'Firəngiz',
  'Murad',
  'Elvin',
  'Leyla',
  'Rəşad',
  'Nigar',
  'Nərmin',
  'Orxan',
  'Samir',
  'Cavid',
  'Günel',
  'Zaur',
  'Rauf',
  'Fərid',
  'Könül',
  'Əli',
  'Vüsal',
  'Şəbnəm',
  'İlqar',
  'Elnur',
  'Sevinc',
  'Anar',
  'Rüstəm',
  'Kamran',
  'Fuad',
  'Rəhim',
  'Nurlan',
  'Aygün',
  'Elmir',
  'Pərviz',
  'Xəyal',
  'Ceyhun',
  'Nicat',
  'Toğrul',
  'Səbinə',
  'Ləman',
  'Gülşən',
  'Ülviyyə',
  'Taleh',
  'Bəxtiyar',
  'Cəmil',
  'Vaqif',
  'Eldar',
  'Sənan',
  'Şahin',
  'Ayxan',
  'Ülvi',
  'Nail',
  'Mehman',
  'Elçin',
  'Yaqub',
  'Polad',
  'Zümrüd',
  'Günay',
  'Gülnar',
  'Səma',
  'Nərgiz',
  'Samirə',
  'Elmira',
  'Natiq',
  'Rasim',
  'Ziya',
  'Ruslan',
  'Məcid',
];

export function generateInitialTables(): PokerTableState[] {
  const tableDefinitions: {
    id: string;
    name: string;
    gameType: GameType;
    limitType: LimitType;
    stakesTier: StakesTier;
    smallBlind: number;
    bigBlind: number;
    capacity: TableCapacity;
    feltColor: FeltColor;
    avgPot: number;
    handsPerHour: number;
  }[] = [];

  const arenaPrefixes = [
    'Baku', 'Absheron', 'Caspian', 'Vegas', 'Monaco', 'Macau', 'Dubai', 'London',
    'Golden Sands', 'Royal Crown', 'Diamond', 'Silk Road', 'Flame Towers', 'Khazar',
    'VIP High Roller', 'Grand', 'Apex', 'Titan', 'Champion', 'Fortuna', 'Imperial',
    'Crystal', 'Emerald', 'Sapphire', 'Ruby', 'Platinum', 'Cosmopolitan', 'Mirage',
    'Bellagio', 'Wynn', 'Venetian', 'Borgata', 'Marina Bay', 'Sahara', 'Oasis'
  ];

  const gameTypes: { type: GameType; limit: LimitType; label: string }[] = [
    { type: 'texas_holdem', limit: 'no_limit', label: "NL Texas Hold'em" },
    { type: 'texas_holdem', limit: 'no_limit', label: "Turbo 6-Max" },
    { type: 'omaha_plo', limit: 'pot_limit', label: "PLO Omaha" },
    { type: 'short_deck', limit: 'no_limit', label: "Short Deck (6+)" },
    { type: 'sit_and_go', limit: 'no_limit', label: "Sit & Go" },
    { type: 'mtt_tournament', limit: 'no_limit', label: "Championship MTT" },
  ];

  const stakesConfig: { tier: StakesTier; sb: number; bb: number; felt: FeltColor }[] = [
    // Primary User Stakes: ($0.02/$0.04, $0.05/$0.10, $0.10/$0.20, $5.00/$10.00, $8.00/$16.00)
    { tier: 'micro', sb: 0.02, bb: 0.04, felt: 'emerald' },
    { tier: 'micro', sb: 0.05, bb: 0.10, felt: 'emerald' },
    { tier: 'low', sb: 0.10, bb: 0.20, felt: 'sapphire' },
    { tier: 'mid', sb: 5.00, bb: 10.00, felt: 'charcoal' },
    { tier: 'high', sb: 8.00, bb: 16.00, felt: 'crimson' },
    // Secondary variety stakes
    { tier: 'micro', sb: 0.02, bb: 0.04, felt: 'emerald' },
    { tier: 'micro', sb: 0.05, bb: 0.10, felt: 'emerald' },
    { tier: 'low', sb: 0.10, bb: 0.20, felt: 'sapphire' },
    { tier: 'mid', sb: 5.00, bb: 10.00, felt: 'charcoal' },
    { tier: 'high', sb: 8.00, bb: 16.00, felt: 'crimson' },
    { tier: 'low', sb: 0.50, bb: 1.00, felt: 'sapphire' },
    { tier: 'high', sb: 25.00, bb: 50.00, felt: 'crimson' },
  ];

  const capacities: TableCapacity[] = [6, 6, 6, 6, 6, 9, 6, 2, 6];

  let idCounter = 1;

  // Generate 210+ unique tables systematically covering all stakes and formats (primarily 6-Max)
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < arenaPrefixes.length; i++) {
      const prefix = arenaPrefixes[i];
      const gameConfig = gameTypes[(i + round) % gameTypes.length];
      const stake = stakesConfig[(i + round * 2) % stakesConfig.length];
      const capacity = capacities[(i + round) % capacities.length];

      const tableName = round === 0
        ? `${prefix} ${capacity === 6 ? '6-Max ' : ''}${gameConfig.label}`
        : `${prefix} ${capacity === 6 ? '6-Max ' : ''}VIP #${idCounter}`;

      const avgPot = Math.round(stake.bb * (12 + ((i * 5) % 20)));
      const handsPerHour = 55 + ((i * 7) % 40);

      tableDefinitions.push({
        id: `tbl_${idCounter}`,
        name: tableName,
        gameType: gameConfig.type,
        limitType: gameConfig.limit,
        stakesTier: stake.tier,
        smallBlind: stake.sb,
        bigBlind: stake.bb,
        capacity,
        feltColor: stake.felt,
        avgPot,
        handsPerHour,
      });

      idCounter++;
    }
  }

  return tableDefinitions.map((def) => createPopulatedTable(def));
}

export function createBotPlayer(
  seatIndex: number,
  tableId: string,
  bigBlind: number,
  gameType: GameType,
  deck?: Card[],
  forcedDurationMinutes?: number,
  existingPlayers?: (Player | null)[]
): Player {
  const cardsPerPlayer = gameType === 'omaha_plo' ? 4 : 2;
  const dealt: Card[] = [];
  if (deck) {
    for (let c = 0; c < cardsPerPlayer; c++) {
      if (deck.length > 0) dealt.push(deck.pop()!);
    }
  }

  // Filter out any name or avatar already in use by another player
  const usedNames = new Set(
    existingPlayers?.filter((p): p is Player => p !== null).map((p) => p.name) || []
  );
  const usedAvatars = new Set(
    existingPlayers?.filter((p): p is Player => p !== null).map((p) => p.avatar) || []
  );

  const availableNames = BOT_NAMES.filter((n) => !usedNames.has(n));
  const availableAvatars = BOT_AVATARS.filter((a) => !usedAvatars.has(a));

  const botName = availableNames.length > 0
    ? availableNames[Math.floor(Math.random() * availableNames.length)]
    : BOT_NAMES[seatIndex % BOT_NAMES.length];

  const botAvatar = availableAvatars.length > 0
    ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
    : BOT_AVATARS[seatIndex % BOT_AVATARS.length];

  const initialChips = bigBlind * (50 + Math.floor(Math.random() * 50)); // 50 to 100 BB

  // Session duration logic:
  let durationMinutes = forcedDurationMinutes;
  if (!durationMinutes) {
    const rand = Math.random();
    if (rand < 0.35) {
      durationMinutes = 2 + Math.floor(Math.random() * 4); // 2-5 mins
    } else if (rand < 0.70) {
      durationMinutes = 10 + Math.floor(Math.random() * 25); // 10-35 mins
    } else {
      durationMinutes = 45 + Math.floor(Math.random() * 75); // 45-120 mins (2 hours)
    }
  }

  // 50% will rebuy when chips run out, 50% will leave the table
  const willRebuyOnBust = Math.random() < 0.5;

  return {
    id: `bot_${tableId}_${seatIndex}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: botName,
    avatar: botAvatar,
    chips: initialChips,
    initialChips,
    currentBet: 0,
    totalRoundBet: 0,
    cards: dealt,
    isFolded: false,
    isAllIn: false,
    isSittingOut: false,
    isDisconnected: false,
    isHuman: false,
    seatIndex,
    vipLevel: Math.floor(1 + Math.random() * 4),
    joinedAt: Date.now(),
    sessionDurationMinutes: durationMinutes,
    willRebuyOnBust,
  };
}

export function createPopulatedTable(def: {
  id: string;
  name: string;
  gameType: GameType;
  limitType: LimitType;
  stakesTier: StakesTier;
  smallBlind: number;
  bigBlind: number;
  capacity: TableCapacity;
  feltColor: FeltColor;
  avgPot?: number;
  handsPerHour?: number;
  passcode?: string;
  isCustomCreated?: boolean;
}): PokerTableState {
  const deck = createDeck(def.gameType);
  const players: (Player | null)[] = new Array(def.capacity).fill(null);

  // If custom created, table starts completely empty for the creator to join alone
  if (def.isCustomCreated) {
    return {
      id: def.id,
      name: def.name,
      gameType: def.gameType,
      limitType: def.limitType,
      stakesTier: def.stakesTier,
      smallBlind: def.smallBlind,
      bigBlind: def.bigBlind,
      minBuyIn: def.bigBlind * 20,
      maxBuyIn: def.bigBlind * 100,
      capacity: def.capacity,
      timeBank: 15,
      isPrivate: Boolean(def.passcode),
      passcode: def.passcode,
      feltColor: def.feltColor,
      stage: 'waiting',
      pot: 0,
      sidePots: [],
      communityCards: [],
      currentTurnSeatIndex: 0,
      dealerSeatIndex: 0,
      smallBlindSeatIndex: 0,
      bigBlindSeatIndex: 1,
      currentHighBet: 0,
      minRaise: def.bigBlind,
      players,
      handNumber: 1,
      deck,
      handWinners: [],
      avgPot: def.avgPot || def.bigBlind * 25,
      handsPerHour: def.handsPerHour || 75,
      isCustomCreated: true,
    };
  }

  // Populate opponents (bots) leaving seat 0 open for human
  const numBots = def.capacity === 2 ? 1 : def.capacity === 6 ? 4 : 6;

  for (let i = 1; i <= numBots; i++) {
    players[i] = createBotPlayer(i, def.id, def.bigBlind, def.gameType, deck, undefined, players);
  }

  return {
    id: def.id,
    name: def.name,
    gameType: def.gameType,
    limitType: def.limitType,
    stakesTier: def.stakesTier,
    smallBlind: def.smallBlind,
    bigBlind: def.bigBlind,
    minBuyIn: def.bigBlind * 20,
    maxBuyIn: def.bigBlind * 100,
    capacity: def.capacity,
    timeBank: 15,
    isPrivate: Boolean(def.passcode),
    passcode: def.passcode,
    feltColor: def.feltColor,
    stage: 'waiting',
    pot: 0,
    sidePots: [],
    communityCards: [],
    currentTurnSeatIndex: 0,
    dealerSeatIndex: 1,
    smallBlindSeatIndex: 1,
    bigBlindSeatIndex: 2,
    currentHighBet: 0,
    minRaise: def.bigBlind,
    players,
    handNumber: 1,
    deck,
    handWinners: [],
    avgPot: def.avgPot || def.bigBlind * 25,
    handsPerHour: def.handsPerHour || 75,
    isCustomCreated: false,
  };
}
