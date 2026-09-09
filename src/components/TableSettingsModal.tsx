import React from 'react';
import { motion } from 'motion/react';
import { X, Settings, Volume2, VolumeX, Palette, MessageSquare, RefreshCw, Lock, Sparkles, Crown } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { FeltColor } from '../types/poker';
import { soundManager } from '../utils/audioEngine';
import { ALL_VIP_LEVELS } from '../utils/vipProgression';

interface TableSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  feltColor: FeltColor;
  onSelectFeltColor: (color: FeltColor) => void;
  isFourColor: boolean;
  onToggleFourColor: (val: boolean) => void;
  isSoundMuted: boolean;
  onToggleSound: (muted: boolean) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  autoMuck: boolean;
  onToggleAutoMuck: (val: boolean) => void;
  autoRebuy?: boolean;
  onToggleAutoRebuy?: (val: boolean) => void;
  onOpenSupport?: () => void;
  vipLevel?: number;
}

export const TableSettingsModal: React.FC<TableSettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  feltColor,
  onSelectFeltColor,
  isFourColor,
  onToggleFourColor,
  isSoundMuted,
  onToggleSound,
  volume,
  onVolumeChange,
  autoMuck,
  onToggleAutoMuck,
  autoRebuy = true,
  onToggleAutoRebuy,
  onOpenSupport,
  vipLevel = 1,
}) => {
  const t = translations[lang];

  if (!isOpen) return null;

  const feltOptions: {
    id: FeltColor;
    labelAz: string;
    labelEn: string;
    requiredVip: number;
    bgClass: string;
    glowClass?: string;
  }[] = [
    { id: 'emerald', labelAz: 'Zümrüd', labelEn: 'Emerald', requiredVip: 1, bgClass: 'bg-emerald-700' },
    { id: 'sapphire', labelAz: 'Sapfir', labelEn: 'Sapphire', requiredVip: 1, bgClass: 'bg-blue-800' },
    { id: 'crimson', labelAz: 'Qırmızı', labelEn: 'Crimson', requiredVip: 1, bgClass: 'bg-rose-900' },
    { id: 'charcoal', labelAz: 'Kömür', labelEn: 'Charcoal', requiredVip: 1, bgClass: 'bg-zinc-800' },
    { id: 'midnight_blue', labelAz: 'Gecə Mavisi', labelEn: 'Midnight Blue', requiredVip: 2, bgClass: 'bg-slate-900', glowClass: 'ring-cyan-500/50' },
    { id: 'royal_velvet', labelAz: 'Kral Məxməri', labelEn: 'Royal Velvet', requiredVip: 3, bgClass: 'bg-purple-900', glowClass: 'ring-purple-400/50' },
    { id: 'cyber_neon', labelAz: 'Kiber Neon', labelEn: 'Cyber Neon', requiredVip: 4, bgClass: 'bg-cyan-900', glowClass: 'ring-cyan-400/60' },
    { id: 'ruby_luxury', labelAz: 'Yaqut Lüks', labelEn: 'Ruby Luxury', requiredVip: 5, bgClass: 'bg-rose-950', glowClass: 'ring-rose-500/60' },
    { id: 'diamond_prestige', labelAz: 'Almaz Prestij', labelEn: 'Diamond Prestige', requiredVip: 6, bgClass: 'bg-sky-900', glowClass: 'ring-sky-300/70' },
    { id: 'galactic_void', labelAz: 'Qalaktik Kosmos', labelEn: 'Galactic Void', requiredVip: 7, bgClass: 'bg-violet-950', glowClass: 'ring-violet-400/70' },
    { id: 'golden_mirage', labelAz: 'Qızıl Saray', labelEn: 'Golden Mirage', requiredVip: 8, bgClass: 'bg-amber-900', glowClass: 'ring-yellow-400/90' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-zinc-100 shadow-2xl shadow-black/90 my-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{t.table_settings}</h2>
              <p className="text-xs text-zinc-400">
                {lang === 'az' ? 'Masa və oyun parametrlərini fərdiləşdirin' : 'Customize table appearance & audio'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="table_settings_close_btn"
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Felt Color Selection & VIP Exclusives */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center space-x-1.5">
                <Palette className="w-4 h-4 text-amber-400" />
                <span>{t.felt_color}</span>
              </label>
              <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                <Crown className="w-3 h-3" />
                <span>Cari VIP: Səviyyə {vipLevel}</span>
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {feltOptions.map((item) => {
                const isUnlocked = vipLevel >= item.requiredVip;
                const isSelected = feltColor === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => {
                      if (isUnlocked) {
                        onSelectFeltColor(item.id);
                        soundManager.playButtonClick();
                      }
                    }}
                    className={`relative p-2.5 rounded-xl border flex items-center space-x-2.5 text-left transition-all ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-400 ring-2 ring-amber-400/40 text-amber-300 shadow-md shadow-amber-500/10'
                        : isUnlocked
                        ? 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-850 cursor-pointer'
                        : 'bg-zinc-950/60 border-zinc-900 text-zinc-600 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <span className={`block w-6 h-6 rounded-full ${item.bgClass} border border-white/20 shadow-inner`} />
                      {!isUnlocked && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full text-amber-400">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">
                        {lang === 'az' ? item.labelAz : item.labelEn}
                      </div>
                      <div className="text-[10px] font-medium text-zinc-500">
                        {item.requiredVip === 1 ? (
                          <span className="text-zinc-400">Standart</span>
                        ) : (
                          <span className={isUnlocked ? 'text-amber-400/90 font-bold' : 'text-zinc-600'}>
                            VIP {item.requiredVip}+
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4-Color Deck Toggle */}
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">
                {lang === 'az' ? '4 Rəngli Kart Dəsti (4-Color Deck)' : '4-Color Deck'}
              </div>
              <div className="text-[11px] text-zinc-400">
                ♠ Qara, ♥ Qırmızı, ♦ Mavi, ♣ Yaşıl
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onToggleFourColor(!isFourColor);
                soundManager.playButtonClick();
              }}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                isFourColor ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-zinc-950 transition-transform ${
                  isFourColor ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sound Volume & Mute */}
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isSoundMuted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-xs font-bold text-white">
                  {lang === 'az' ? 'Səs Effektləri' : 'Sound Effects'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleSound(!isSoundMuted);
                  soundManager.setMuted(!isSoundMuted);
                  soundManager.playButtonClick();
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  isSoundMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {isSoundMuted ? (lang === 'az' ? 'Səssiz' : 'Muted') : (lang === 'az' ? 'Aktiv' : 'Active')}
              </button>
            </div>

            {!isSoundMuted && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>{lang === 'az' ? 'Səs Həcmi' : 'Volume'}</span>
                  <span>{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onVolumeChange(v);
                    soundManager.setVolume(v);
                  }}
                  className="w-full accent-amber-400 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>
            )}
          </div>

          {/* Auto Muck Losing Hands */}
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">
                {lang === 'az' ? 'Məğlub kartları avtomatik gizlət (Auto-Muck)' : 'Auto Muck Losing Hands'}
              </div>
              <div className="text-[11px] text-zinc-400">
                {lang === 'az' ? 'Məğlub olduqda kartlarınızı digər oyunçulara göstərmir' : "Don't show losing cards at showdown"}
              </div>
            </div>
            <button
              type="button"
              id="settings_toggle_automuck_btn"
              onClick={() => {
                onToggleAutoMuck(!autoMuck);
                soundManager.playButtonClick();
              }}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                autoMuck ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-zinc-950 transition-transform ${
                  autoMuck ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Auto-Rebuy Toggle (< 20 Big Blinds) */}
          <div className="p-3 bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/20 border border-zinc-800 hover:border-amber-500/30 rounded-xl flex items-center justify-between transition-colors">
            <div className="pr-3">
              <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.auto_rebuy_title}</span>
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                {t.auto_rebuy_desc}
              </div>
            </div>
            <button
              type="button"
              id="settings_toggle_autorebuy_btn"
              onClick={() => {
                if (onToggleAutoRebuy) {
                  onToggleAutoRebuy(!autoRebuy);
                }
                soundManager.playButtonClick();
              }}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${
                autoRebuy ? 'bg-amber-500' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-zinc-950 transition-transform ${
                  autoRebuy ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Adminlə Canlı Əlaqə / Dəstək Düyməsi */}
          {onOpenSupport && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  onClose();
                  onOpenSupport();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 hover:from-amber-500 hover:to-yellow-400 text-amber-300 hover:text-zinc-950 border border-amber-500/40 font-black text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer group"
              >
                <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>{lang === 'az' ? '💬 Adminlə Əlaqə Saxla (Mesaj Qutusu)' : '💬 Contact Admin (Live Chat)'}</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
