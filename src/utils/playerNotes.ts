import { Language } from './translations';

export type PlayerNoteColor = 
  | 'red'       // Aggressive
  | 'blue'      // Tight
  | 'green'     // Calling Station / Passive
  | 'yellow'    // TAG (Tight Aggressive)
  | 'purple'    // LAG (Loose Aggressive)
  | 'cyan'      // Fish / Recreational
  | 'orange'    // Maniac
  | 'slate'     // Shark / Regular
  | 'zinc';     // Rock / Nit

export interface PlayerNotePreset {
  color: PlayerNoteColor;
  labelEn: string;
  labelAz: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  ringClass: string;
  badgeBg: string;
}

export interface PlayerNote {
  color?: PlayerNoteColor;
  label?: string; // Optional custom or selected label
  noteText: string;
  updatedAt: number;
}

export const PLAYER_NOTE_PRESETS: PlayerNotePreset[] = [
  {
    color: 'red',
    labelEn: 'Aggressive',
    labelAz: 'Aqressiv',
    bgClass: 'bg-red-500/20',
    borderClass: 'border-red-500/60',
    textClass: 'text-red-400',
    ringClass: 'ring-red-500',
    badgeBg: 'bg-red-500',
  },
  {
    color: 'blue',
    labelEn: 'Tight',
    labelAz: 'Qapalı / Sıx',
    bgClass: 'bg-blue-500/20',
    borderClass: 'border-blue-500/60',
    textClass: 'text-blue-400',
    ringClass: 'ring-blue-500',
    badgeBg: 'bg-blue-500',
  },
  {
    color: 'yellow',
    labelEn: 'TAG (Tight-Aggressive)',
    labelAz: 'TAG (Sıx-Aqressiv)',
    bgClass: 'bg-yellow-500/20',
    borderClass: 'border-yellow-500/60',
    textClass: 'text-yellow-400',
    ringClass: 'ring-yellow-400',
    badgeBg: 'bg-yellow-400',
  },
  {
    color: 'purple',
    labelEn: 'LAG (Loose-Aggressive)',
    labelAz: 'LAG (Geniş-Aqressiv)',
    bgClass: 'bg-purple-500/20',
    borderClass: 'border-purple-500/60',
    textClass: 'text-purple-400',
    ringClass: 'ring-purple-500',
    badgeBg: 'bg-purple-500',
  },
  {
    color: 'green',
    labelEn: 'Calling Station',
    labelAz: 'Passiv / Hər şeyi görən',
    bgClass: 'bg-emerald-500/20',
    borderClass: 'border-emerald-500/60',
    textClass: 'text-emerald-400',
    ringClass: 'ring-emerald-500',
    badgeBg: 'bg-emerald-500',
  },
  {
    color: 'cyan',
    labelEn: 'Fish / Recreational',
    labelAz: 'Zəif / Balıq',
    bgClass: 'bg-cyan-500/20',
    borderClass: 'border-cyan-500/60',
    textClass: 'text-cyan-400',
    ringClass: 'ring-cyan-400',
    badgeBg: 'bg-cyan-400',
  },
  {
    color: 'orange',
    labelEn: 'Maniac',
    labelAz: 'Çılğın / Maniac',
    bgClass: 'bg-orange-500/20',
    borderClass: 'border-orange-500/60',
    textClass: 'text-orange-400',
    ringClass: 'ring-orange-500',
    badgeBg: 'bg-orange-500',
  },
  {
    color: 'slate',
    labelEn: 'Shark / Solid Pro',
    labelAz: 'Peşəkar / Köpəkbalığı',
    bgClass: 'bg-slate-500/20',
    borderClass: 'border-slate-400/60',
    textClass: 'text-slate-300',
    ringClass: 'ring-slate-400',
    badgeBg: 'bg-slate-400',
  },
  {
    color: 'zinc',
    labelEn: 'Nit / Rock',
    labelAz: 'Qaya / Çox ehtiyatlı',
    bgClass: 'bg-zinc-700/30',
    borderClass: 'border-zinc-500/60',
    textClass: 'text-zinc-300',
    ringClass: 'ring-zinc-400',
    badgeBg: 'bg-zinc-400',
  },
];

const STORAGE_KEY = 'poker_player_notes_v1';

export function getAllPlayerNotes(): Record<string, PlayerNote> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getPlayerNote(playerName: string): PlayerNote | null {
  if (!playerName) return null;
  const notes = getAllPlayerNotes();
  return notes[playerName.trim().toLowerCase()] || null;
}

export function savePlayerNote(playerName: string, note: PlayerNote): void {
  if (!playerName) return;
  try {
    const notes = getAllPlayerNotes();
    const key = playerName.trim().toLowerCase();
    notes[key] = {
      ...note,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Failed to save player note to local storage:', err);
  }
}

export function deletePlayerNote(playerName: string): void {
  if (!playerName) return;
  try {
    const notes = getAllPlayerNotes();
    const key = playerName.trim().toLowerCase();
    delete notes[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('Failed to delete player note:', err);
  }
}

export function getPresetByColor(color?: PlayerNoteColor): PlayerNotePreset | undefined {
  return PLAYER_NOTE_PRESETS.find((p) => p.color === color);
}

export function getNoteLabel(note: PlayerNote, lang: Language): string {
  const preset = getPresetByColor(note.color);
  if (note.label) return note.label;
  if (preset) return lang === 'az' ? preset.labelAz : preset.labelEn;
  return '';
}
