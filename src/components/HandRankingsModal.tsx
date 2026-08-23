import React from 'react';
import { motion } from 'motion/react';
import { X, Award, Info } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { PlayingCard } from './PlayingCard';
import { Card } from '../types/poker';

interface HandRankingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const HandRankingsModal: React.FC<HandRankingsModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const t = translations[lang];

  if (!isOpen) return null;

  const ranksList: {
    name: string;
    descAz: string;
    descEn: string;
    cards: Card[];
  }[] = [
    {
      name: t.rank_royal_flush,
      descAz: 'Eyni rəngdə A, K, Q, J, 10 — Pokerin ən güclü əli',
      descEn: 'A, K, Q, J, 10 of the same suit — The unbeatable hand',
      cards: [
        { suit: 'spades', rank: 'A', id: 'c1' },
        { suit: 'spades', rank: 'K', id: 'c2' },
        { suit: 'spades', rank: 'Q', id: 'c3' },
        { suit: 'spades', rank: 'J', id: 'c4' },
        { suit: 'spades', rank: 'T', id: 'c5' },
      ],
    },
    {
      name: t.rank_straight_flush,
      descAz: 'Eyni rəngdə ardıcıl 5 kart (Məs: 9, 8, 7, 6, 5)',
      descEn: 'Five cards of sequential rank, all the same suit',
      cards: [
        { suit: 'hearts', rank: '9', id: 'c6' },
        { suit: 'hearts', rank: '8', id: 'c7' },
        { suit: 'hearts', rank: '7', id: 'c8' },
        { suit: 'hearts', rank: '6', id: 'c9' },
        { suit: 'hearts', rank: '5', id: 'c10' },
      ],
    },
    {
      name: t.rank_four_of_a_kind,
      descAz: 'Eyni dərəcəli 4 kart (Kare)',
      descEn: 'Four cards of the same numerical or face rank',
      cards: [
        { suit: 'diamonds', rank: 'K', id: 'c11' },
        { suit: 'spades', rank: 'K', id: 'c12' },
        { suit: 'hearts', rank: 'K', id: 'c13' },
        { suit: 'clubs', rank: 'K', id: 'c14' },
        { suit: 'spades', rank: '4', id: 'c15' },
      ],
    },
    {
      name: t.rank_full_house,
      descAz: 'Bir üçlük (Set) və bir cütlük (Pair) birlikdə',
      descEn: 'Three of a kind combined with a pair',
      cards: [
        { suit: 'spades', rank: 'J', id: 'c16' },
        { suit: 'hearts', rank: 'J', id: 'c17' },
        { suit: 'diamonds', rank: 'J', id: 'c18' },
        { suit: 'clubs', rank: '8', id: 'c19' },
        { suit: 'spades', rank: '8', id: 'c20' },
      ],
    },
    {
      name: t.rank_flush,
      descAz: 'Eyni rəngdən olan istənilən 5 kart',
      descEn: 'Any five cards of the exact same suit (not sequential)',
      cards: [
        { suit: 'clubs', rank: 'A', id: 'c21' },
        { suit: 'clubs', rank: 'J', id: 'c22' },
        { suit: 'clubs', rank: '9', id: 'c23' },
        { suit: 'clubs', rank: '6', id: 'c24' },
        { suit: 'clubs', rank: '3', id: 'c25' },
      ],
    },
    {
      name: t.rank_straight,
      descAz: 'Müxtəlif rənglərdə ardıcıl 5 kart',
      descEn: 'Five cards in sequential order of different suits',
      cards: [
        { suit: 'diamonds', rank: 'T', id: 'c26' },
        { suit: 'hearts', rank: '9', id: 'c27' },
        { suit: 'spades', rank: '8', id: 'c28' },
        { suit: 'clubs', rank: '7', id: 'c29' },
        { suit: 'diamonds', rank: '6', id: 'c30' },
      ],
    },
    {
      name: t.rank_three_of_a_kind,
      descAz: 'Eyni dərəcəli 3 kart (Set / Trips)',
      descEn: 'Three cards of the exact same rank',
      cards: [
        { suit: 'hearts', rank: '7', id: 'c31' },
        { suit: 'spades', rank: '7', id: 'c32' },
        { suit: 'clubs', rank: '7', id: 'c33' },
        { suit: 'diamonds', rank: 'K', id: 'c34' },
        { suit: 'spades', rank: '2', id: 'c35' },
      ],
    },
    {
      name: t.rank_two_pair,
      descAz: 'İki ayrı cütlük kart',
      descEn: 'Two distinct pairs of cards',
      cards: [
        { suit: 'spades', rank: 'Q', id: 'c36' },
        { suit: 'hearts', rank: 'Q', id: 'c37' },
        { suit: 'clubs', rank: '5', id: 'c38' },
        { suit: 'diamonds', rank: '5', id: 'c39' },
        { suit: 'spades', rank: 'A', id: 'c40' },
      ],
    },
    {
      name: t.rank_one_pair,
      descAz: 'Eyni dərəcəli 2 kart',
      descEn: 'Two cards of the exact same rank',
      cards: [
        { suit: 'diamonds', rank: 'A', id: 'c41' },
        { suit: 'clubs', rank: 'A', id: 'c42' },
        { suit: 'hearts', rank: 'K', id: 'c43' },
        { suit: 'spades', rank: 'T', id: 'c44' },
        { suit: 'diamonds', rank: '4', id: 'c45' },
      ],
    },
    {
      name: t.rank_high_card,
      descAz: 'Heç bir kombinasiya olmadıqda ən böyük kart',
      descEn: 'When no combination is formed, highest card plays',
      cards: [
        { suit: 'spades', rank: 'A', id: 'c46' },
        { suit: 'hearts', rank: 'J', id: 'c47' },
        { suit: 'diamonds', rank: '8', id: 'c48' },
        { suit: 'clubs', rank: '6', id: 'c49' },
        { suit: 'spades', rank: '2', id: 'c50' },
      ],
    },
  ];

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
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">{t.hand_rankings}</h2>
              <p className="text-xs text-zinc-400">
                {lang === 'az'
                  ? 'Güclüdən zəifə doğru bütün poker kombinasiyaları'
                  : 'Poker hand hierarchies ranked highest to lowest'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="hand_rankings_close_btn"
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-3 mt-4 flex-1">
          {ranksList.map((rank, idx) => (
            <div
              key={rank.name}
              className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="font-bold text-sm text-white">{rank.name}</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 pl-7">
                  {lang === 'az' ? rank.descAz : rank.descEn}
                </p>
              </div>

              <div className="flex items-center space-x-1 pl-7 sm:pl-0 shrink-0">
                {rank.cards.map((c) => (
                  <PlayingCard key={c.id} card={c} size="sm" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
