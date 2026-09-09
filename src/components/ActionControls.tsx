import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Player, PokerTableState, PlayerActionType } from '../types/poker';
import { translations, Language } from '../utils/translations';
import { soundManager } from '../utils/audioEngine';
import { Check, ShieldAlert, Sparkles, SlidersHorizontal, Plus, Minus, Flame } from 'lucide-react';

interface ActionControlsProps {
  player: Player | null;
  table: PokerTableState;
  isMyTurn: boolean;
  onAction: (action: PlayerActionType, amount: number) => void;
  lang: Language;
  preAction: 'check_fold' | 'check' | 'call_any' | null;
  onSetPreAction: (action: 'check_fold' | 'check' | 'call_any' | null) => void;
  sitOutNextHand?: boolean;
  onToggleSitOutNextHand?: (val: boolean) => void;
  turnTimeLeft?: number;
  maxTimeBank?: number;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  player,
  table,
  isMyTurn,
  onAction,
  lang,
  preAction,
  onSetPreAction,
  sitOutNextHand = false,
  onToggleSitOutNextHand,
  turnTimeLeft = 15,
  maxTimeBank = 15,
}) => {
  const t = translations[lang];

  if (!player || player.isFolded || player.isAllIn) {
    return null;
  }

  const toCall = Math.max(0, Number((table.currentHighBet - player.currentBet).toFixed(2)));
  const minBet = table.currentHighBet === 0 ? table.bigBlind : Number((table.currentHighBet + table.minRaise).toFixed(2));
  const minAllowedBet = Math.min(player.chips, Math.max(minBet, table.bigBlind));
  const maxAllowedBet = player.chips;

  const [betAmount, setBetAmount] = useState<number>(minAllowedBet);

  useEffect(() => {
    setBetAmount(minAllowedBet);
  }, [table.currentHighBet, minAllowedBet]);

  // Round amount helper respecting table stake precision
  const roundBet = (val: number) => {
    const clamped = Math.max(minAllowedBet, Math.min(maxAllowedBet, val));
    return table.bigBlind < 1 ? Number(clamped.toFixed(2)) : Math.round(clamped);
  };

  // Quick sizing calculations
  const calcQuickSize = (type: 'min' | '2.5bb' | 'half_pot' | 'three_quarter_pot' | 'pot' | 'max') => {
    soundManager.playButtonClick();
    let size = minAllowedBet;
    switch (type) {
      case 'min':
        size = minAllowedBet;
        break;
      case '2.5bb':
        size = roundBet(table.bigBlind * 2.5);
        break;
      case 'half_pot':
        size = roundBet(table.currentHighBet + table.pot * 0.5);
        break;
      case 'three_quarter_pot':
        size = roundBet(table.currentHighBet + table.pot * 0.75);
        break;
      case 'pot':
        size = roundBet(table.currentHighBet + table.pot);
        break;
      case 'max':
        size = maxAllowedBet;
        break;
    }
    setBetAmount(size);
  };

  const handleFold = () => {
    soundManager.playFoldSound();
    onAction('fold', 0);
  };

  const handleCheckCall = () => {
    if (toCall === 0) {
      soundManager.playCheckSound();
      onAction('check', 0);
    } else {
      soundManager.playChipSound();
      onAction('call', Math.min(toCall, player.chips));
    }
  };

  const handleBetRaise = () => {
    soundManager.playChipSound();
    if (betAmount >= player.chips) {
      soundManager.playAllInSound();
      onAction('all_in', player.chips);
    } else if (table.currentHighBet === 0) {
      onAction('bet', betAmount);
    } else {
      onAction('raise', betAmount);
    }
  };

  const handleAllIn = () => {
    soundManager.playAllInSound();
    onAction('all_in', player.chips);
  };

  // If it's NOT player's turn yet: Show Pre-Action Checkboxes
  if (!isMyTurn) {
    return (
      <div className="bg-zinc-950/95 border border-zinc-800/90 backdrop-blur-md rounded-xl p-2 shadow-lg max-w-xl mx-auto flex items-center justify-between gap-2">
        <div className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider pl-1.5 flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>{lang === 'az' ? 'Əvvəlcədən:' : 'Pre-actions:'}</span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Check / Fold */}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onSetPreAction(preAction === 'check_fold' ? null : 'check_fold');
            }}
            id="pre_action_check_fold"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center space-x-1 ${
              preAction === 'check_fold'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/20'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className={`w-3 h-3 rounded border flex items-center justify-center ${preAction === 'check_fold' ? 'bg-amber-400 border-amber-400 text-zinc-950' : 'border-zinc-600'}`}>
              {preAction === 'check_fold' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span>{t.pre_check_fold}</span>
          </button>

          {/* Check */}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onSetPreAction(preAction === 'check' ? null : 'check');
            }}
            id="pre_action_check"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center space-x-1 ${
              preAction === 'check'
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/20'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className={`w-3 h-3 rounded border flex items-center justify-center ${preAction === 'check' ? 'bg-emerald-400 border-emerald-400 text-zinc-950' : 'border-zinc-600'}`}>
              {preAction === 'check' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span>{t.pre_check}</span>
          </button>

          {/* Call Any */}
          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onSetPreAction(preAction === 'call_any' ? null : 'call_any');
            }}
            id="pre_action_call_any"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center space-x-1 ${
              preAction === 'call_any'
                ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-sm shadow-blue-500/20'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <div className={`w-3 h-3 rounded border flex items-center justify-center ${preAction === 'call_any' ? 'bg-blue-400 border-blue-400 text-zinc-950' : 'border-zinc-600'}`}>
              {preAction === 'call_any' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span>{t.pre_call_any}</span>
          </button>

          {/* Sit Out Next Hand Toggle */}
          {onToggleSitOutNextHand && (
            <button
              type="button"
              onClick={() => {
                soundManager.playButtonClick();
                onToggleSitOutNextHand(!sitOutNextHand);
              }}
              id="pre_action_sit_out_next"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center space-x-1 ${
                sitOutNextHand
                  ? 'bg-red-500/20 border-red-400 text-red-300 shadow-sm shadow-red-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className={`w-3 h-3 rounded border flex items-center justify-center ${sitOutNextHand ? 'bg-red-400 border-red-400 text-zinc-950' : 'border-zinc-600'}`}>
                {sitOutNextHand && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
              <span className="whitespace-nowrap">{t.sit_out_next_hand}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active Turn Action Control Panel
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-950/95 border border-amber-400/70 backdrop-blur-md rounded-xl p-2 sm:p-2.5 shadow-xl shadow-amber-500/10 max-w-xl mx-auto space-y-2 z-30"
    >
      {/* Live Turn Timer Header Bar with smooth countdown */}
      <div className="flex items-center justify-between px-1 pb-1 border-b border-zinc-800/80 text-xs">
        <div className="flex items-center space-x-1.5">
          <span className={`w-2 h-2 rounded-full animate-ping ${turnTimeLeft <= 5 ? 'bg-red-500' : 'bg-amber-400'}`} />
          <span className="font-black text-amber-400 text-[11px] tracking-wide uppercase">
            {lang === 'az' ? 'SİZİN NÖVBƏNİZ' : 'YOUR TURN'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {/* Progress Bar */}
          <div className="w-24 sm:w-36 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                turnTimeLeft <= 5
                  ? 'bg-gradient-to-r from-red-600 to-rose-400 animate-pulse'
                  : turnTimeLeft <= 10
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (turnTimeLeft / (maxTimeBank || 15)) * 100))}%` }}
            />
          </div>
          <span
            className={`font-mono font-black text-xs px-1.5 py-0.2 rounded ${
              turnTimeLeft <= 5
                ? 'bg-red-600/30 text-red-400 border border-red-500/60 animate-bounce'
                : 'bg-zinc-900 text-amber-300 border border-zinc-700'
            }`}
          >
            {turnTimeLeft}s
          </span>
        </div>
      </div>

      {/* Bet Sizing Slider & Quick Sizes (only if player can bet or raise) */}
      {player.chips > toCall && (
        <div className="space-y-1.5 pb-1.5 border-b border-zinc-800/80">
          {/* Quick Buttons */}
          <div className="grid grid-cols-6 gap-1">
            <button
              type="button"
              onClick={() => calcQuickSize('min')}
              className="py-0.5 px-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-[10px] font-bold text-zinc-300 hover:text-white"
            >
              Min (${minAllowedBet})
            </button>
            <button
              type="button"
              onClick={() => calcQuickSize('2.5bb')}
              className="py-0.5 px-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-[10px] font-bold text-zinc-300 hover:text-white"
            >
              2.5 BB
            </button>
            <button
              type="button"
              onClick={() => calcQuickSize('half_pot')}
              className="py-0.5 px-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-[10px] font-bold text-zinc-300 hover:text-white"
            >
              1/2 Pot
            </button>
            <button
              type="button"
              onClick={() => calcQuickSize('three_quarter_pot')}
              className="py-0.5 px-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-[10px] font-bold text-zinc-300 hover:text-white"
            >
              3/4 Pot
            </button>
            <button
              type="button"
              onClick={() => calcQuickSize('pot')}
              className="py-0.5 px-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded text-[10px] font-bold text-zinc-300 hover:text-white"
            >
              Pot (${table.pot})
            </button>
            <button
              type="button"
              onClick={() => calcQuickSize('max')}
              className="py-0.5 px-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-[10px] font-bold text-amber-300"
            >
              Max (${maxAllowedBet})
            </button>
          </div>

          {/* Slider & Numeric Input */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setBetAmount(roundBet(betAmount - table.bigBlind))}
              className="p-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 hover:text-white"
            >
              <Minus className="w-3 h-3" />
            </button>

            <input
              type="range"
              min={minAllowedBet}
              max={maxAllowedBet}
              step={table.bigBlind < 1 ? 0.01 : 1}
              value={betAmount}
              onChange={(e) => setBetAmount(roundBet(Number(e.target.value)))}
              className="flex-1 accent-amber-400 bg-zinc-800 rounded h-1.5 cursor-pointer"
            />

            <button
              type="button"
              onClick={() => setBetAmount(roundBet(betAmount + table.bigBlind))}
              className="p-1 bg-zinc-900 border border-zinc-700 rounded text-zinc-300 hover:text-white"
            >
              <Plus className="w-3 h-3" />
            </button>

            <div className="w-20 px-1.5 py-0.5 bg-zinc-900 border border-amber-500/40 rounded text-center font-bold text-amber-300 text-xs">
              ${betAmount}
            </div>
          </div>
        </div>
      )}

      {/* Main Primary Action Buttons: FOLD, CHECK/CALL, BET/RAISE, ALL-IN */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* FOLD */}
        <button
          type="button"
          onClick={handleFold}
          id="action_fold_btn"
          className="py-2 px-1.5 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black rounded-lg text-xs shadow-md shadow-red-900/40 border border-red-400/40 active:scale-95 transition-all"
        >
          {t.btn_fold}
        </button>

        {/* CHECK or CALL */}
        <button
          type="button"
          onClick={handleCheckCall}
          id="action_check_call_btn"
          className="py-2 px-1.5 bg-gradient-to-b from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-black rounded-lg text-xs shadow-md shadow-blue-900/40 border border-blue-400/40 active:scale-95 transition-all flex flex-col items-center justify-center leading-tight"
        >
          <span>{toCall === 0 ? t.btn_check : t.btn_call}</span>
          {toCall > 0 && (
            <span className="text-[10px] opacity-90 font-normal">
              (${Math.min(toCall, player.chips)})
            </span>
          )}
        </button>

        {/* BET or RAISE */}
        <button
          type="button"
          disabled={player.chips <= toCall}
          onClick={handleBetRaise}
          id="action_bet_raise_btn"
          className={`py-2 px-1.5 rounded-lg text-xs font-black shadow-md border active:scale-95 transition-all flex flex-col items-center justify-center leading-tight ${
            player.chips <= toCall
              ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 border-amber-300 shadow-amber-500/25'
          }`}
        >
          <span>{table.currentHighBet === 0 ? t.btn_bet : t.btn_raise}</span>
          <span className="text-[10px] opacity-90 font-bold">(${betAmount})</span>
        </button>

        {/* ALL-IN */}
        <button
          type="button"
          onClick={handleAllIn}
          id="action_all_in_btn"
          className="py-2 px-1.5 bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white font-black rounded-lg text-xs shadow-md shadow-purple-900/40 border border-purple-400/40 active:scale-95 transition-all flex items-center justify-center space-x-1"
        >
          <Flame className="w-3.5 h-3.5 fill-current text-amber-300 shrink-0" />
          <div className="leading-tight">
            <span>{t.btn_all_in}</span>
            <span className="block text-[9.5px] opacity-90 font-normal">(${player.chips})</span>
          </div>
        </button>
      </div>
    </motion.div>
  );
};
