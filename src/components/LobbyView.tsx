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
  LogOut
} from 'lucide-react';

interface LobbyViewProps {
  user: UserProfile | null;
  lang: Language;
  onJoinTable: (table: PokerTableState, observeOnly?: boolean) => void;
  onOpenCreateTable: () => void;
  onOpenAuth: () => void;
  onLogout?: () => void;
  tables: PokerTableState[];
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  user,
  lang,
  onJoinTable,
  onOpenCreateTable,
  onOpenAuth,
  onLogout,
  tables,
}) => {
  const t = translations[lang];

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

  // Filter Tables - Prioritize 6-Max tables first, then player count
  const filteredTables = useMemo(() => {
    return tables
      .filter((table) => {
        if (selectedGameType !== 'all' && table.gameType !== selectedGameType) return false;
        if (selectedLimit !== 'all' && table.limitType !== selectedLimit) return false;
        if (selectedStakes !== 'all' && table.stakesTier !== selectedStakes) return false;
        if (selectedCapacity !== 'all' && table.capacity !== selectedCapacity) return false;
        return true;
      })
      .sort((a, b) => {
        const a6 = a.capacity === 6 ? 1 : 0;
        const b6 = b.capacity === 6 ? 1 : 0;
        if (b6 !== a6) return b6 - a6;

        const countA = a.players.filter((p) => p !== null).length;
        const countB = b.players.filter((p) => p !== null).length;
        return countB - countA;
      });
  }, [tables, selectedGameType, selectedLimit, selectedStakes, selectedCapacity]);

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

  // Dynamically calculated active tables based on online player count (e.g. avg 6-7 players per active table)
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
    const available = filteredTables.find((tbl) => {
      const activeCount = tbl.players.filter((p) => p !== null).length;
      return activeCount < tbl.capacity;
    }) || filteredTables[0] || tables[0];

    if (available) {
      onJoinTable(available);
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

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Banner Stats & Bad Beat Jackpot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bad Beat Jackpot Banner with Golden Letters & $1000 */}
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

          {/* Right Corner: Royal Crown Badge */}
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

        {/* Active Live Tables Showcase (Calculated accurately based on online player count with Up/Down Scroll) */}
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

          {/* Active Tables Scrollable List: Up/down scrollable container displaying multiple 6-Max & active tables */}
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

      {/* 48-Hour $100 Turnover Challenge Banner - Silinir və ləğv edilir if expired */}
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

      {/* Tables & Filters Section */}
      <div className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-4">
        {/* Section Header with Quick Seat & Logout Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-850">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {lang === 'az' ? 'Poker Masaları & Filtrlər' : 'Poker Tables & Filters'}
            </h2>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-lg">
              {filteredTables.length} {lang === 'az' ? 'masa' : 'tables'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Seat Button */}
            <button
              onClick={handleQuickSeat}
              id="lobby_quick_seat_btn"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{lang === 'az' ? 'Sürətli Masa Seçimi' : 'Quick Seat'}</span>
            </button>

            {/* Logout / Giriş Ekranına Qayıt Button for logged-in users */}
            {user && onLogout && (
              <button
                onClick={() => {
                  soundManager.playButtonClick();
                  onLogout();
                }}
                id="lobby_logout_btn"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-red-950/80 to-zinc-900 hover:from-red-900/90 hover:to-zinc-850 border border-red-800/50 hover:border-red-600 text-red-300 hover:text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                title={lang === 'az' ? 'Hesabdan çıxış et və giriş/qeydiyyat ekranına qayıt' : 'Log out to sign-in / registration screen'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'az' ? 'Çıxış (Giriş Ekranına Qayıt)' : 'Logout'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Selectors (Limit, Stakes, and Capacity) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Limit Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              {lang === 'az' ? 'Limit Növü' : 'Betting Limit'}
            </label>
            <select
              value={selectedLimit}
              onChange={(e) => setSelectedLimit(e.target.value as LimitType | 'all')}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">{t.limit_all}</option>
              <option value="no_limit">{t.limit_nl}</option>
              <option value="pot_limit">{t.limit_pl}</option>
              <option value="fixed_limit">{t.limit_fl}</option>
            </select>
          </div>

          {/* Stakes Tier Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              {lang === 'az' ? 'Stavka / Blind' : 'Stakes Tier'}
            </label>
            <select
              value={selectedStakes}
              onChange={(e) => setSelectedStakes(e.target.value as StakesTier | 'all')}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
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
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
              {lang === 'az' ? 'Masa Tutumu' : 'Table Size'}
            </label>
            <select
              value={selectedCapacity}
              onChange={(e) => setSelectedCapacity(e.target.value === 'all' ? 'all' : Number(e.target.value) as TableCapacity)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">{t.seats_all}</option>
              <option value="2">{t.seats_2max}</option>
              <option value="6">{t.seats_6max}</option>
              <option value="9">{t.seats_9max}</option>
            </select>
          </div>
        </div>

        {/* Tables List Table View with Smooth Scroll for 200+ Tables */}
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur z-10">
              <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">{t.col_table_name}</th>
                <th className="py-3 px-3">{t.col_game_type}</th>
                <th className="py-3 px-3">{t.col_blinds}</th>
                <th className="py-3 px-3">{t.col_players}</th>
                <th className="py-3 px-3">{t.col_avg_pot}</th>
                <th className="py-3 px-3">{t.col_hands_hr}</th>
                <th className="py-3 px-3 text-right">{t.col_action}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {filteredTables.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    {lang === 'az'
                      ? 'Seçilmiş filtrlərə uyğun masa tapılmadı.'
                      : 'No tables match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filteredTables.map((tbl) => {
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
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate max-w-[140px] sm:max-w-none">{tbl.name}</span>
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

                      {/* Players count */}
                      <td className="py-3 px-3">
                        <div className="flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-400" />
                          <span
                            className={`font-bold ${
                              isFull ? 'text-amber-400' : 'text-zinc-200'
                            }`}
                          >
                            {activePlayersCount} / {tbl.capacity}
                          </span>
                        </div>
                      </td>

                      {/* Avg Pot */}
                      <td className="py-3 px-3 text-emerald-400 font-mono font-semibold">
                        ${tbl.avgPot}
                      </td>

                      {/* Hands/Hour */}
                      <td className="py-3 px-3 text-zinc-400 font-mono">
                        {tbl.handsPerHour} h/h
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
