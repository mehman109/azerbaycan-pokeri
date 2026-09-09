import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GameType, TableCapacity, FeltColor, StakesTier } from '../types/poker';
import { translations, Language } from '../utils/translations';
import { X, Lock, Users, Clock, Palette, Sparkles, Copy, Check } from 'lucide-react';
import { soundManager } from '../utils/audioEngine';

interface CreateTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onEnterActiveTables?: () => void;
  onCreateTable: (tableData: {
    name: string;
    gameType: GameType;
    capacity: TableCapacity;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
    timeBank: number;
    passcode?: string;
    feltColor: FeltColor;
    stakesTier: StakesTier;
  }) => void;
}

export const CreateTableModal: React.FC<CreateTableModalProps> = ({
  isOpen,
  onClose,
  lang,
  onEnterActiveTables,
  onCreateTable,
}) => {
  const t = translations[lang];
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [gameType, setGameType] = useState<GameType>('texas_holdem');
  const [capacity, setCapacity] = useState<TableCapacity>(6);
  const [blindLevel, setBlindLevel] = useState<{ sb: number; bb: number; tier: StakesTier }>({
    sb: 1,
    bb: 2,
    tier: 'low',
  });
  const [timeBank, setTimeBank] = useState<number>(30);
  const [feltColor, setFeltColor] = useState<FeltColor>('emerald');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const blindPresets: { sb: number; bb: number; label: string; tier: StakesTier }[] = [
    { sb: 0.02, bb: 0.04, label: '$0.02 / $0.04 (Micro)', tier: 'micro' },
    { sb: 0.05, bb: 0.10, label: '$0.05 / $0.10 (Micro)', tier: 'micro' },
    { sb: 0.10, bb: 0.20, label: '$0.10 / $0.20 (Low)', tier: 'low' },
    { sb: 5.00, bb: 10.00, label: '$5.00 / $10.00 (Mid)', tier: 'mid' },
    { sb: 8.00, bb: 16.00, label: '$8.00 / $16.00 (High)', tier: 'high' },
    { sb: 25.00, bb: 50.00, label: '$25.00 / $50.00 (VIP)', tier: 'high' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playButtonClick();
    const finalName = name.trim() || (lang === 'az' ? 'Şəxsi Poker Masası' : 'Private Poker Room');
    onCreateTable({
      name: finalName,
      gameType,
      capacity,
      smallBlind: blindLevel.sb,
      bigBlind: blindLevel.bb,
      minBuyIn: blindLevel.bb * 20,
      maxBuyIn: blindLevel.bb * 100,
      timeBank,
      passcode: passcode.trim() || undefined,
      feltColor,
      stakesTier: blindLevel.tier,
    });
    onClose();
  };

  const handleCopyInvite = () => {
    soundManager.playButtonClick();
    navigator.clipboard?.writeText(`https://pokerarena.pro/table/join?room=${encodeURIComponent(name || 'VIP-Room')}&pwd=${passcode || ''}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full max-w-md h-full bg-zinc-950 border-l border-amber-500/40 p-5 sm:p-6 text-zinc-100 shadow-2xl shadow-black/90 overflow-y-auto flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-850">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">{t.create_table_title}</h2>
                <p className="text-[11px] text-zinc-400">{t.create_table_desc}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              id="create_table_close_btn"
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} id="create_custom_table_form" className="space-y-4">
            {/* Table Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                {t.table_name} *
              </label>
              <input
                type="text"
                id="table_name_input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.table_name_placeholder}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Game Type & Capacity */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t.poker_type}
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setGameType('texas_holdem')}
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      gameType === 'texas_holdem'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Hold'em
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameType('omaha_plo')}
                    className={`py-1.5 px-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      gameType === 'omaha_plo'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Omaha
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  {t.max_players}
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {([2, 6, 9] as TableCapacity[]).map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setCapacity(cap)}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                        capacity === cap
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {cap}M
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stakes & Blinds */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                {t.small_big_blind}
              </label>
              <select
                value={`${blindLevel.sb}_${blindLevel.bb}`}
                onChange={(e) => {
                  const [sb, bb] = e.target.value.split('_').map(Number);
                  const matched = blindPresets.find(p => p.sb === sb && p.bb === bb);
                  if (matched) setBlindLevel(matched);
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                {blindPresets.map((p) => (
                  <option key={`${p.sb}_${p.bb}`} value={`${p.sb}_${p.bb}`}>
                    {p.label} — Min: ${p.bb * 20} / Max: ${p.bb * 100}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Bank & Felt Color */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t.time_bank}</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[15, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setTimeBank(sec)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        timeBank === sec
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {sec} san
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center space-x-1">
                  <Palette className="w-3.5 h-3.5" />
                  <span>{t.felt_color}</span>
                </label>
                <div className="flex space-x-1.5 pt-0.5">
                  {(['emerald', 'sapphire', 'crimson', 'charcoal'] as FeltColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFeltColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        c === 'emerald' ? 'bg-emerald-700' :
                        c === 'sapphire' ? 'bg-blue-800' :
                        c === 'crimson' ? 'bg-rose-900' : 'bg-zinc-800'
                      } ${feltColor === c ? 'scale-110 border-amber-400 ring-2 ring-amber-400/50' : 'border-zinc-700'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Optional Password */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5" />
                <span>{t.table_passcode}</span>
              </label>
              <input
                type="text"
                id="table_passcode_input"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder={t.table_passcode_placeholder}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-3 space-y-2">
              <button
                type="submit"
                id="submit_create_table_btn"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t.btn_create_and_join}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                id="cancel_create_table_btn"
                className="w-full py-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer text-center"
              >
                {lang === 'az' ? 'Ləğv et' : 'Cancel'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
