import React from 'react';
import { motion } from 'motion/react';
import { Card, Suit } from '../types/poker';

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  isHighlighted?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'mini';
  isFourColor?: boolean;
  delay?: number;
  className?: string;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  hidden = false,
  isHighlighted = false,
  size = 'md',
  isFourColor = true,
  delay = 0,
  className = '',
}) => {
  // Size dimensions
  const sizeClasses = {
    mini: 'w-5 h-7 text-[8px] rounded-xs',
    xs: 'w-7 h-10 text-[9px] rounded-xs',
    sm: 'w-8 h-11 sm:w-9 sm:h-13 text-[10px] sm:text-xs rounded-sm',
    md: 'w-10 h-14 sm:w-12 sm:h-16 text-xs sm:text-sm rounded-md',
    lg: 'w-16 h-22 sm:w-20 sm:h-28 text-base rounded-lg',
  }[size];

  if (hidden || !card || card.rank === 'hidden' as any) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: -20, rotate: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.25, delay }}
        className={`relative ${sizeClasses} bg-gradient-to-br from-red-900 via-red-800 to-indigo-950 border border-amber-400/40 shadow-md flex items-center justify-center select-none overflow-hidden ${className}`}
      >
        <div className="absolute inset-0.5 border border-amber-300/30 rounded-[inherit] flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-800/80 to-indigo-950/90">
          <div className="w-4 h-4 rounded-full border border-amber-400/50 flex items-center justify-center opacity-75">
            <span className="text-[9px] font-bold text-amber-300">♠</span>
          </div>
        </div>
      </motion.div>
    );
  }

  const getSuitColor = (suit: Suit) => {
    if (!isFourColor) {
      return suit === 'hearts' || suit === 'diamonds' ? 'text-red-600' : 'text-zinc-900';
    }
    switch (suit) {
      case 'hearts':
        return 'text-red-500';
      case 'diamonds':
        return 'text-blue-500';
      case 'clubs':
        return 'text-emerald-500';
      case 'spades':
        return 'text-zinc-900';
    }
  };

  const getSuitSymbol = (suit: Suit) => {
    switch (suit) {
      case 'hearts':
        return '♥';
      case 'diamonds':
        return '♦';
      case 'clubs':
        return '♣';
      case 'spades':
        return '♠';
    }
  };

  const colorClass = getSuitColor(card.suit);
  const symbol = getSuitSymbol(card.suit);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: -25, rotateY: 90 }}
      animate={{ opacity: 1, scale: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`relative ${sizeClasses} bg-white text-zinc-900 font-bold border ${
        isHighlighted
          ? 'border-amber-400 ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-900 shadow-lg shadow-amber-400/30 -translate-y-1.5'
          : 'border-zinc-300 shadow-md'
      } flex flex-col justify-between p-1 select-none transition-transform duration-200 ${className}`}
    >
      {/* Top-left rank & suit */}
      <div className={`flex flex-col items-center leading-none ${colorClass}`}>
        <span className="font-extrabold tracking-tighter">{card.rank}</span>
        <span className="text-[11px] -mt-0.5">{symbol}</span>
      </div>

      {/* Center large suit watermark */}
      <div className={`absolute inset-0 flex items-center justify-center opacity-85 pointer-events-none ${colorClass}`}>
        <span className={size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-base'}>
          {symbol}
        </span>
      </div>

      {/* Bottom-right rank & suit inverted */}
      <div className={`flex flex-col items-center leading-none self-end rotate-180 ${colorClass}`}>
        <span className="font-extrabold tracking-tighter">{card.rank}</span>
        <span className="text-[11px] -mt-0.5">{symbol}</span>
      </div>
    </motion.div>
  );
};
