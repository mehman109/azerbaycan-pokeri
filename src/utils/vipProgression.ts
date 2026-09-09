import { AvatarFrameId, FeltColor, UserProfile } from '../types/poker';

export interface VipTierInfo {
  level: number;
  nameAz: string;
  nameEn: string;
  badgeTitle: string;
  minXp: number;
  maxXp: number;
  avatarFrame: {
    id: AvatarFrameId;
    nameAz: string;
    nameEn: string;
    descriptionAz: string;
    descriptionEn: string;
    ringCss: string;
    glowCss: string;
    badgeIcon: string;
    sampleBorder: string;
  };
  feltColor: {
    id: FeltColor;
    nameAz: string;
    nameEn: string;
    descriptionAz: string;
    descriptionEn: string;
    bgClass: string;
    tableGradient: string;
    feltBorder: string;
    accentColor: string;
  };
  perksAz: string[];
  perksEn: string[];
  colorTheme: {
    gradient: string;
    border: string;
    text: string;
    glow: string;
    badgeBg: string;
  };
}

export const ALL_VIP_LEVELS: VipTierInfo[] = [
  {
    level: 1,
    nameAz: 'Bürünc Başlanğıc',
    nameEn: 'Bronze Recruit',
    badgeTitle: 'BRONZE I',
    minXp: 0,
    maxXp: 100,
    avatarFrame: {
      id: 'default',
      nameAz: 'Klassik Bürünc Haşiyə',
      nameEn: 'Classic Bronze Rim',
      descriptionAz: 'Klassik standart poker avatar halqası',
      descriptionEn: 'Standard classic poker avatar rim',
      ringCss: 'ring-2 ring-amber-700/60',
      glowCss: 'shadow-md shadow-amber-950/40',
      badgeIcon: '🥉',
      sampleBorder: 'border-amber-700/60'
    },
    feltColor: {
      id: 'emerald',
      nameAz: 'Klassik Zümrüd',
      nameEn: 'Classic Emerald',
      descriptionAz: 'Ənənəvi kazino yaşıl mahud örtüyü',
      descriptionEn: 'Traditional casino green poker felt',
      bgClass: 'bg-emerald-800',
      tableGradient: 'radial-gradient(ellipse at center, #065f46 0%, #047857 45%, #064e3b 85%, #022c22 100%)',
      feltBorder: 'border-amber-700/70',
      accentColor: '#10b981'
    },
    perksAz: [
      'Bütün real-money və pulsuz masalara giriş',
      'Hər oynanılan real ələ görə +10 XP qazanma',
      'Klassik masa örtükləri (Emerald, Sapphire, Crimson, Charcoal)'
    ],
    perksEn: [
      'Access to all real-money and free tables',
      'Earn +10 XP for every real-money hand played',
      'Classic table felts (Emerald, Sapphire, Crimson, Charcoal)'
    ],
    colorTheme: {
      gradient: 'from-amber-800 via-amber-700 to-amber-900',
      border: 'border-amber-700/60',
      text: 'text-amber-500',
      glow: 'shadow-amber-800/30',
      badgeBg: 'bg-amber-900/60 text-amber-300'
    }
  },
  {
    level: 2,
    nameAz: 'Gümüş Qartal',
    nameEn: 'Silver Ace',
    badgeTitle: 'SILVER II',
    minXp: 100,
    maxXp: 300,
    avatarFrame: {
      id: 'silver_chrome',
      nameAz: 'Gümüş Xrom Lazer Çərçivə',
      nameEn: 'Silver Chrome Frame',
      descriptionAz: 'Metallik cilalanmış parıltılı gümüş çərçivə',
      descriptionEn: 'Polished metallic chrome glowing border',
      ringCss: 'ring-2 ring-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.7)] animate-pulse',
      glowCss: 'shadow-lg shadow-slate-400/30',
      badgeIcon: '🥈',
      sampleBorder: 'border-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.8)]'
    },
    feltColor: {
      id: 'midnight_blue',
      nameAz: 'Gecə Mavisi (Midnight Blue)',
      nameEn: 'Midnight Blue Felt',
      descriptionAz: 'Dərin gecə səması tonlarında xüsusi VIP mahud',
      descriptionEn: 'Deep twilight royal navy VIP table felt',
      bgClass: 'bg-slate-900',
      tableGradient: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 50%, #090d16 100%)',
      feltBorder: 'border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.2)]',
      accentColor: '#38bdf8'
    },
    perksAz: [
      '🥈 "Silver Chrome" parıltılı avatar çərçivəsi',
      '🌌 Eksklüziv "Midnight Blue" masa örtüyü',
      '+5% bonus XP gücləndiricisi'
    ],
    perksEn: [
      '🥈 "Silver Chrome" radiant avatar frame',
      '🌌 Exclusive "Midnight Blue" felt color',
      '+5% XP progression bonus'
    ],
    colorTheme: {
      gradient: 'from-slate-400 via-slate-200 to-slate-400',
      border: 'border-slate-400/70',
      text: 'text-slate-200',
      glow: 'shadow-slate-400/40',
      badgeBg: 'bg-slate-800 text-slate-200'
    }
  },
  {
    level: 3,
    nameAz: 'Qızıl Usta',
    nameEn: 'Gold High Roller',
    badgeTitle: 'GOLD III',
    minXp: 300,
    maxXp: 700,
    avatarFrame: {
      id: 'gold_ace',
      nameAz: 'Qızıl Aura Tac Çərçivəsi',
      nameEn: 'Golden Ace Radiant Frame',
      descriptionAz: 'Zəngin 24k qızıl işıq saçan xüsusi çərçivə',
      descriptionEn: 'Radiant 24k gold prestige glowing aura frame',
      ringCss: 'ring-2 ring-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.8)] animate-pulse',
      glowCss: 'shadow-xl shadow-yellow-500/40',
      badgeIcon: '🥇',
      sampleBorder: 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.9)]'
    },
    feltColor: {
      id: 'royal_velvet',
      nameAz: 'Kral Məxməri (Royal Velvet)',
      nameEn: 'Royal Velvet Felt',
      descriptionAz: 'Aristokratik tünd bənövşəyi məxmər masa örtüyü',
      descriptionEn: 'Aristocratic deep imperial purple velvet felt',
      bgClass: 'bg-purple-950',
      tableGradient: 'radial-gradient(ellipse at center, #581c87 0%, #3b0764 55%, #1e0338 100%)',
      feltBorder: 'border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.3)]',
      accentColor: '#c084fc'
    },
    perksAz: [
      '👑 "Golden Ace" 24K qızıl avatar çərçivəsi',
      '💜 Lüks "Royal Velvet" bənövşəyi masa örtüyü',
      '+10% bonus XP gücləndiricisi',
      'Masa çatında qızıl VIP adı nişanı'
    ],
    perksEn: [
      '👑 "Golden Ace" 24k gold avatar frame',
      '💜 Luxurious "Royal Velvet" purple felt',
      '+10% XP progression bonus',
      'Golden VIP badge in table chat'
    ],
    colorTheme: {
      gradient: 'from-amber-400 via-yellow-300 to-amber-500',
      border: 'border-yellow-400/80',
      text: 'text-yellow-400',
      glow: 'shadow-yellow-400/50',
      badgeBg: 'bg-amber-950/80 text-yellow-300'
    }
  },
  {
    level: 4,
    nameAz: 'Platin Köpəkbalığı',
    nameEn: 'Platinum Shark',
    badgeTitle: 'PLATINUM IV',
    minXp: 700,
    maxXp: 1500,
    avatarFrame: {
      id: 'platinum_pulse',
      nameAz: 'Platin Neon Nəbz Çərçivəsi',
      nameEn: 'Platinum Pulse Frame',
      descriptionAz: 'Kibernetik mavi platin neon halqa',
      descriptionEn: 'Cybernetic pulsing cyan platinum neon ring',
      ringCss: 'ring-2 ring-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.9)] animate-pulse',
      glowCss: 'shadow-xl shadow-cyan-400/50',
      badgeIcon: '💠',
      sampleBorder: 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]'
    },
    feltColor: {
      id: 'cyber_neon',
      nameAz: 'Kiber Neon (Cyberpunk Neon)',
      nameEn: 'Cyberpunk Neon Felt',
      descriptionAz: 'Gələcəyin futuristik neon mavi/bənövşəyi oyun masası',
      descriptionEn: 'Futuristic glowing cyber neon blue/magenta felt',
      bgClass: 'bg-cyan-950',
      tableGradient: 'radial-gradient(ellipse at center, #0e7490 0%, #164e63 45%, #082f49 85%, #030712 100%)',
      feltBorder: 'border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.45)]',
      accentColor: '#22d3ee'
    },
    perksAz: [
      '💠 "Platinum Pulse" neon mavi çərçivə',
      '⚡ Futuristik "Cyberpunk Neon" masa örtüyü',
      '+15% bonus XP gücləndiricisi',
      'Kassada prioritet əməliyyat statusu'
    ],
    perksEn: [
      '💠 "Platinum Pulse" cyan neon frame',
      '⚡ Futuristic "Cyberpunk Neon" felt',
      '+15% XP progression bonus',
      'Priority transaction queue at cashier'
    ],
    colorTheme: {
      gradient: 'from-cyan-400 via-teal-300 to-cyan-500',
      border: 'border-cyan-400/80',
      text: 'text-cyan-300',
      glow: 'shadow-cyan-400/50',
      badgeBg: 'bg-cyan-950/80 text-cyan-200'
    }
  },
  {
    level: 5,
    nameAz: 'Yaqut Əfsanə',
    nameEn: 'Ruby Legend',
    badgeTitle: 'RUBY V',
    minXp: 1500,
    maxXp: 3000,
    avatarFrame: {
      id: 'ruby_dragon',
      nameAz: 'Yaqut Əjdaha Alov Çərçivəsi',
      nameEn: 'Ruby Dragon Flame Frame',
      descriptionAz: 'Al-qırmızı yaqut parıltısı və dinamik alov effekti',
      descriptionEn: 'Deep crimson ruby brilliance with animated flame glow',
      ringCss: 'ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.9)] animate-pulse',
      glowCss: 'shadow-2xl shadow-rose-600/50',
      badgeIcon: '💎',
      sampleBorder: 'border-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.9)]'
    },
    feltColor: {
      id: 'ruby_luxury',
      nameAz: 'Yaqut Lüks (Ruby Luxury)',
      nameEn: 'Ruby Luxury Felt',
      descriptionAz: 'Monte-Karlo VIP otaqlarının al-qırmızı məxmər örtüyü',
      descriptionEn: 'Monte Carlo high stakes crimson velvet luxury felt',
      bgClass: 'bg-rose-950',
      tableGradient: 'radial-gradient(ellipse at center, #881337 0%, #4c0519 60%, #1f020a 100%)',
      feltBorder: 'border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.4)]',
      accentColor: '#fb7185'
    },
    perksAz: [
      '🔥 "Ruby Dragon" alovlu yaqut çərçivə',
      '🍷 Lüks Monte-Karlo "Ruby Luxury" qırmızı örtük',
      '+20% bonus XP gücləndiricisi',
      'VIP Dəstək kanalına prioritet qoşulma'
    ],
    perksEn: [
      '🔥 "Ruby Dragon" fiery ruby flame frame',
      '🍷 Monte Carlo "Ruby Luxury" deep crimson felt',
      '+20% XP progression bonus',
      'Priority fast-track VIP live support'
    ],
    colorTheme: {
      gradient: 'from-rose-500 via-pink-400 to-red-600',
      border: 'border-rose-500/80',
      text: 'text-rose-400',
      glow: 'shadow-rose-500/50',
      badgeBg: 'bg-rose-950/80 text-rose-200'
    }
  },
  {
    level: 6,
    nameAz: 'Almaz Hökmdar',
    nameEn: 'Diamond Sovereign',
    badgeTitle: 'DIAMOND VI',
    minXp: 3000,
    maxXp: 6000,
    avatarFrame: {
      id: 'diamond_shimmer',
      nameAz: 'Almaz Parıltı Hərəsi Çərçivəsi',
      nameEn: 'Diamond Shimmer Frame',
      descriptionAz: 'Prizmatik almaz kristalları və təmiz ağ işıq saçması',
      descriptionEn: 'Prismatic crystal diamond facets with radiant halo',
      ringCss: 'ring-2 ring-sky-300 shadow-[0_0_22px_rgba(186,230,253,0.95)] animate-pulse',
      glowCss: 'shadow-2xl shadow-sky-300/60',
      badgeIcon: '🔷',
      sampleBorder: 'border-sky-300 shadow-[0_0_16px_rgba(186,230,253,0.95)]'
    },
    feltColor: {
      id: 'diamond_prestige',
      nameAz: 'Almaz Prestij (Diamond Prestige)',
      nameEn: 'Diamond Prestige Felt',
      descriptionAz: 'Buzlu göy/platin rəngli ultra lüks turnir masası',
      descriptionEn: 'Icy cyan-platinum elite tournament prestige felt',
      bgClass: 'bg-slate-900',
      tableGradient: 'radial-gradient(ellipse at center, #0369a1 0%, #075985 45%, #0c4a6e 75%, #082f49 100%)',
      feltBorder: 'border-sky-300 shadow-[0_0_35px_rgba(56,189,248,0.5)]',
      accentColor: '#38bdf8'
    },
    perksAz: [
      '✨ "Diamond Shimmer" prizmatik almaz çərçivəsi',
      '💠 Eksklüziv "Diamond Prestige" örtük',
      '+25% bonus XP gücləndiricisi',
      'Fərdi masa yaradılmasında tam xüsusiləşdirmə'
    ],
    perksEn: [
      '✨ "Diamond Shimmer" prismatic crystal frame',
      '💠 Exclusive "Diamond Prestige" felt',
      '+25% XP progression bonus',
      'Full custom options when creating private tables'
    ],
    colorTheme: {
      gradient: 'from-sky-300 via-blue-200 to-indigo-400',
      border: 'border-sky-300/80',
      text: 'text-sky-300',
      glow: 'shadow-sky-300/60',
      badgeBg: 'bg-sky-950/80 text-sky-200'
    }
  },
  {
    level: 7,
    nameAz: 'Qara Almaz (Obsidian)',
    nameEn: 'Obsidian Galaxy',
    badgeTitle: 'OBSIDIAN VII',
    minXp: 6000,
    maxXp: 12000,
    avatarFrame: {
      id: 'obsidian_galaxy',
      nameAz: 'Qara Almaz Qalaktik Çərçivə',
      nameEn: 'Obsidian Galaxy Frame',
      descriptionAz: 'Dərin kosmos və bənövşəyi qalaktik dumanlıq effekti',
      descriptionEn: 'Deep void obsidian border with cosmic nebula swirls',
      ringCss: 'ring-2 ring-violet-400 shadow-[0_0_24px_rgba(167,139,250,0.95)] animate-pulse',
      glowCss: 'shadow-2xl shadow-violet-500/60',
      badgeIcon: '🌌',
      sampleBorder: 'border-violet-400 shadow-[0_0_18px_rgba(167,139,250,0.95)]'
    },
    feltColor: {
      id: 'galactic_void',
      nameAz: 'Qalaktik Kosmos (Galactic Void)',
      nameEn: 'Galactic Void Felt',
      descriptionAz: 'Ulduzlu kosmos və dərin qara qalaktika mahud dizaynı',
      descriptionEn: 'Deep stellar abyss and cosmic nebula felt',
      bgClass: 'bg-zinc-950',
      tableGradient: 'radial-gradient(ellipse at center, #3b0764 0%, #1e1b4b 50%, #030712 100%)',
      feltBorder: 'border-violet-400 shadow-[0_0_40px_rgba(167,139,250,0.55)]',
      accentColor: '#a78bfa'
    },
    perksAz: [
      '🌌 "Obsidian Galaxy" qalaktik kosmik çərçivə',
      '🌠 Mistik "Galactic Void" masa örtüyü',
      '+30% bonus XP gücləndiricisi',
      'Bütün oyunçular qarşısında fərdi Qara Almaz statusu'
    ],
    perksEn: [
      '🌌 "Obsidian Galaxy" cosmic void frame',
      '🌠 Mystical "Galactic Void" deep universe felt',
      '+30% XP progression bonus',
      'Obsidian Master title displayed on all tables'
    ],
    colorTheme: {
      gradient: 'from-violet-500 via-fuchsia-400 to-indigo-600',
      border: 'border-violet-400/80',
      text: 'text-violet-300',
      glow: 'shadow-violet-400/60',
      badgeBg: 'bg-violet-950/80 text-violet-200'
    }
  },
  {
    level: 8,
    nameAz: 'Zirvə Hökmdarı (Olympus)',
    nameEn: 'Crown of Olympus',
    badgeTitle: 'ROYALTY VIII',
    minXp: 12000,
    maxXp: 999999,
    avatarFrame: {
      id: 'crown_olympus',
      nameAz: 'Olimp Tacı və Əbədi Qızıl Şöhrət',
      nameEn: 'Crown of Olympus Frame',
      descriptionAz: 'Ən yüksək VIP səviyyəsi: İşıqlı tac və ilahi qızıl aura',
      descriptionEn: 'Ultimate VIP zenith: Radiant crown with mythic golden aura',
      ringCss: 'ring-2 ring-amber-300 shadow-[0_0_28px_rgba(252,211,77,1)] animate-pulse',
      glowCss: 'shadow-2xl shadow-yellow-400/70',
      badgeIcon: '👑',
      sampleBorder: 'border-amber-300 shadow-[0_0_20px_rgba(252,211,77,1)]'
    },
    feltColor: {
      id: 'golden_mirage',
      nameAz: 'Qızıl Saray (Golden Mirage)',
      nameEn: 'Golden Mirage Felt',
      descriptionAz: 'Xalis qızıl parıltılı əfsanəvi saray masa örtüyü',
      descriptionEn: 'Pure 24k mythic imperial gold palace felt',
      bgClass: 'bg-amber-950',
      tableGradient: 'radial-gradient(ellipse at center, #78350f 0%, #451a03 55%, #180902 100%)',
      feltBorder: 'border-amber-300 shadow-[0_0_45px_rgba(252,211,77,0.65)]',
      accentColor: '#fde047'
    },
    perksAz: [
      '👑 Ən yüksək "Crown of Olympus" kral tacı avatar çərçivəsi',
      '🌟 Əfsanəvi "Golden Mirage" saray masa örtüyü',
      '+40% maksimal XP gücləndiricisi',
      'VIP Kraliyyət statusu və xüsusi animasiyalı qalibiyyət aurası'
    ],
    perksEn: [
      '👑 Supreme "Crown of Olympus" royal crown frame',
      '🌟 Legendary "Golden Mirage" 24k palace felt',
      '+40% maximum XP progression bonus',
      'Poker Royalty status & animated victory aura'
    ],
    colorTheme: {
      gradient: 'from-amber-300 via-yellow-200 to-amber-500',
      border: 'border-amber-300',
      text: 'text-amber-300',
      glow: 'shadow-amber-400/80',
      badgeBg: 'bg-amber-950 text-amber-200'
    }
  }
];

export interface VipProgressState {
  currentLevel: number;
  currentTier: VipTierInfo;
  nextTier: VipTierInfo | null;
  totalXp: number;
  levelStartXp: number;
  levelTargetXp: number;
  xpInCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressPercent: number;
  isMaxLevel: boolean;
}

export function calculateVipProgress(xp: number): VipProgressState {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  
  // Find matching tier
  let matchedTier = ALL_VIP_LEVELS[0];
  for (let i = ALL_VIP_LEVELS.length - 1; i >= 0; i--) {
    if (safeXp >= ALL_VIP_LEVELS[i].minXp) {
      matchedTier = ALL_VIP_LEVELS[i];
      break;
    }
  }

  const currentLevel = matchedTier.level;
  const isMaxLevel = currentLevel >= ALL_VIP_LEVELS[ALL_VIP_LEVELS.length - 1].level;
  const nextTier = isMaxLevel ? null : ALL_VIP_LEVELS.find((t) => t.level === currentLevel + 1) || null;

  const levelStartXp = matchedTier.minXp;
  const levelTargetXp = nextTier ? nextTier.minXp : matchedTier.maxXp;
  const xpInCurrentLevel = safeXp - levelStartXp;
  const xpNeededForNextLevel = Math.max(0, levelTargetXp - safeXp);
  
  const span = Math.max(1, levelTargetXp - levelStartXp);
  const progressPercent = isMaxLevel ? 100 : Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / span) * 100)));

  return {
    currentLevel,
    currentTier: matchedTier,
    nextTier,
    totalXp: safeXp,
    levelStartXp,
    levelTargetXp,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercent,
    isMaxLevel
  };
}

export function getUnlockedFrames(vipLevel: number): AvatarFrameId[] {
  const lvl = Math.max(1, vipLevel || 1);
  return ALL_VIP_LEVELS.filter((t) => t.level <= lvl).map((t) => t.avatarFrame.id);
}

export function getUnlockedFeltColors(vipLevel: number): FeltColor[] {
  const lvl = Math.max(1, vipLevel || 1);
  const classic: FeltColor[] = ['emerald', 'sapphire', 'crimson', 'charcoal'];
  const vipUnlocked = ALL_VIP_LEVELS.filter((t) => t.level <= lvl).map((t) => t.feltColor.id);
  
  // Deduplicate
  const set = new Set<FeltColor>([...classic, ...vipUnlocked]);
  return Array.from(set);
}

export function getFeltInfo(feltId: FeltColor): VipTierInfo['feltColor'] {
  const found = ALL_VIP_LEVELS.find((t) => t.feltColor.id === feltId);
  if (found) return found.feltColor;

  // Fallbacks for classic colors
  switch (feltId) {
    case 'sapphire':
      return {
        id: 'sapphire',
        nameAz: 'Klassik Sapfir',
        nameEn: 'Classic Sapphire',
        descriptionAz: 'Göy rəngli ənənəvi masa örtüyü',
        descriptionEn: 'Traditional blue casino poker felt',
        bgClass: 'bg-blue-900',
        tableGradient: 'radial-gradient(ellipse at center, #1e3a8a 0%, #1e40af 45%, #172554 90%)',
        feltBorder: 'border-blue-500/70',
        accentColor: '#60a5fa'
      };
    case 'crimson':
      return {
        id: 'crimson',
        nameAz: 'Klassik Yaqut Qırmızı',
        nameEn: 'Classic Crimson',
        descriptionAz: 'Qırmızı rəngli ənənəvi masa örtüyü',
        descriptionEn: 'Traditional red casino poker felt',
        bgClass: 'bg-rose-950',
        tableGradient: 'radial-gradient(ellipse at center, #9f1239 0%, #881337 45%, #4c0519 90%)',
        feltBorder: 'border-rose-500/70',
        accentColor: '#f43f5e'
      };
    case 'charcoal':
      return {
        id: 'charcoal',
        nameAz: 'Klassik Kömür Qarası',
        nameEn: 'Classic Charcoal',
        descriptionAz: 'Qara rəngli təmiz minimalist masa örtüyü',
        descriptionEn: 'Modern minimalist dark charcoal table felt',
        bgClass: 'bg-zinc-900',
        tableGradient: 'radial-gradient(ellipse at center, #27272a 0%, #18181b 50%, #09090b 100%)',
        feltBorder: 'border-zinc-700/80',
        accentColor: '#a1a1aa'
      };
    default:
      return ALL_VIP_LEVELS[0].feltColor;
  }
}

/**
 * Calculates XP earned for completing a hand at a real-money poker table
 */
export function calculateHandXp(options: {
  isRealMoney: boolean;
  potAmount: number;
  isWinner: boolean;
  reachedShowdown: boolean;
  vipLevel: number;
}): {
  xpEarned: number;
  breakdown: {
    baseXp: number;
    winBonus: number;
    showdownBonus: number;
    highPotBonus: number;
    vipBoostBonus: number;
  };
} {
  // Only real-money hands award VIP XP to maintain prestige and prevent play-money farming
  if (!options.isRealMoney) {
    return {
      xpEarned: 0,
      breakdown: {
        baseXp: 0,
        winBonus: 0,
        showdownBonus: 0,
        highPotBonus: 0,
        vipBoostBonus: 0
      }
    };
  }

  // 1. Base XP for actively playing the hand
  const baseXp = 10;

  // 2. Bonus for winning the hand
  const winBonus = options.isWinner ? 15 : 0;

  // 3. Bonus for reaching showdown
  const showdownBonus = options.reachedShowdown ? 5 : 0;

  // 4. Pot magnitude bonus
  let highPotBonus = 0;
  if (options.potAmount >= 100) {
    highPotBonus = 15;
  } else if (options.potAmount >= 40) {
    highPotBonus = 10;
  } else if (options.potAmount >= 15) {
    highPotBonus = 5;
  }

  const rawSubtotal = baseXp + winBonus + showdownBonus + highPotBonus;

  // 5. VIP tier multiplier bonus (5% at level 2 up to 40% at level 8)
  const boostPercent = Math.min(40, Math.max(0, (options.vipLevel - 1) * 5));
  const vipBoostBonus = Math.round((rawSubtotal * boostPercent) / 100);

  const xpEarned = rawSubtotal + vipBoostBonus;

  return {
    xpEarned,
    breakdown: {
      baseXp,
      winBonus,
      showdownBonus,
      highPotBonus,
      vipBoostBonus
    }
  };
}
