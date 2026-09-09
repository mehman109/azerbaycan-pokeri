import { Language } from '../utils/translations';

export interface QuickPhrase {
  id: string;
  category: 'greetings' | 'reactions' | 'gameplay' | 'hype';
  textAz: string;
  textEn: string;
  icon?: string;
}

export interface QuickPhraseCategory {
  id: 'greetings' | 'reactions' | 'gameplay' | 'hype';
  nameAz: string;
  nameEn: string;
  icon: string;
}

export const QUICK_PHRASE_CATEGORIES: QuickPhraseCategory[] = [
  { id: 'greetings', nameAz: 'Salamlama', nameEn: 'Greetings', icon: '👋' },
  { id: 'gameplay', nameAz: 'Oyun', nameEn: 'Gameplay', icon: '🃏' },
  { id: 'reactions', nameAz: 'Reaksiyalar', nameEn: 'Reactions', icon: '🔥' },
  { id: 'hype', nameAz: 'Əyləncə', nameEn: 'Hype', icon: '🚀' },
];

export const QUICK_CHAT_PHRASES: QuickPhrase[] = [
  // Greetings
  { id: 'gl_all', category: 'greetings', textAz: 'Uğurlar hamıya! 🍀', textEn: 'Good luck everyone! 🍀', icon: '🍀' },
  { id: 'hi_all', category: 'greetings', textAz: 'Salam hamıya! 👋', textEn: 'Hello all! 👋', icon: '👋' },
  { id: 'gg', category: 'greetings', textAz: 'Yaxşı oyun! (GG) 👏', textEn: 'Good game! (GG) 👏', icon: '👏' },
  { id: 'thanks', category: 'greetings', textAz: 'Təşəkkürlər! 🙏', textEn: 'Thank you! 🙏', icon: '🙏' },
  { id: 'see_ya', category: 'greetings', textAz: 'Görüşənədək! ✌️', textEn: 'See you next time! ✌️', icon: '✌️' },

  // Gameplay
  { id: 'nice_hand', category: 'gameplay', textAz: 'Gözəl əl! 🔥', textEn: 'Nice hand! 🔥', icon: '🔥' },
  { id: 'nice_bluff', category: 'gameplay', textAz: 'Əla blef! 😎', textEn: 'Nice bluff! 😎', icon: '😎' },
  { id: 'show_cards', category: 'gameplay', textAz: 'Kartları göstər? 🃏', textEn: 'Show cards please? 🃏', icon: '🃏' },
  { id: 'tough_river', category: 'gameplay', textAz: 'Çətin river! 🌊', textEn: 'Tough river! 🌊', icon: '🌊' },
  { id: 'monster_hand', category: 'gameplay', textAz: 'Monstr əl! 👑', textEn: 'Monster hand! 👑', icon: '👑' },

  // Reactions
  { id: 'unlucky', category: 'reactions', textAz: 'Bəxt gətirmədi! 😢', textEn: 'Unlucky, bad beat! 😢', icon: '😢' },
  { id: 'that_was_close', category: 'reactions', textAz: 'Çox yaxın idi! ⚡', textEn: 'That was close! ⚡', icon: '⚡' },
  { id: 'wow_luck', category: 'reactions', textAz: 'Vallah nə bəxt! 😲', textEn: 'What a runner-runner! 😲', icon: '😲' },
  { id: 'dont_tilt', category: 'reactions', textAz: 'Sakit, tildə getmə! 🧘', textEn: 'Stay calm, no tilt! 🧘', icon: '🧘' },
  { id: 'well_played', category: 'reactions', textAz: 'Mükəmməl oyun! 🎯', textEn: 'Well played! 🎯', icon: '🎯' },

  // Hype
  { id: 'all_in_or_fold', category: 'hype', textAz: 'Ya all-in ya fold! 🚀', textEn: 'All-in or fold! 🚀', icon: '🚀' },
  { id: 'vamos', category: 'hype', textAz: 'Vamos! 🔥🚀', textEn: 'Vamos! 🔥🚀', icon: '🔥' },
  { id: 'thanks_chips', category: 'hype', textAz: 'Çiplərə görə təşəkkürlər! 💰', textEn: 'Thanks for the chips! 💰', icon: '💰' },
  { id: 'one_more_time', category: 'hype', textAz: 'Bir dəfə də! 🔁', textEn: 'One more hand! 🔁', icon: '🔁' },
  { id: 'poker_face', category: 'hype', textAz: 'Poker Face! 🕶️', textEn: 'Poker face! 🕶️', icon: '🕶️' },
];

export function getQuickPhraseText(phrase: QuickPhrase, lang: Language): string {
  return lang === 'az' ? phrase.textAz : phrase.textEn;
}
