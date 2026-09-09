import { UserProfile, WalletTransaction } from '../types/poker';

export interface AdminPendingDeposit {
  id: string;
  userId?: string;
  username?: string;
  userEmail?: string;
  amount: number;
  currency: string;
  receiptName: string;
  receiptPreviewUrl?: string | null;
  receiptTimestamp?: number;
  createdAt: number;
  targetTimestamp?: number;
  reviewedAt?: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
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
  systemAnnouncement?: string;
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
  systemAnnouncement: '',
};

const DEFAULT_PLAYERS: UserProfile[] = [];

const DEFAULT_WITHDRAWALS: AdminWithdrawalRequest[] = [];

// Helper to filter out legacy mock/sample data
function isMockUserOrWithdrawal(id?: string): boolean {
  if (!id) return false;
  return id.startsWith('usr_poker_vip_') || id.startsWith('usr_201_') || id.startsWith('usr_202_') || id.startsWith('usr_203_') || id.startsWith('usr_204_') || id === 'wth_7812' || id === 'wth_7811';
}

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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // filter out mock users
          const clean = parsed.filter(p => !isMockUserOrWithdrawal(p.id));
          return clean;
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  saveRegisteredPlayers: (players: UserProfile[]) => {
    try {
      const clean = players.filter(p => !isMockUserOrWithdrawal(p.id));
      localStorage.setItem('royal_poker_all_players', JSON.stringify(clean));
    } catch {
      // ignore
    }
  },

  registerNewPlayer: (player: UserProfile) => {
    if (isMockUserOrWithdrawal(player.id)) return;
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
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(w => !isMockUserOrWithdrawal(w.id));
          return clean;
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  saveWithdrawals: (wths: AdminWithdrawalRequest[]) => {
    try {
      const clean = wths.filter(w => !isMockUserOrWithdrawal(w.id));
      localStorage.setItem('royal_poker_withdrawals', JSON.stringify(clean));
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

  addPendingDeposit: (deposit: AdminPendingDeposit) => {
    const deposits = adminStorage.getPendingDeposits();
    const filtered = deposits.filter((d) => d.id !== deposit.id);
    filtered.unshift(deposit);
    adminStorage.savePendingDeposits(filtered);
  },

  approveDepositEarly: (id: string): AdminPendingDeposit | null => {
    const deposits = adminStorage.getPendingDeposits();
    let targetDeposit: AdminPendingDeposit | null = null;
    const updated = deposits.map((d) => {
      if (d.id === id && (d.status === 'pending' || d.status === 'processing')) {
        targetDeposit = { ...d, status: 'completed' as const, reviewedAt: Date.now(), targetTimestamp: Date.now() };
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
    const updated = deposits.map((d) => (d.id === id ? { ...d, status: 'rejected' as const, reviewedAt: Date.now() } : d));
    adminStorage.savePendingDeposits(updated);
  },
};
