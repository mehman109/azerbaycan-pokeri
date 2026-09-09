import React, { useState } from 'react';
import { HandHistoryRecord, Player } from '../types/poker';
import { Language, translations } from '../utils/translations';
import { calculatePlayerSessionStats, getAllSessionPlayerStats, classifyPlayerStyle } from '../utils/pokerStats';
import { 
  BarChart2, 
  TrendingUp, 
  Shield, 
  Zap, 
  Flame, 
  HelpCircle, 
  X, 
  Users, 
  User, 
  Award, 
  RotateCcw,
  ChevronRight,
  Info,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TableStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  handHistory: HandHistoryRecord[];
  currentUserId?: string;
  currentUsername?: string;
  currentUserAvatar?: string;
  tablePlayers: (Player | null)[];
  lang: Language;
  onResetSessionStats?: () => void;
}

export const TableStatsModal: React.FC<TableStatsModalProps> = ({
  isOpen,
  onClose,
  handHistory,
  currentUserId = 'hero',
  currentUsername = 'You',
  currentUserAvatar,
  tablePlayers,
  lang,
  onResetSessionStats,
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'hero' | 'table'>('hero');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  if (!isOpen) return null;

  // Compute Hero Stats
  const heroStats = calculatePlayerSessionStats(
    handHistory,
    currentUserId,
    currentUsername,
    true,
    lang
  );

  // Compute All Session Players Stats
  const allSessionPlayers = getAllSessionPlayerStats(handHistory, lang);
  
  // Also collect any currently seated opponents that might not have played a hand yet
  const seatedOpponents = tablePlayers
    .filter((p): p is Player => p !== null && p.id !== currentUserId)
    .map((p) => {
      const existing = allSessionPlayers.find((s) => s.playerId === p.id);
      if (existing) return existing;
      return calculatePlayerSessionStats(
        handHistory,
        p.id,
        p.name,
        p.isHuman,
        lang
      );
    });

  // Selected player for detail view (either selected opponent or hero)
  const detailPlayerStats = selectedOpponentId
    ? (allSessionPlayers.find((p) => p.playerId === selectedOpponentId) ||
       seatedOpponents.find((p) => p.playerId === selectedOpponentId) ||
       heroStats)
    : heroStats;

  // Color helper for VPIP
  const getVpipColor = (vpip: number) => {
    if (vpip === 0) return 'text-zinc-400';
    if (vpip < 18) return 'text-purple-400'; // Tight/Nit
    if (vpip <= 28) return 'text-emerald-400'; // Optimal TAG/Balanced
    if (vpip <= 40) return 'text-amber-400'; // LAG/Loose
    return 'text-rose-400'; // Maniac/Very Loose
  };

  // Color helper for PFR
  const getPfrColor = (pfr: number) => {
    if (pfr === 0) return 'text-zinc-400';
    if (pfr < 12) return 'text-blue-400';
    if (pfr <= 24) return 'text-emerald-400';
    return 'text-rose-400';
  };

  // Color helper for AF
  const getAfColor = (af: number, isInfinite?: boolean) => {
    if (isInfinite || af >= 3.0) return 'text-rose-400';
    if (af >= 1.8) return 'text-emerald-400';
    if (af > 0) return 'text-blue-400';
    return 'text-zinc-400';
  };

  const styleClass = classifyPlayerStyle(
    detailPlayerStats.vpipPercent,
    detailPlayerStats.pfrPercent,
    detailPlayerStats.aggressionFactor,
    detailPlayerStats.totalHands,
    lang
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-zinc-950 border border-zinc-800/90 rounded-2xl max-w-2xl w-full text-zinc-100 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-yellow-400/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black text-white tracking-tight">
                  {t.stats_panel_title}
                </h2>
                <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  {handHistory.length} {lang === 'az' ? 'Əl' : 'Hands'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {t.stats_panel_subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowExplanation(!showExplanation)}
              title={lang === 'az' ? 'Statistika Qaydaları' : 'Stats Guide'}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showExplanation
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              id="close_stats_modal_btn"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Guide / Explanation Collapsible Box */}
        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-zinc-800 bg-zinc-900/90 text-xs p-4 space-y-3"
            >
              <div className="flex items-center space-x-2 text-amber-400 font-bold">
                <Info className="w-4 h-4" />
                <span>{lang === 'az' ? 'Poker Statistikaları Bələdçisi' : 'Poker Stats Guide'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <div className="font-bold text-amber-300 font-mono text-xs">{t.vpip_label}</div>
                  <div className="text-[11px] text-zinc-300 font-semibold mt-0.5">{t.vpip_full}</div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">{t.vpip_desc}</p>
                  <div className="text-[10px] text-emerald-400/90 mt-1 font-mono">
                    {lang === 'az' ? 'Optimal: 18% - 26%' : 'Optimal: 18% - 26%'}
                  </div>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <div className="font-bold text-amber-300 font-mono text-xs">{t.pfr_label}</div>
                  <div className="text-[11px] text-zinc-300 font-semibold mt-0.5">{t.pfr_full}</div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">{t.pfr_desc}</p>
                  <div className="text-[10px] text-emerald-400/90 mt-1 font-mono">
                    {lang === 'az' ? 'Optimal: 14% - 22%' : 'Optimal: 14% - 22%'}
                  </div>
                </div>

                <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <div className="font-bold text-amber-300 font-mono text-xs">{t.af_label}</div>
                  <div className="text-[11px] text-zinc-300 font-semibold mt-0.5">{t.af_full}</div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">{t.af_desc}</p>
                  <div className="text-[10px] text-emerald-400/90 mt-1 font-mono">
                    {lang === 'az' ? 'Aqressiv: > 2.0 | Passiv: < 1.5' : 'Aggressive: > 2.0 | Passive: < 1.5'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 px-5 pt-3 pb-1 border-b border-zinc-800/60 bg-zinc-950">
          <button
            type="button"
            onClick={() => {
              setActiveTab('hero');
              setSelectedOpponentId(null);
            }}
            id="tab_hero_stats_btn"
            className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'hero' && !selectedOpponentId
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t.hero_stats_tab}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('table')}
            id="tab_table_players_stats_btn"
            className={`flex items-center space-x-2 py-2 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'table'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t.table_players_tab}</span>
            <span className="bg-zinc-800 text-zinc-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {seatedOpponents.length}
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'hero' || selectedOpponentId ? (
            /* Detailed Player Report (Hero or Selected Opponent) */
            <div className="space-y-4">
              {/* Back to table button if viewing an opponent */}
              {selectedOpponentId && (
                <button
                  type="button"
                  onClick={() => setSelectedOpponentId(null)}
                  className="flex items-center space-x-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                >
                  <span>← {lang === 'az' ? 'Bütün masa oyunçularına qayıt' : 'Back to all opponents'}</span>
                </button>
              )}

              {/* Player Profile & Style Archetype Card */}
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3.5">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-xl font-bold text-amber-400 shrink-0">
                    {detailPlayerStats.avatar ? (
                      <img
                        src={detailPlayerStats.avatar}
                        alt={detailPlayerStats.playerName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      detailPlayerStats.playerName.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm sm:text-base font-black text-white">
                        {detailPlayerStats.playerName}
                      </h3>
                      {detailPlayerStats.isHuman ? (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Hero
                        </span>
                      ) : (
                        <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Bot
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center space-x-2">
                      <span>
                        {detailPlayerStats.totalHands} {lang === 'az' ? 'əl izlənildi' : 'hands tracked'}
                      </span>
                      <span>•</span>
                      <span className={detailPlayerStats.netProfit >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {detailPlayerStats.netProfit >= 0 ? `+$${detailPlayerStats.netProfit.toFixed(2)}` : `-$${Math.abs(detailPlayerStats.netProfit).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Style Archetype Badge */}
                <div className={`px-3 py-2 rounded-xl border ${styleClass.badgeBg} ${styleClass.badgeBorder} flex flex-col sm:items-end`}>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    {t.player_style}
                  </div>
                  <div className={`text-xs font-black ${styleClass.badgeText} mt-0.5 flex items-center space-x-1`}>
                    <Flame className="w-3 h-3" />
                    <span>{styleClass.label}</span>
                  </div>
                  <p className="text-[10.5px] text-zinc-400 mt-0.5 max-w-[260px] sm:text-right leading-tight">
                    {styleClass.desc}
                  </p>
                </div>
              </div>

              {/* Primary 3 Key Metrics Cards: VPIP, PFR, AF */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {/* VPIP Card */}
                <div className="bg-zinc-900/90 border border-zinc-800 p-3 sm:p-4 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-xs font-black tracking-wider uppercase">{t.vpip_label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">Pre-Flop</span>
                  </div>
                  <div className="my-2">
                    <div className={`text-xl sm:text-3xl font-black font-mono tracking-tight ${getVpipColor(detailPlayerStats.vpipPercent)}`}>
                      {detailPlayerStats.vpipPercent}%
                    </div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">
                      {detailPlayerStats.vpipHands} / {detailPlayerStats.totalHands} {lang === 'az' ? 'əl' : 'hands'}
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, detailPlayerStats.vpipPercent)}%` }}
                    />
                  </div>
                </div>

                {/* PFR Card */}
                <div className="bg-zinc-900/90 border border-zinc-800 p-3 sm:p-4 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-xs font-black tracking-wider uppercase">{t.pfr_label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">Raise</span>
                  </div>
                  <div className="my-2">
                    <div className={`text-xl sm:text-3xl font-black font-mono tracking-tight ${getPfrColor(detailPlayerStats.pfrPercent)}`}>
                      {detailPlayerStats.pfrPercent}%
                    </div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">
                      {detailPlayerStats.pfrHands} / {detailPlayerStats.totalHands} {lang === 'az' ? 'əl' : 'hands'}
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, detailPlayerStats.pfrPercent)}%` }}
                    />
                  </div>
                </div>

                {/* AF Card */}
                <div className="bg-zinc-900/90 border border-zinc-800 p-3 sm:p-4 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="text-xs font-black tracking-wider uppercase">{t.af_label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">Post-Flop</span>
                  </div>
                  <div className="my-2">
                    <div className={`text-xl sm:text-3xl font-black font-mono tracking-tight ${getAfColor(detailPlayerStats.aggressionFactor, detailPlayerStats.isAfInfinite)}`}>
                      {detailPlayerStats.isAfInfinite ? '∞' : detailPlayerStats.aggressionFactor.toFixed(2)}
                    </div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">
                      {detailPlayerStats.totalPostflopBets + detailPlayerStats.totalPostflopRaises} B+R / {detailPlayerStats.totalPostflopCalls} C
                    </div>
                  </div>
                  <div className="w-full bg-zinc-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (detailPlayerStats.aggressionFactor / 4) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Secondary Supporting Metrics: Win Rate, WTSD, Aggression Freq */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-zinc-900/60 border border-zinc-800/70 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-zinc-400 font-medium">{t.winrate_label}</span>
                    <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                      {detailPlayerStats.winRatePercent}%
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-300 bg-zinc-800 px-2 py-1 rounded-lg">
                    {detailPlayerStats.handsWon} / {detailPlayerStats.totalHands}
                  </span>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/70 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-zinc-400 font-medium">{t.wtsd_label}</span>
                    <div className="text-base font-bold text-amber-300 font-mono mt-0.5">
                      {detailPlayerStats.wtsdPercent}%
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-300 bg-zinc-800 px-2 py-1 rounded-lg">
                    {detailPlayerStats.sawShowdownCount} / {detailPlayerStats.sawFlopCount}
                  </span>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/70 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-zinc-400 font-medium">Aggression Freq</span>
                    <div className="text-base font-bold text-blue-300 font-mono mt-0.5">
                      {detailPlayerStats.aggressionFrequency}%
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-300 bg-zinc-800 px-2 py-1 rounded-lg">
                    {detailPlayerStats.totalPostflopBets + detailPlayerStats.totalPostflopRaises} / {detailPlayerStats.totalPostflopBets + detailPlayerStats.totalPostflopRaises + detailPlayerStats.totalPostflopCalls + detailPlayerStats.totalPostflopChecks}
                  </span>
                </div>
              </div>

              {/* Street-by-Street Aggression Breakdown */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.street_aggression}</span>
                </h4>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {/* Flop */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-400">{t.flop_street}</span>
                      <span className="text-zinc-400 font-mono text-[11px]">
                        AF: <b className="text-white">{detailPlayerStats.streetBreakdown.flop.af === Infinity ? '∞' : detailPlayerStats.streetBreakdown.flop.af}</b>
                      </span>
                    </div>
                    <div className="text-[10.5px] text-zinc-400 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Bets / Raises:</span>
                        <span className="text-emerald-400 font-bold">{detailPlayerStats.streetBreakdown.flop.bets + detailPlayerStats.streetBreakdown.flop.raises}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Calls:</span>
                        <span className="text-blue-400 font-bold">{detailPlayerStats.streetBreakdown.flop.calls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Checks:</span>
                        <span className="text-zinc-400">{detailPlayerStats.streetBreakdown.flop.checks}</span>
                      </div>
                    </div>
                  </div>

                  {/* Turn */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-400">{t.turn_street}</span>
                      <span className="text-zinc-400 font-mono text-[11px]">
                        AF: <b className="text-white">{detailPlayerStats.streetBreakdown.turn.af === Infinity ? '∞' : detailPlayerStats.streetBreakdown.turn.af}</b>
                      </span>
                    </div>
                    <div className="text-[10.5px] text-zinc-400 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Bets / Raises:</span>
                        <span className="text-emerald-400 font-bold">{detailPlayerStats.streetBreakdown.turn.bets + detailPlayerStats.streetBreakdown.turn.raises}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Calls:</span>
                        <span className="text-blue-400 font-bold">{detailPlayerStats.streetBreakdown.turn.calls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Checks:</span>
                        <span className="text-zinc-400">{detailPlayerStats.streetBreakdown.turn.checks}</span>
                      </div>
                    </div>
                  </div>

                  {/* River */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-400">{t.river_street}</span>
                      <span className="text-zinc-400 font-mono text-[11px]">
                        AF: <b className="text-white">{detailPlayerStats.streetBreakdown.river.af === Infinity ? '∞' : detailPlayerStats.streetBreakdown.river.af}</b>
                      </span>
                    </div>
                    <div className="text-[10.5px] text-zinc-400 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Bets / Raises:</span>
                        <span className="text-emerald-400 font-bold">{detailPlayerStats.streetBreakdown.river.bets + detailPlayerStats.streetBreakdown.river.raises}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Calls:</span>
                        <span className="text-blue-400 font-bold">{detailPlayerStats.streetBreakdown.river.calls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Checks:</span>
                        <span className="text-zinc-400">{detailPlayerStats.streetBreakdown.river.checks}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Empty state notice if 0 hands */}
              {detailPlayerStats.totalHands === 0 && (
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-xs text-zinc-400">
                  {t.no_hands_yet}
                </div>
              )}
            </div>
          ) : (
            /* Table Opponents Roster & HUD Stats */
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 flex items-center justify-between pb-1">
                <span>{lang === 'az' ? 'Masa rəqiblərinizin canlı VPIP/PFR/AF göstəriciləri:' : 'Live VPIP / PFR / AF stats for opponents:'}</span>
                <span className="text-[11px] text-zinc-500 font-mono">Click for details</span>
              </div>

              {seatedOpponents.length === 0 ? (
                <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800 rounded-2xl text-zinc-400 text-xs">
                  {lang === 'az' ? 'Masada aktiv rəqib yoxdur.' : 'No active opponents at the table.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {seatedOpponents.map((opp) => {
                    const oppStyle = classifyPlayerStyle(
                      opp.vpipPercent,
                      opp.pfrPercent,
                      opp.aggressionFactor,
                      opp.totalHands,
                      lang
                    );

                    return (
                      <button
                        key={opp.playerId}
                        type="button"
                        onClick={() => setSelectedOpponentId(opp.playerId)}
                        className="w-full text-left bg-zinc-900/80 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-sm"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400 font-bold overflow-hidden shrink-0">
                            {opp.avatar ? (
                              <img src={opp.avatar} alt={opp.playerName} className="w-full h-full object-cover" />
                            ) : (
                              opp.playerName.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-black text-white truncate group-hover:text-amber-300 transition-colors">
                                {opp.playerName}
                              </span>
                              <span className={`text-[9.5px] font-bold px-2 py-0.2 rounded-full border ${oppStyle.badgeBg} ${oppStyle.badgeBorder} ${oppStyle.badgeText}`}>
                                {oppStyle.style}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              {opp.totalHands} {lang === 'az' ? 'əl oynanılıb' : 'hands tracked'}
                            </div>
                          </div>
                        </div>

                        {/* HUD Metrics Pills */}
                        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 font-mono text-xs">
                          {/* VPIP Pill */}
                          <div className="bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-center">
                            <div className="text-[9px] text-zinc-500 uppercase">VPIP</div>
                            <div className={`font-black ${getVpipColor(opp.vpipPercent)}`}>
                              {opp.vpipPercent}%
                            </div>
                          </div>

                          {/* PFR Pill */}
                          <div className="bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-center">
                            <div className="text-[9px] text-zinc-500 uppercase">PFR</div>
                            <div className={`font-black ${getPfrColor(opp.pfrPercent)}`}>
                              {opp.pfrPercent}%
                            </div>
                          </div>

                          {/* AF Pill */}
                          <div className="bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-center">
                            <div className="text-[9px] text-zinc-500 uppercase">AF</div>
                            <div className={`font-black ${getAfColor(opp.aggressionFactor, opp.isAfInfinite)}`}>
                              {opp.isAfInfinite ? '∞' : opp.aggressionFactor.toFixed(1)}
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between text-xs">
          <div className="text-zinc-500 text-[11px]">
            {lang === 'az' ? 'Statistikalar sessiya ərzində real vaxt rejimində hesablanır.' : 'Stats are computed live during this table session.'}
          </div>

          <div className="flex items-center space-x-2">
            {onResetSessionStats && (
              <button
                type="button"
                onClick={onResetSessionStats}
                className="flex items-center space-x-1 py-1.5 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold transition-colors cursor-pointer text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'az' ? 'Sıfırla' : 'Reset Session'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors cursor-pointer text-xs"
            >
              {lang === 'az' ? 'Bağla' : 'Close'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
