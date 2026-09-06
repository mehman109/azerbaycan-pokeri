import React from 'react';
import { motion } from 'motion/react';
import { X, Settings, Volume2, VolumeX, Eye, Check, Palette, MessageSquare, Headphones } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { FeltColor } from '../types/poker';
import { soundManager } from '../utils/audioEngine';

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
  onOpenSupport?: () => void;
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
  onOpenSupport,
}) => {
  const t = translations[lang];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-zinc-100 shadow-2xl shadow-black/90 my-8"
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
          {/* Felt Color Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2 flex items-center space-x-1.5">
              <Palette className="w-4 h-4 text-amber-400" />
              <span>{t.felt_color}</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'emerald', label: 'Yaşıl', labelEn: 'Emerald', bg: 'bg-emerald-700' },
                { id: 'sapphire', label: 'Mavi', labelEn: 'Sapphire', bg: 'bg-blue-800' },
                { id: 'crimson', label: 'Qırmızı', labelEn: 'Crimson', bg: 'bg-rose-900' },
                { id: 'charcoal', label: 'Qara', labelEn: 'Charcoal', bg: 'bg-zinc-800' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectFeltColor(item.id as FeltColor);
                    soundManager.playButtonClick();
                  }}
                  className={`p-2 rounded-xl border flex flex-col items-center space-y-1 transition-all ${
                    feltColor === item.id
                      ? 'bg-zinc-900 border-amber-400 ring-2 ring-amber-400/40 text-amber-300'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full ${item.bg} border border-white/20`} />
                  <span className="text-[11px] font-semibold">{lang === 'az' ? item.label : item.labelEn}</span>
                </button>
              ))}
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
