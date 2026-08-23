import React from 'react';
import { motion } from 'motion/react';
import { X, History, Trophy, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { HandHistoryRecord } from '../types/poker';
import { translations, Language } from '../utils/translations';
import { PlayingCard } from './PlayingCard';

interface HandHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  history: HandHistoryRecord[];
}

export const HandHistoryModal: React.FC<HandHistoryModalProps> = ({
  isOpen,
  onClose,
  lang,
  history,
}) => {
  const t = translations[lang];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-zinc-100 shadow-2xl shadow-black/90 my-8 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{t.hand_history}</h2>
              <p className="text-xs text-zinc-400">
                {lang === 'az' ? 'Son oynanılan əllərin nəticələri və kartları' : 'Recent hand replays and showdown results'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="hand_history_close_btn"
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-3 mt-4 flex-1">
          {history.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">
              {lang === 'az' ? 'Hələ heç bir əl tamamlanmayıb.' : 'No completed hands recorded yet.'}
            </div>
          ) : (
            history.map((record) => (
              <div
                key={record.id}
                className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-amber-400">#{record.handNumber}</span>
                    <span className="text-zinc-400">• {record.tableName}</span>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                      {record.blinds}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-zinc-400">{t.main_pot}:</span>
                    <span className="font-bold text-emerald-400">${record.pot}</span>
                  </div>
                </div>

                {/* Community Cards */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-zinc-800/60">
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-1">
                      {lang === 'az' ? 'Masa Kartları (Board):' : 'Community Board:'}
                    </span>
                    <div className="flex space-x-1">
                      {record.communityCards.length > 0 ? (
                        record.communityCards.map((c) => (
                          <PlayingCard key={c.id} card={c} size="sm" />
                        ))
                      ) : (
                        <span className="text-xs text-zinc-600 italic">Pre-flop fold</span>
                      )}
                    </div>
                  </div>

                  {/* Player Hand & Profit */}
                  <div>
                    <span className="text-[11px] text-zinc-400 block mb-1">
                      {lang === 'az' ? 'Sizin Əliniz:' : 'Your Cards:'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        {record.playerCards.map((c) => (
                          <PlayingCard key={c.id} card={c} size="sm" />
                        ))}
                      </div>
                      <div
                        className={`text-xs font-bold px-2 py-1 rounded flex items-center space-x-1 ${
                          record.playerProfit > 0
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                            : record.playerProfit < 0
                            ? 'bg-red-950/80 text-red-400 border border-red-500/40'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {record.playerProfit > 0 ? <ArrowDownRight className="w-3.5 h-3.5" /> : record.playerProfit < 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : null}
                        <span>
                          {record.playerProfit > 0 ? `+$${record.playerProfit}` : record.playerProfit < 0 ? `-$${Math.abs(record.playerProfit)}` : '$0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Winner Info */}
                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-zinc-300">
                      {lang === 'az' ? 'Qalib' : 'Winner'}: <strong className="text-amber-300">{record.winners[0]?.name}</strong> ({record.winners[0]?.handName})
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
