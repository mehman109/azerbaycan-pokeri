import React from 'react';
import { UserProfile } from '../types/poker';
import { translations, Language } from '../utils/translations';
import { 
  Wallet, 
  Plus,
  LogOut,
  ShieldCheck,
  Settings,
  MessageSquare,
  Crown
} from 'lucide-react';
import { soundManager } from '../utils/audioEngine';
import { AvatarWithFrame } from './AvatarWithFrame';
import { calculateVipProgress } from '../utils/vipProgression';

interface HeaderNavProps {
  user: UserProfile | null;
  lang: Language;
  onLanguageChange?: (lang: Language) => void;
  onOpenCashier: () => void;
  onOpenCreateTable?: () => void;
  onOpenAdminPanel?: () => void;
  onOpenSettings?: () => void;
  onOpenSupport?: () => void;
  unreadSupportCount?: number;
  onOpenAuth: (mode: 'signin' | 'signup' | 'admin') => void;
  onLogout?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onToggleCurrencyMode: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  user,
  lang,
  onOpenCashier,
  onOpenCreateTable,
  onOpenAdminPanel,
  onOpenSettings,
  onOpenSupport,
  unreadSupportCount = 0,
  onOpenAuth,
  onLogout,
  onToggleCurrencyMode,
}) => {
  const t = translations[lang];

  const isAdmin = user && (user.isAdmin || user.username === 'ADMIN');
  const vipState = user ? calculateVipProgress(user.vipXp || 0) : null;

  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-950/95 border-b border-zinc-800/80 backdrop-blur-md px-2 sm:px-5 py-2 overflow-x-auto no-scrollbar scroll-smooth">
      <div className="flex items-center justify-between min-w-max w-full gap-2 sm:gap-4">
        {/* Top Left: User Profile (Avatar With Frame & VIP Badge) */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {user ? (
            <div 
              onClick={() => {
                if (isAdmin && onOpenAdminPanel) {
                  soundManager.playButtonClick();
                  onOpenAdminPanel();
                } else if (onOpenSettings) {
                  soundManager.playButtonClick();
                  onOpenSettings();
                }
              }}
              className="flex items-center space-x-2.5 cursor-pointer group"
              title={isAdmin ? 'İdarəetmə Panelini Aç' : 'VIP & Profil Ayarlarını Aç'}
            >
              {/* User Avatar with VIP Frame */}
              <AvatarWithFrame
                src={user.avatar}
                alt={user.username}
                size="sm"
                frameId={user.selectedAvatarFrame || 'default'}
                vipLevel={vipState?.currentLevel || 1}
                className="group-hover:scale-105 transition-transform"
              />

              {/* Username & VIP Level Pill */}
              <div className="flex flex-col justify-center shrink-0">
                <div className="flex items-center space-x-1.5">
                  {isAdmin ? (
                    <span className="text-xs sm:text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)] flex items-center space-x-1">
                      <span>👑</span>
                      <span>ADMIN</span>
                    </span>
                  ) : (
                    <span className="text-xs sm:text-sm font-bold text-white max-w-[140px] truncate">
                      {user.username}
                    </span>
                  )}
                </div>

                {vipState && (
                  <div className="flex items-center space-x-1 text-[10px] text-amber-400/90 font-bold leading-tight">
                    <Crown className="w-2.5 h-2.5 text-amber-400" />
                    <span>VIP {vipState.currentLevel}</span>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400 font-mono text-[9px]">{vipState.totalXp} XP</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 shrink-0">
              <div className="w-8 h-8 rounded-full ring-1 ring-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-400 text-xs font-bold">
                👤
              </div>
              <span className="text-xs font-bold text-zinc-300">
                {lang === 'az' ? 'Qonaq' : 'Guest'}
              </span>
            </div>
          )}
        </div>

        {/* Right Side: Admin Panel + Fərdi Masa Yarat + Cashier + Logout */}
        {user ? (
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            {/* Dedicated Admin Panel Trigger Button for Admin */}
            {isAdmin && onOpenAdminPanel && (
              <button
                onClick={() => {
                  soundManager.playButtonClick();
                  onOpenAdminPanel();
                }}
                id="header_admin_panel_btn"
                className="flex items-center space-x-1 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 px-2.5 py-1.5 rounded-xl text-xs font-black shadow-lg shadow-amber-500/30 border border-amber-300 transition-all active:scale-95 cursor-pointer whitespace-nowrap animate-pulse shrink-0"
                title="İdarəetmə Paneli (Oyunçular, Çeklər, Balanslar)"
              >
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                <span>Admin Panel</span>
              </button>
            )}

            {/* Compact Fərdi Masa Yarat Button */}
            <button
              onClick={() => {
                soundManager.playButtonClick();
                if (onOpenCreateTable) {
                  onOpenCreateTable();
                }
              }}
              id="header_create_table_btn"
              className="flex items-center space-x-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-2 py-1.5 rounded-lg text-[11px] font-black shadow-sm shadow-amber-500/20 transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>{lang === 'az' ? 'Fərdi Masa Yarat' : 'Fərdi Masa Yarat'}</span>
            </button>

            {/* Quick Cashier Button with $0.00 Deposit Balance */}
            <button
              onClick={() => {
                soundManager.playButtonClick();
                onOpenCashier();
              }}
              id="header_cashier_btn"
              className="flex items-center space-x-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>${user.realBalance.toFixed(2)}</span>
              <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <Plus className="w-3 h-3 stroke-[3]" />
              </div>
            </button>

            {/* Settings (Ayarlar) Button */}
            {onOpenSettings && (
              <button
                onClick={() => {
                  soundManager.playButtonClick();
                  onOpenSettings();
                }}
                title={lang === 'az' ? 'Hesab & Profil Ayarları (Qeydiyyat məlumatları, Şəkil yüklə, Tarixçə)' : 'Account & Profile Settings'}
                id="header_settings_btn"
                className="flex items-center space-x-1.5 py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 hover:border-amber-400 text-zinc-300 hover:text-amber-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              >
                <Settings className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'az' ? 'Ayarlar' : 'Settings'}</span>
              </button>
            )}

            {/* Live Support & Contact Admin (Canlı Dəstək) Button */}
            {onOpenSupport && (
              <button
                onClick={() => {
                  soundManager.playButtonClick();
                  onOpenSupport();
                }}
                title={lang === 'az' ? 'Adminlə Əlaqə & Canlı Dəstək Mesajları' : 'Contact Admin & Live Support'}
                id="header_support_btn"
                className="relative flex items-center space-x-1.5 py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 hover:border-amber-400 text-zinc-300 hover:text-amber-300 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm shrink-0 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'az' ? 'Dəstək' : 'Support'}</span>
                {unreadSupportCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9.5px] font-black animate-pulse shadow">
                    {unreadSupportCount}
                  </span>
                )}
              </button>
            )}

            {/* Dedicated Logout / Çıxış Et Button */}
            {onLogout && (
              <button
                onClick={() => {
                  soundManager.playButtonClick();
                  onLogout();
                }}
                title={lang === 'az' ? 'Hesabdan çıxış et və giriş/qeydiyyat ekranına qayıt' : 'Log out to sign-in / registration screen'}
                id="header_logout_btn"
                className="flex items-center space-x-1.5 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-red-950/70 to-zinc-900 hover:from-red-900/90 hover:to-zinc-850 border border-red-800/50 hover:border-red-600 text-red-300 hover:text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm shadow-red-950/30 shrink-0 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'az' ? 'Çıxış' : 'Logout'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => {
                soundManager.playButtonClick();
                if (onOpenCreateTable) {
                  onOpenCreateTable();
                } else {
                  onOpenAuth('signin');
                }
              }}
              id="header_create_table_guest_btn"
              className="flex items-center space-x-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-2 py-1 rounded-lg text-[11px] font-black shadow-sm shadow-amber-500/20 transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>{lang === 'az' ? 'Fərdi Masa Yarat' : 'Fərdi Masa Yarat'}</span>
            </button>
            <button
              onClick={() => onOpenAuth('signin')}
              id="header_signin_btn"
              className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-200 text-xs font-bold transition-colors shrink-0 whitespace-nowrap"
            >
              {t.signin_btn}
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              id="header_signup_btn"
              className="py-1.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all shrink-0 whitespace-nowrap"
            >
              {t.signup_btn}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
