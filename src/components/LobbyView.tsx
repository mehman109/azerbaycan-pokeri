import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  GameType, 
  LimitType, 
  StakesTier, 
  TableCapacity, 
  PokerTableState, 
  UserProfile,
  FeltColor,
  Player
} from '../types/poker';
import { translations, Language } from '../utils/translations';
import { soundManager } from '../utils/audioEngine';
import { 
  Play, 
  Eye, 
  Plus, 
  Sparkles, 
  Users, 
  Flame, 
  Trophy, 
  SlidersHorizontal, 
  Filter, 
  Layers, 
  Zap, 
  TrendingUp,
  Gift,
  Clock,
  Coins,
  LogOut,
  ShieldCheck,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Check
} from 'lucide-react';

interface LobbyViewProps {
  user: UserProfile | null;
  lang: Language;
  onJoinTable: (table: PokerTableState, observeOnly?: boolean) => void;
  onOpenCreateTable: () => void;
  onOpenAdminPanel?: () => void;
  onOpenAuth: () => void;
  onLogout?: () => void;
  tables: PokerTableState[];
}

export type SortField = 'stakes' | 'gameType' | 'capacity' | 'players' | 'avgPot' | 'name';
export type SortDirection = 'asc' | 'desc';

export const LobbyView: React.FC<LobbyViewProps> = ({
  user,
  lang,
  onJoinTable,
  onOpenCreateTable,
  onOpenAdminPanel,
  onOpenAuth,
  onLogout,
  tables,
}) => {
  const t = translations[lang];
  const isAdmin = user && (user.isAdmin || user.username === 'ADMIN');

  // Daily deterministic base count (different count each day)
  const getDailyBaseCount = () => {
    const today = new Date();
    const dayCode = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    const hash = Math.sin(dayCode) * 10000;
    const offset = Math.floor((hash - Math.floor(hash)) * 1200);
    return 1350 + offset; // e.g. 1350 to 2550 players depending on the day
  };

  // Live fluctuating online player count (every 3 to 5 seconds)
  const [onlineCount, setOnlineCount] = useState<number>(getDailyBaseCount);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const scheduleNextFluctuation = () => {
      // 3 to 5 seconds
      const delay = 3000 + Math.floor(Math.random() * 2000);
      timeoutId = setTimeout(() => {
        setOnlineCount((prev) => {
          const delta = Math.floor(Math.random() * 7) - 3; // -3 to +3
          const base = getDailyBaseCount();
          const next = prev + delta;
          if (Math.abs(next - base) > 30) {
            return prev - delta;
          }
          return next;
        });
        scheduleNextFluctuation();
      }, delay);
    };

    scheduleNextFluctuation();
    return () => clearTimeout(timeoutId);
  }, []);

  // Filters State
  const [selectedGameType, setSelectedGameType] = useState<GameType | 'all'>('all');
  const [selectedLimit, setSelectedLimit] = useState<LimitType | 'all'>('all');
  const [selectedStakes, setSelectedStakes] = useState<StakesTier | 'all'>('all');
  const [selectedCapacity, setSelectedCapacity] = useState<TableCapacity | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hideFullTables, setHideFullTables] = useState<boolean>(false);
  const [onlyActiveTables, setOnlyActiveTables] = useState<boolean>(false);

  // Sorting State (Stakes, Game Type, Capacity, Players, Avg Pot, Name)
  const [sortField, setSortField] = useState<SortField>('stakes');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    soundManager.playButtonClick();
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Sensible defaults
      if (field === 'stakes' || field === 'players' || field === 'avgPot' || field === 'capacity') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const getGameTypeLabel = (gt: GameType) => {
    switch (gt) {
      case 'texas_holdem': return "Texas Hold'em";
      case 'omaha_plo': return 'Omaha (PLO)';
      case 'short_deck': return 'Short Deck (6+)';
      case 'mtt_tournament': return 'Tournament (MTT)';
      case 'sit_and_go': return 'Sit & Go';
    }
  };

  // Filter & Sort Tables
  const filteredAndSortedTables = useMemo(() => {
    return tables
      .filter((table) => {
        if (selectedGameType !== 'all' && table.gameType !== selectedGameType) return false;
        if (selectedLimit !== 'all' && table.limitType !== selectedLimit) return false;
        if (selectedStakes !== 'all' && table.stakesTier !== selectedStakes) return false;
        if (selectedCapacity !== 'all' && table.capacity !== selectedCapacity) return false;

        const activeCount = table.players.filter((p) => p !== null).length;
        if (hideFullTables && activeCount >= table.capacity) return false;
        if (onlyActiveTables && activeCount === 0) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = table.name.toLowerCase().includes(q);
          const matchStakes = `$${table.smallBlind}/$${table.bigBlind}`.includes(q) || String(table.bigBlind).includes(q);
          const matchGame = getGameTypeLabel(table.gameType).toLowerCase().includes(q);
          if (!matchName && !matchStakes && !matchGame) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        switch (sortField) {
          case 'stakes':
            diff = a.bigBlind - b.bigBlind;
            break;
          case 'gameType':
            diff = a.gameType.localeCompare(b.gameType);
            break;
          case 'capacity':
            diff = a.capacity - b.capacity;
            break;
          case 'players': {
            const countA = a.players.filter((p) => p !== null).length;
            const countB = b.players.filter((p) => p !== null).length;
            diff = countA - countB;
            break;
          }
          case 'avgPot':
            diff = a.avgPot - b.avgPot;
            break;
          case 'name':
            diff = a.name.localeCompare(b.name);
            break;
          default:
            diff = 0;
        }

        return sortDirection === 'asc' ? diff : -diff;
      });
  }, [
    tables,
    selectedGameType,
    selectedLimit,
    selectedStakes,
    selectedCapacity,
    hideFullTables,
    onlyActiveTables,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  // Active showcase tables: Prioritize 6-Max tables with active players for scrollable showcase
  const activeShowcaseTables = useMemo(() => {
    return [...tables]
      .sort((a, b) => {
        // 1. Put 6-Max tables with active players at the front
        const a6 = a.capacity === 6 ? 1 : 0;
        const b6 = b.capacity === 6 ? 1 : 0;
        if (b6 !== a6) return b6 - a6;

        // 2. Active player count
        const countA = a.players.filter((p) => p !== null).length;
        const countB = b.players.filter((p) => p !== null).length;
        return countB - countA;
      })
      .slice(0, 16);
  }, [tables]);

  // Dynamically calculated active tables based on online player count
  const activeTablesCalculated = Math.round(onlineCount / 6.5);

  // Live real-time clock for second-by-second countdown (48h quest)
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate 48-Hour Bonus Turnover live countdown timer
  const questStart = user?.bonusQuestStartTime || currentTime;
  const questDurationMs = 48 * 3600 * 1000;
  const remainingQuestMs = Math.max(0, questStart + questDurationMs - currentTime);
  const isQuestExpired = remainingQuestMs <= 0;

  const totalQuestSecs = Math.floor(remainingQuestMs / 1000);
  const questHours = Math.floor(totalQuestSecs / 3600);
  const questMins = Math.floor((totalQuestSecs % 3600) / 60);
  const questSecs = totalQuestSecs % 60;
  const padZero = (n: number) => String(n).padStart(2, '0');
  const questClockStr = `${padZero(questHours)}:${padZero(questMins)}:${padZero(questSecs)}`;
  const questTimeStr = lang === 'az'
    ? `${questHours} saat ${questMins} dəq ${questSecs} san qaldı`
    : `${questHours}h ${questMins}m ${questSecs}s left`;

  // Quick Seat: Automatically finds the best available active table
  const handleQuickSeat = () => {
    soundManager.playButtonClick();
    if (!user) {
      onOpenAuth();
      return;
    }
    const available = filteredAndSortedTables.find((tbl) => {
      const activeCount = tbl.players.filter((p) => p !== null).length;
      return activeCount < tbl.capacity;
    }) || filteredAndSortedTables[0] || tables[0];

    if (available) {
      onJoinTable(available);
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-400 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-400 font-bold" />
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* ADMIN EXCLUSIVE QUICK CONTROL BANNER */}
      {isAdmin && onOpenAdminPanel && (
        <div className="bg-gradient-to-r from-amber-950/90 via-zinc-900 to-amber-950/90 border-2 border-amber-400/60 rounded-2xl p-4 shadow-2xl shadow-amber-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-left w-full sm:w-auto">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-lg flex items-center justify-center text-zinc-950 font-black shrink-0">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm sm:text-base font-black text-amber-300 tracking-wide uppercase">
                  Salam, Baş Admin! 👑
                </span>
                <span className="text-[10px] bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded-full uppercase">
                  Sistem Aktivdir
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                Bütün oyunçuları, qeydiyyatları, depozit çeklərini, balansları və kassa parametrlərini idarə edin.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playButtonClick();
              onOpenAdminPanel();
            }}
            id="lobby_open_admin_panel_btn"
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center space-x-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
            <span>İdarəetmə Panelini Aç</span>
          </button>
        </div>
      )}

      {/* Top Banner Stats & Bad Beat Jackpot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bad Beat Jackpot Banner */}
        <div className="bg-gradient-to-r from-amber-950/80 via-zinc-900 to-amber-950/80 border border-amber-500/50 rounded-2xl p-4 shadow-xl flex items-center justify-between relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="space-y-1.5 relative z-10 pr-2">
            <div className="flex items-center space-x-1.5 text-amber-400 text-[11px] font-bold uppercase tracking-wider">
              <Flame className="w-3.5 h-3.5 fill-current text-amber-400" />
              <span>Bad Beat Jackpot</span>
            </div>
            <div className="text-sm sm:text-base md:text-lg font-black tracking-wider uppercase font-serif drop-shadow-[0_2px_10px_rgba(245,158,11,0.6)] bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              ROYAL FLOS EDƏN OYUNCULAR ÜÇÜN!
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-amber-400/95 font-medium">
              <span className="font-mono font-black text-xs text-yellow-300 bg-amber-500/25 px-1.5 py-0.5 rounded-md border border-amber-400/40 shadow-sm shadow-amber-500/20">
                $1,000
              </span>
              <span className="text-amber-200/90 text-[11px] font-semibold">{lang === 'az' ? 'Xüsusi Qızıl Mükafat Fondu' : 'Exclusive Golden Prize Pool'}</span>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/30 to-yellow-400/20 border border-amber-400/50 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 shrink-0">
            👑
          </div>
        </div>

        {/* Live Traffic */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Zap className="w-4 h-4" />
              <span>{lang === 'az' ? 'Canlı Fəallıq' : 'Live Action'}</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono flex items-baseline space-x-2">
              <span>{onlineCount.toLocaleString()}</span>
              <span className="text-xs font-normal text-zinc-400 font-sans">{lang === 'az' ? 'Oyunçu onlayn' : 'Players online'}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Active Live Tables Showcase */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 sm:p-3.5 shadow-xl flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>{lang === 'az' ? 'Aktiv Oyun Masaları' : 'Active Poker Tables'}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                {lang === 'az' ? '🔥 6-Max Seçimlər' : '🔥 6-Max Picks'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeTablesCalculated} {lang === 'az' ? 'aktiv masa' : 'active tables'}</span>
              </span>
            </div>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[160px] sm:max-h-[175px] pr-1 scrollbar-thin scrollbar-thumb-zinc-750 scrollbar-track-zinc-950/40 hover:scrollbar-thumb-amber-500/50 transition-colors">
            {activeShowcaseTables.map((tbl) => {
              const activeCount = tbl.players.filter((p) => p !== null).length;
              const activePlayers = tbl.players.filter((p): p is Player => p !== null);
              const is6Max = tbl.capacity === 6;
              return (
                <div
                  key={tbl.id}
                  className="bg-zinc-950/85 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 rounded-xl p-2 flex items-center justify-between transition-all group shadow-sm"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-white truncate max-w-[95px] sm:max-w-[125px]">
                        {tbl.name}
                      </span>
                      {is6Max && (
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 shrink-0">
                          6-MAX
                        </span>
                      )}
                      <span className="text-[10px] text-amber-400 font-mono font-bold">
                        ${tbl.smallBlind}/${tbl.bigBlind}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="flex -space-x-1 overflow-hidden">
                        {activePlayers.slice(0, 3).map((p, pIdx) => (
                          <img
                            key={pIdx}
                            src={p.avatar}
                            alt={p.name}
                            className="w-4 h-4 rounded-full border border-zinc-900 object-cover"
                          />
                        ))}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {activeCount}/{tbl.capacity} {lang === 'az' ? 'oyunçu' : 'players'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      soundManager.playButtonClick();
                      if (!user) {
                        onOpenAuth();
                        return;
                      }
                      onJoinTable(tbl);
                    }}
                    id={`active_top_table_join_${tbl.id}`}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-zinc-950 rounded-lg text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer shrink-0 flex items-center space-x-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{lang === 'az' ? 'Giriş et' : 'Join'}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-zinc-500 text-center font-medium flex items-center justify-center space-x-1 pt-0.5">
            <span>↕️ {lang === 'az' ? 'Aşağı sürüşdürərək digər masalara baxın və giriş edin' : 'Scroll down to explore and join more tables'}</span>
          </div>
        </div>
      </div>

      {/* 48-Hour $100 Turnover Challenge Banner */}
      {user && !user.bonusTurnoverCompleted && !isQuestExpired && (
        <div className="bg-gradient-to-r from-amber-950/70 via-zinc-900 to-amber-950/70 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
              <Gift className="w-6 h-6 animate-bounce text-amber-300" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>{lang === 'az' ? 'XÜSUSİ DÖVRİYYƏ MİSSİYASI' : 'SPECIAL TURNOVER QUEST'}</span>
                </span>
                <span className="text-[11px] font-bold text-amber-300 font-mono bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>⏱️ {questClockStr} ({questTimeStr})</span>
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-tight">
                {lang === 'az'
                  ? '48 saat ərzində bonusu $100 dollara çatdır həqiqi balansına dövr olunsun!'
                  : 'Turn your bonus into $100 within 48 hours to transfer to your Real Balance!'}
              </h3>
              <p className="text-xs text-zinc-300">
                {lang === 'az'
                  ? 'Bütün poker masalarında $5 bonus ilə oynaya bilərsiniz. Masalarda əldə edilən uduşlar birbaşa bonus balansınıza əlavə olunur!'
                  : 'Play on all poker tables with $5 bonus. Winnings are directly added to your bonus balance!'}
              </p>
            </div>
          </div>

          <div className="w-full md:w-72 space-y-2 shrink-0 z-10 bg-zinc-950/80 p-3 rounded-xl border border-zinc-800">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">{lang === 'az' ? 'Bonus Balansı:' : 'Bonus Progress:'}</span>
              <strong className="text-emerald-400 font-mono text-sm">${(user.bonusBalance ?? 0).toFixed(2)} / $100.00</strong>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, (((user.bonusBalance ?? 0) / 100) * 100)))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Tables & Comprehensive Filters / Sorting Section */}
      <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-5">
        
        {/* Header with Search & Quick Seat */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {lang === 'az' ? 'Poker Masaları & Filtrlər' : 'Poker Tables & Filters'}
                </h2>
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                  {filteredAndSortedTables.length} {lang === 'az' ? 'masa' : 'tables'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {lang === 'az'
                  ? 'Stavka, oyun növü və masa tutumuna görə filtrləyin və sıralayın'
                  : 'Filter and sort by stakes, game type, and capacity'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'az' ? 'Masa adı və ya stavka axtar...' : 'Search table name or stakes...'}
                className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Seat Button */}
            <button
              onClick={handleQuickSeat}
              id="lobby_quick_seat_btn"
              className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{lang === 'az' ? 'Sürətli Giriş' : 'Quick Seat'}</span>
            </button>
          </div>
        </div>

        {/* Game Type Filter Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: lang === 'az' ? 'Bütün Oyunlar' : 'All Games', icon: Layers },
            { id: 'texas_holdem', label: "Texas Hold'em", icon: Flame },
            { id: 'omaha_plo', label: 'Omaha (PLO)', icon: Sparkles },
            { id: 'short_deck', label: 'Short Deck (6+)', icon: Zap },
            { id: 'sit_and_go', label: 'Sit & Go', icon: Trophy },
          ].map((tab) => {
            const isSelected = selectedGameType === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  soundManager.playButtonClick();
                  setSelectedGameType(tab.id as GameType | 'all');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer border ${
                  isSelected
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-lg shadow-amber-500/20 font-black'
                    : 'bg-zinc-900/90 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'stroke-[2.5]' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filter & Sort Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/60 p-3 rounded-xl border border-zinc-850">
          {/* Stakes Tier Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1 flex items-center space-x-1">
              <Coins className="w-3 h-3 text-amber-400" />
              <span>{lang === 'az' ? 'Stavka / Blind Səviyyəsi' : 'Stakes Tier'}</span>
            </label>
            <select
              value={selectedStakes}
              onChange={(e) => {
                soundManager.playButtonClick();
                setSelectedStakes(e.target.value as StakesTier | 'all');
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">{t.stakes_all}</option>
              <option value="micro">{t.stakes_micro}</option>
              <option value="low">{t.stakes_low}</option>
              <option value="mid">{t.stakes_mid}</option>
              <option value="high">{t.stakes_high}</option>
            </select>
          </div>

          {/* Table Capacity Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1 flex items-center space-x-1">
              <Users className="w-3 h-3 text-amber-400" />
              <span>{lang === 'az' ? 'Masa Tutumu (Capacity)' : 'Table Capacity'}</span>
            </label>
            <select
              value={selectedCapacity}
              onChange={(e) => {
                soundManager.playButtonClick();
                setSelectedCapacity(e.target.value === 'all' ? 'all' : Number(e.target.value) as TableCapacity);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">{t.seats_all}</option>
              <option value="2">{t.seats_2max}</option>
              <option value="6">{t.seats_6max}</option>
              <option value="9">{t.seats_9max}</option>
            </select>
          </div>

          {/* Betting Limit Filter */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1 flex items-center space-x-1">
              <Filter className="w-3 h-3 text-amber-400" />
              <span>{lang === 'az' ? 'Limit Növü' : 'Betting Limit'}</span>
            </label>
            <select
              value={selectedLimit}
              onChange={(e) => {
                soundManager.playButtonClick();
                setSelectedLimit(e.target.value as LimitType | 'all');
              }}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">{t.limit_all}</option>
              <option value="no_limit">{t.limit_nl}</option>
              <option value="pot_limit">{t.limit_pl}</option>
              <option value="fixed_limit">{t.limit_fl}</option>
            </select>
          </div>

          {/* Quick Sort By Selector */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1 flex items-center space-x-1">
              <ArrowUpDown className="w-3 h-3 text-amber-400" />
              <span>{lang === 'az' ? 'Sıralama Parametri' : 'Sort Tables By'}</span>
            </label>
            <div className="flex items-center space-x-1.5">
              <select
                value={sortField}
                onChange={(e) => handleSort(e.target.value as SortField)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="stakes">{lang === 'az' ? '💵 Stavkalar (Stakes)' : '💵 Stakes / Blinds'}</option>
                <option value="gameType">{lang === 'az' ? '🃏 Oyun Növü (Hold\'em / PLO)' : '🃏 Game Type'}</option>
                <option value="capacity">{lang === 'az' ? '👥 Masa Tutumu (Capacity)' : '👥 Capacity (2/6/9)'}</option>
                <option value="players">{lang === 'az' ? '🔥 Oyunçu Sayı (Dolu masalar)' : '🔥 Active Players'}</option>
                <option value="avgPot">{lang === 'az' ? '💰 Orta Bank (Avg Pot)' : '💰 Average Pot'}</option>
                <option value="name">{lang === 'az' ? '🔤 Masa Adı (A-Z)' : '🔤 Table Name'}</option>
              </select>

              <button
                type="button"
                onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                title={sortDirection === 'asc' ? 'Artan sıra (Ascending)' : 'Azalan sıra (Descending)'}
                className="px-2.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-amber-400 hover:border-amber-400 transition-all flex items-center justify-center shrink-0"
              >
                {sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Toggles: Hide Full / Only Active */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                soundManager.playButtonClick();
                setHideFullTables((prev) => !prev);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                hideFullTables
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className={`w-3 h-3 rounded border flex items-center justify-center ${hideFullTables ? 'bg-amber-400 border-amber-400 text-zinc-950' : 'border-zinc-600'}`}>
                {hideFullTables && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
              <span>{lang === 'az' ? 'Dolu masaları gizlət' : 'Hide full tables'}</span>
            </button>

            <button
              onClick={() => {
                soundManager.playButtonClick();
                setOnlyActiveTables((prev) => !prev);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center space-x-1.5 cursor-pointer ${
                onlyActiveTables
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className={`w-3 h-3 rounded border flex items-center justify-center ${onlyActiveTables ? 'bg-emerald-400 border-emerald-400 text-zinc-950' : 'border-zinc-600'}`}>
                {onlyActiveTables && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
              <span>{lang === 'az' ? 'Yalnız oyunçusu olan masalar' : 'Active tables only'}</span>
            </button>
          </div>

          {/* Quick Clear All Filters */}
          {(selectedGameType !== 'all' || selectedStakes !== 'all' || selectedCapacity !== 'all' || selectedLimit !== 'all' || searchQuery || hideFullTables || onlyActiveTables) && (
            <button
              onClick={() => {
                soundManager.playButtonClick();
                setSelectedGameType('all');
                setSelectedStakes('all');
                setSelectedCapacity('all');
                setSelectedLimit('all');
                setSearchQuery('');
                setHideFullTables(false);
                setOnlyActiveTables(false);
              }}
              className="text-xs text-zinc-400 hover:text-amber-400 underline flex items-center space-x-1"
            >
              <X className="w-3 h-3" />
              <span>{lang === 'az' ? 'Bütün filtrləri sıfırla' : 'Reset all filters'}</span>
            </button>
          )}
        </div>

        {/* Tables List Table View with Interactive Sortable Column Headers */}
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto pr-1 border border-zinc-800/80 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-950/98 backdrop-blur z-10">
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                {/* Table Name (Sortable) */}
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-3 hover:text-white cursor-pointer select-none transition-colors group"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{t.col_table_name}</span>
                    {renderSortIndicator('name')}
                  </div>
                </th>

                {/* Game Type (Sortable) */}
                <th
                  onClick={() => handleSort('gameType')}
                  className="py-3 px-3 hover:text-white cursor-pointer select-none transition-colors group"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{t.col_game_type}</span>
                    {renderSortIndicator('gameType')}
                  </div>
                </th>

                {/* Stakes / Blinds (Sortable) */}
                <th
                  onClick={() => handleSort('stakes')}
                  className="py-3 px-3 hover:text-white cursor-pointer select-none transition-colors group"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{t.col_blinds}</span>
                    {renderSortIndicator('stakes')}
                  </div>
                </th>

                {/* Players / Capacity (Sortable) */}
                <th
                  onClick={() => handleSort('players')}
                  className="py-3 px-3 hover:text-white cursor-pointer select-none transition-colors group"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{t.col_players}</span>
                    {renderSortIndicator('players')}
                  </div>
                </th>

                {/* Capacity (Sortable) */}
                <th
                  onClick={() => handleSort('capacity')}
                  className="py-3 px-3 hover:text-white cursor-pointer select-none transition-colors group"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{lang === 'az' ? 'Masa Tutumu' : 'Capacity'}</span>
                    {renderSortIndicator('capacity')}
                  </div>
                </th>

                {/* Avg Pot (Sortable) */}
                <th
                  onClick={() => handleSort('avgPot')}
                  className="py-3 px-3 hover:text-white cursor-pointer select-none transition-colors group"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{t.col_avg_pot}</span>
                    {renderSortIndicator('avgPot')}
                  </div>
                </th>

                <th className="py-3 px-3 text-right">{t.col_action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {filteredAndSortedTables.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500 space-y-2">
                    <p className="text-sm font-semibold">
                      {lang === 'az'
                        ? 'Seçilmiş filtrlərə uyğun heç bir masa tapılmadı.'
                        : 'No tables match the selected filters.'}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedGameType('all');
                        setSelectedStakes('all');
                        setSelectedCapacity('all');
                        setSelectedLimit('all');
                        setSearchQuery('');
                        setHideFullTables(false);
                        setOnlyActiveTables(false);
                      }}
                      className="text-xs text-amber-400 hover:underline font-bold"
                    >
                      {lang === 'az' ? 'Bütün filtrləri təmizlə' : 'Clear all filters'}
                    </button>
                  </td>
                </tr>
              ) : (
                filteredAndSortedTables.map((tbl) => {
                  const activePlayersCount = tbl.players.filter((p) => p !== null).length;
                  const isFull = activePlayersCount >= tbl.capacity;

                  return (
                    <tr
                      key={tbl.id}
                      onClick={() => {
                        soundManager.playButtonClick();
                        onJoinTable(tbl, true);
                      }}
                      className="hover:bg-zinc-900/80 transition-colors group cursor-pointer"
                    >
                      {/* Table Name */}
                      <td className="py-3 px-3 font-bold text-white flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                        <span className="truncate max-w-[140px] sm:max-w-none">{tbl.name}</span>
                        {tbl.isCustomCreated && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-[9px] font-black shrink-0 flex items-center space-x-1">
                            <span>👑 OYUNÇU MASASI</span>
                          </span>
                        )}
                        {tbl.capacity === 6 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black shrink-0">
                            6-Max
                          </span>
                        )}
                        {tbl.isPrivate && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 text-[10px] shrink-0">
                            Private
                          </span>
                        )}
                      </td>

                      {/* Game Type */}
                      <td className="py-3 px-3 text-zinc-300">
                        <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 font-medium text-[11px]">
                          {getGameTypeLabel(tbl.gameType)}
                        </span>
                      </td>

                      {/* Stakes / Blinds */}
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">
                        ${tbl.smallBlind} / ${tbl.bigBlind}
                      </td>

                      {/* Players count & Avatars */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-2">
                          <div className="flex -space-x-1 overflow-hidden shrink-0">
                            {tbl.players
                              .filter((p): p is Player => p !== null)
                              .slice(0, 3)
                              .map((p, pIdx) => (
                                <img
                                  key={pIdx}
                                  src={p.avatar}
                                  alt={p.name}
                                  title={p.name}
                                  className={`w-4 h-4 rounded-full border border-zinc-900 object-cover ${p.isHuman ? 'ring-1 ring-amber-400' : ''}`}
                                />
                              ))}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5 text-zinc-400" />
                            <span
                              className={`font-bold text-xs ${
                                isFull ? 'text-amber-400' : 'text-zinc-200'
                              }`}
                            >
                              {activePlayersCount} / {tbl.capacity}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Capacity */}
                      <td className="py-3 px-3 text-zinc-300 font-semibold">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          tbl.capacity === 2
                            ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                            : tbl.capacity === 6
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                        }`}>
                          {tbl.capacity === 2 ? '2-Max (HU)' : tbl.capacity === 6 ? '6-Max' : '9-Max'}
                        </span>
                      </td>

                      {/* Avg Pot */}
                      <td className="py-3 px-3 text-emerald-400 font-mono font-semibold">
                        ${tbl.avgPot}
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundManager.playButtonClick();
                            onJoinTable(tbl, true);
                          }}
                          className="py-1 px-3.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          {lang === 'az' ? 'Giriş et' : 'Enter'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

