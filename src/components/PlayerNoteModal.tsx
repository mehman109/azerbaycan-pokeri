import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Player } from '../types/poker';
import {
  PlayerNoteColor,
  PLAYER_NOTE_PRESETS,
  getPlayerNote,
  savePlayerNote,
  deletePlayerNote,
} from '../utils/playerNotes';
import { Language } from '../utils/translations';
import { soundManager } from '../utils/audioEngine';
import {
  X,
  Tag,
  FileText,
  Trash2,
  Save,
  Check,
  User,
  Bot,
  Sparkles
} from 'lucide-react';

interface PlayerNoteModalProps {
  player: Player | null;
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onNoteUpdated: () => void;
}

export const PlayerNoteModal: React.FC<PlayerNoteModalProps> = ({
  player,
  isOpen,
  onClose,
  lang,
  onNoteUpdated,
}) => {
  const [selectedColor, setSelectedColor] = useState<PlayerNoteColor | undefined>(undefined);
  const [noteText, setNoteText] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (player && isOpen) {
      const existing = getPlayerNote(player.name);
      if (existing) {
        setSelectedColor(existing.color);
        setNoteText(existing.noteText || '');
        setCustomLabel(existing.label || '');
      } else {
        setSelectedColor(undefined);
        setNoteText('');
        setCustomLabel('');
      }
      setSavedFeedback(false);
    }
  }, [player, isOpen]);

  if (!isOpen || !player) return null;

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    soundManager.playButtonClick();

    if (!selectedColor && !noteText.trim()) {
      deletePlayerNote(player.name);
    } else {
      savePlayerNote(player.name, {
        color: selectedColor,
        label: customLabel.trim() || undefined,
        noteText: noteText.trim(),
        updatedAt: Date.now(),
      });
    }

    setSavedFeedback(true);
    onNoteUpdated();
    setTimeout(() => {
      onClose();
    }, 400);
  };

  const handleDelete = () => {
    soundManager.playButtonClick();
    deletePlayerNote(player.name);
    setSelectedColor(undefined);
    setNoteText('');
    setCustomLabel('');
    onNoteUpdated();
    onClose();
  };

  const activePreset = PLAYER_NOTE_PRESETS.find((p) => p.color === selectedColor);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 15 }}
          className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-zinc-900/90 border-b border-zinc-800 p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img
                  src={player.avatar}
                  alt={player.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border-2 border-zinc-700 bg-zinc-800 shadow"
                />
                {selectedColor && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${
                      activePreset?.badgeBg || 'bg-amber-400'
                    }`}
                  />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight">{player.name}</h3>
                  {player.isHuman ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-0.5">
                      <User className="w-2.5 h-2.5" />
                      <span>{lang === 'az' ? 'Oyunçu' : 'Human'}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center space-x-0.5">
                      <Bot className="w-2.5 h-2.5" />
                      <span>Bot</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  {lang === 'az' ? 'Masa Balansı:' : 'Table Stack:'} <span className="text-amber-400 font-bold">${player.chips}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSave} className="p-4 space-y-4">
            {/* Color-Coded Style Preset Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'az' ? 'Rəngli Qeyd & Oyun Tərzi:' : 'Color Label & Play Style:'}</span>
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                {PLAYER_NOTE_PRESETS.map((preset) => {
                  const isSelected = selectedColor === preset.color;
                  return (
                    <button
                      key={preset.color}
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        if (selectedColor === preset.color) {
                          setSelectedColor(undefined);
                        } else {
                          setSelectedColor(preset.color);
                        }
                      }}
                      className={`px-2 py-2 rounded-xl text-[11px] font-bold border transition-all flex items-center space-x-1.5 cursor-pointer text-left ${
                        isSelected
                          ? `${preset.bgClass} ${preset.borderClass} ${preset.textClass} ring-2 ${preset.ringClass} shadow-md`
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${preset.badgeBg} shrink-0`} />
                      <span className="truncate">{lang === 'az' ? preset.labelAz : preset.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes Freeform Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'az' ? 'Fərdi Əl Qeydləri (Local Storage):' : 'Player Hand Notes (Saved Locally):'}</span>
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={
                  lang === 'az'
                    ? 'Məs: Flopda aqressiv reyz edir, riverdə yalnız natslarla oynayır...'
                    : 'e.g., 3-bets light in position, checks back medium strength hands on turn...'
                }
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors resize-none"
              />
              <p className="text-[10px] text-zinc-500 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-amber-400/70" />
                <span>
                  {lang === 'az'
                    ? 'Qeydlər brauzerinizin yaddaşında saxlanılır və digər oyunçular tərəfindən görünmür.'
                    : 'Notes are securely saved to your local browser storage and private only to you.'}
                </span>
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-2 border-t border-zinc-850">
              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 border border-zinc-800 hover:border-red-500/40 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'az' ? 'Sil' : 'Delete'}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  {lang === 'az' ? 'Bağla' : 'Cancel'}
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 active:scale-95 flex items-center space-x-1.5 cursor-pointer"
                >
                  {savedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{lang === 'az' ? 'Saxlanıldı!' : 'Saved!'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{lang === 'az' ? 'Yadda saxla' : 'Save Note'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
