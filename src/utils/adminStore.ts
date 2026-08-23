import { UserProfile, WalletTransaction } from '../types/poker';

export interface AdminPendingDeposit {
  id: string;
  userId?: string;
  username?: string;
  amount: number;
  currency: string;
  receiptName: string;
  receiptPreviewUrl?: string | null;
  createdAt: number;
  targetTimestamp: number;
  status: 'processing' | 'completed' | 'rejected';
}

export interface AdminWithdrawalRequest {
  id: string;
  userId: string;
  username: string;
  cardNumber: string;
  bankName?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface SystemConfig {
  officialCardNumber: string;
  officialCardHolder: string;
  officialBank: string;
  minDeposit: number;
  maxDeposit: number;
  minWithdraw: number;
  maxWithdraw: number;
  welcomeBonusAmount: number;
  welcomeBonusDurationHours: number;
  welcomeBonusTurnoverTarget: number;
  depositDurationMinutes: number;
  isMaintenanceMode: boolean;
}

const DEFAULT_CONFIG: SystemConfig = {
  officialCardNumber: '5411 2498 1229 0497',
  officialCardHolder: 'ROYAL POKER OFFICIAL',
  officialBank: 'Kapital Bank / ABB / Visa Direct',
  minDeposit: 5,
  maxDeposit: 2500,
  minWithdraw: 15,
  maxWithdraw: 6000,
  welcomeBonusAmount: 5,
  welcomeBonusDurationHours: 48,
  welcomeBonusTurnoverTarget: 100,
  depositDurationMinutes: 3,
  isMaintenanceMode: false,
};

const DEFAULT_PLAYERS: UserProfile[] = [
  {
    id: 'usr_poker_vip_1',
    username: 'PokerMasterAZ',
    email: 'vip.player@pokerarena.pro',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    currency: 'USD',
    realBalance: 150.00,
    bonusBalance: 5.00,
    hasClaimedSpecialBonus: true,
    bonusQuestStartTime: Date.now() - 3600000 * 3,
    bonusTurnoverCompleted: false,
    playMoneyBalance: 50000,
    activeCurrencyMode: 'real',
    vipLevel: 3,
    vipXp: 1420,
    is2FAEnabled: false,
    totalHandsPlayed: 142,
    handsWon: 68,
    biggestPotWon: 1250,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'usr_201_elvin',
    username: 'Elvin_Baku',
    email: 'elvin.aliyev@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    currency: 'USD',
    realBalance: 320.50,
    bonusBalance: 0.00,
    hasClaimedSpecialBonus: true,
    bonusQuestStartTime: Date.now() - 86400000 * 2,
    bonusTurnoverCompleted: true,
    playMoneyBalance: 120000,
    activeCurrencyMode: 'real',
    vipLevel: 4,
    vipXp: 2850,
    is2FAEnabled: true,
    totalHandsPlayed: 420,
    handsWon: 198,
    biggestPotWon: 2800,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
  {
    id: 'usr_202_leyla',
    username: 'Leyla_PokerQueen',
    email: 'leyla.m@mail.ru',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    currency: 'USD',
    realBalance: 75.00,
    bonusBalance: 5.00,
    hasClaimedSpecialBonus: true,
    bonusQuestStartTime: Date.now() - 3600000 * 10,
    bonusTurnoverCompleted: false,
    playMoneyBalance: 35000,
    activeCurrencyMode: 'real',
    vipLevel: 2,
    vipXp: 620,
    is2FAEnabled: false,
    totalHandsPlayed: 88,
    handsWon: 36,
    biggestPotWon: 450,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'usr_203_rashad',
    username: 'Rashad_Shark',
    email: 'rashad99@box.az',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    currency: 'USD',
    realBalance: 1250.00,
    bonusBalance: 0.00,
    hasClaimedSpecialBonus: true,
    bonusQuestStartTime: Date.now() - 86400000 * 15,
    bonusTurnoverCompleted: true,
    playMoneyBalance: 850000,
    activeCurrencyMode: 'real',
    vipLevel: 6,
    vipXp: 9400,
    is2FAEnabled: true,
    totalHandsPlayed: 1240,
    handsWon: 610,
    biggestPotWon: 7400,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'usr_204_aysel',
    username: 'Aysel_VIP',
    email: 'aysel.h@yahoo.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    currency: 'USD',
    realBalance: 50.00,
    bonusBalance: 5.00,
    hasClaimedSpecialBonus: true,
    bonusQuestStartTime: Date.now() - 3600000 * 1,
    bonusTurnoverCompleted: false,
    playMoneyBalance: 18000,
    activeCurrencyMode: 'real',
    vipLevel: 1,
    vipXp: 110,
    is2FAEnabled: false,
    totalHandsPlayed: 25,
    handsWon: 11,
    biggestPotWon: 210,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

const DEFAULT_WITHDRAWALS: AdminWithdrawalRequest[] = [
  {
    id: 'wth_7812',
    userId: 'usr_201_elvin',
    username: 'Elvin_Baku',
    cardNumber: '4169 7388 9912 3456',
    bankName: 'Kapital Bank (BirBank)',
    amount: 120.00,
    currency: 'USD',
    status: 'pending',
    createdAt: Date.now() - 3600000 * 1.5,
  },
  {
    id: 'wth_7811',
    userId: 'usr_203_rashad',
    username: 'Rashad_Shark',
    cardNumber: '5102 8844 1239 8871',
    bankName: 'ABB Bank (TamKart)',
    amount: 500.00,
    currency: 'USD',
    status: 'approved',
    createdAt: Date.now() - 86400000 * 1.2,
  },
];

export const adminStorage = {
  getConfig: (): SystemConfig => {
    try {
      const saved = localStorage.getItem('royal_poker_system_config');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_CONFIG;
  },

  saveConfig: (cfg: SystemConfig) => {
    try {
      localStorage.setItem('royal_poker_system_config', JSON.stringify(cfg));
    } catch {
      // ignore
    }
  },

  getRegisteredPlayers: (): UserProfile[] => {
    try {
      const saved = localStorage.getItem('royal_poker_all_players');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PLAYERS;
  },

  saveRegisteredPlayers: (players: UserProfile[]) => {
    try {
      localStorage.setItem('royal_poker_all_players', JSON.stringify(players));
    } catch {
      // ignore
    }
  },

  registerNewPlayer: (player: UserProfile) => {
    const list = adminStorage.getRegisteredPlayers();
    const existingIndex = list.findIndex((p) => p.id === player.id || p.email === player.email);
    if (existingIndex >= 0) {
      list[existingIndex] = player;
    } else {
      list.unshift(player);
    }
    adminStorage.saveRegisteredPlayers(list);
  },

  updatePlayerBalance: (userId: string, newRealBalance: number, newBonusBalance?: number) => {
    const list = adminStorage.getRegisteredPlayers();
    const updated = list.map((p) => {
      if (p.id === userId) {
        return {
          ...p,
          realBalance: newRealBalance,
          bonusBalance: newBonusBalance !== undefined ? newBonusBalance : p.bonusBalance,
        };
      }
      return p;
    });
    adminStorage.saveRegisteredPlayers(updated);
  },

  getWithdrawals: (): AdminWithdrawalRequest[] => {
    try {
      const saved = localStorage.getItem('royal_poker_withdrawals');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_WITHDRAWALS;
  },

  saveWithdrawals: (wths: AdminWithdrawalRequest[]) => {
    try {
      localStorage.setItem('royal_poker_withdrawals', JSON.stringify(wths));
    } catch {
      // ignore
    }
  },

  addWithdrawalRequest: (req: AdminWithdrawalRequest) => {
    const list = adminStorage.getWithdrawals();
    list.unshift(req);
    adminStorage.saveWithdrawals(list);
  },

  updateWithdrawalStatus: (id: string, status: 'approved' | 'rejected') => {
    const list = adminStorage.getWithdrawals();
    const updated = list.map((w) => (w.id === id ? { ...w, status } : w));
    adminStorage.saveWithdrawals(updated);
  },

  getPendingDeposits: (): AdminPendingDeposit[] => {
    try {
      const saved = localStorage.getItem('royal_poker_pending_deposits');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  },

  savePendingDeposits: (deposits: AdminPendingDeposit[]) => {
    try {
      localStorage.setItem('royal_poker_pending_deposits', JSON.stringify(deposits));
    } catch {
      // ignore
    }
  },

  approveDepositEarly: (id: string): AdminPendingDeposit | null => {
    const deposits = adminStorage.getPendingDeposits();
    let targetDeposit: AdminPendingDeposit | null = null;
    const updated = deposits.map((d) => {
      if (d.id === id && d.status === 'processing') {
        targetDeposit = { ...d, status: 'completed' as const, targetTimestamp: Date.now() };
        return targetDeposit;
      }
      return d;
    });
    adminStorage.savePendingDeposits(updated);

    if (targetDeposit && (targetDeposit as AdminPendingDeposit).userId) {
      const dep = targetDeposit as AdminPendingDeposit;
      const players = adminStorage.getRegisteredPlayers();
      const player = players.find((p) => p.id === dep.userId || p.username === dep.username);
      if (player) {
        adminStorage.updatePlayerBalance(player.id, player.realBalance + dep.amount);
      }
    }

    return targetDeposit;
  },

  rejectDeposit: (id: string) => {
    const deposits = adminStorage.getPendingDeposits();
    const updated = deposits.map((d) => (d.id === id ? { ...d, status: 'rejected' as const } : d));
    adminStorage.savePendingDeposits(updated);
  },
};
