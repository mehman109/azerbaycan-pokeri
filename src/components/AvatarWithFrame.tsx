import React from 'react';
import { AvatarFrameId } from '../types/poker';
import { Crown, Sparkles, Flame, Shield, Diamond, Zap } from 'lucide-react';

interface AvatarWithFrameProps {
  src: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  frameId?: AvatarFrameId;
  vipLevel?: number;
  className?: string;
  showLevelBadge?: boolean;
}

const SIZE_MAP = {
  xs: { box: 'w-7 h-7', img: 'w-6 h-6', badge: 'text-[9px] -bottom-1 -right-1 px-1', iconSize: 10 },
  sm: { box: 'w-10 h-10', img: 'w-9 h-9', badge: 'text-[10px] -bottom-1 -right-1 px-1.5', iconSize: 12 },
  md: { box: 'w-12 h-12', img: 'w-11 h-11', badge: 'text-[11px] -bottom-1 -right-1 px-1.5', iconSize: 14 },
  lg: { box: 'w-16 h-16', img: 'w-14 h-14', badge: 'text-xs -bottom-1.5 -right-1.5 px-2 py-0.5', iconSize: 16 },
  xl: { box: 'w-20 h-20', img: 'w-18 h-18', badge: 'text-xs -bottom-2 -right-2 px-2.5 py-0.5', iconSize: 18 },
  '2xl': { box: 'w-28 h-28', img: 'w-24 h-24', badge: 'text-sm -bottom-2.5 -right-2.5 px-3 py-1', iconSize: 22 },
};

export const AvatarWithFrame: React.FC<AvatarWithFrameProps> = ({
  src,
  alt,
  size = 'md',
  frameId = 'default',
  vipLevel,
  className = '',
  showLevelBadge = false,
}) => {
  const s = SIZE_MAP[size] || SIZE_MAP.md;

  // Determine frame decoration styles
  const renderFrameOverlays = () => {
    switch (frameId) {
      case 'silver_chrome':
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-slate-300 shadow-[0_0_12px_rgba(226,232,240,0.85)] pointer-events-none animate-pulse" />
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-slate-400/30 via-white/40 to-slate-400/30 pointer-events-none blur-[1px]" />
          </>
        );

      case 'gold_ace':
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.9)] pointer-events-none" />
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-500/20 via-yellow-300/40 to-amber-600/20 pointer-events-none blur-[2px] animate-pulse" />
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] pointer-events-none">
              <Sparkles size={s.iconSize} className="animate-spin text-yellow-300" style={{ animationDuration: '6s' }} />
            </div>
          </>
        );

      case 'platinum_pulse':
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.95)] pointer-events-none animate-pulse" />
            <div className="absolute -inset-1 rounded-full border border-cyan-300/60 pointer-events-none scale-105" />
            <div className="absolute -top-1.5 right-0 text-cyan-300 pointer-events-none">
              <Zap size={s.iconSize} className="animate-bounce" />
            </div>
          </>
        );

      case 'ruby_dragon':
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.95)] pointer-events-none" />
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-rose-600/30 via-red-500/20 to-orange-500/30 pointer-events-none blur-[2px] animate-pulse" />
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-rose-400 pointer-events-none">
              <Flame size={s.iconSize} className="animate-pulse" />
            </div>
          </>
        );

      case 'diamond_shimmer':
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-sky-300 shadow-[0_0_20px_rgba(186,230,253,1)] pointer-events-none animate-pulse" />
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-sky-400/30 via-blue-200/40 to-indigo-400/30 pointer-events-none blur-[2px]" />
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-sky-200 pointer-events-none">
              <Diamond size={s.iconSize} className="animate-bounce" />
            </div>
          </>
        );

      case 'obsidian_galaxy':
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-violet-400 shadow-[0_0_22px_rgba(167,139,250,1)] pointer-events-none animate-pulse" />
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-purple-600/40 via-fuchsia-500/30 to-violet-900/50 pointer-events-none blur-[2px]" />
            <div className="absolute -top-2 right-0 text-violet-300 pointer-events-none">
              <Sparkles size={s.iconSize} className="animate-spin" style={{ animationDuration: '4s' }} />
            </div>
          </>
        );

      case 'crown_olympus':
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-yellow-300 shadow-[0_0_26px_rgba(253,224,71,1)] pointer-events-none animate-pulse" />
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-400/40 via-yellow-200/50 to-amber-600/40 pointer-events-none blur-[3px]" />
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,1)] pointer-events-none">
              <Crown size={Math.round(s.iconSize * 1.3)} className="fill-amber-300 animate-bounce" />
            </div>
          </>
        );

      default:
        return (
          <div className="absolute inset-0 rounded-full border border-amber-600/40 shadow-sm pointer-events-none" />
        );
    }
  };

  // Level badge styling
  const getBadgeStyle = (lvl: number) => {
    if (lvl >= 8) return 'bg-gradient-to-r from-amber-400 to-yellow-300 text-zinc-950 font-black border border-yellow-200 shadow-md shadow-amber-500/50';
    if (lvl >= 7) return 'bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white font-bold border border-violet-300 shadow-sm';
    if (lvl >= 6) return 'bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold border border-sky-300 shadow-sm';
    if (lvl >= 5) return 'bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold border border-rose-300 shadow-sm';
    if (lvl >= 4) return 'bg-gradient-to-r from-cyan-500 to-teal-500 text-zinc-950 font-bold border border-cyan-300 shadow-sm';
    if (lvl >= 3) return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-black border border-amber-300 shadow-sm';
    if (lvl >= 2) return 'bg-gradient-to-r from-slate-400 to-slate-200 text-zinc-950 font-bold border border-slate-300 shadow-sm';
    return 'bg-zinc-800 text-zinc-300 font-semibold border border-zinc-700';
  };

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${s.box} ${className}`}>
      {/* Dynamic Animated Frame Overlays */}
      {renderFrameOverlays()}

      {/* Avatar Image */}
      <img
        src={src}
        alt={alt}
        className={`rounded-full object-cover relative z-10 ${s.img}`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';
        }}
      />

      {/* Optional VIP Level Badge attached to corner */}
      {showLevelBadge && vipLevel !== undefined && (
        <span
          className={`absolute z-20 rounded-full leading-none flex items-center justify-center ${s.badge} ${getBadgeStyle(
            vipLevel
          )}`}
        >
          VIP {vipLevel}
        </span>
      )}
    </div>
  );
};
