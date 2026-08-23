import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Settings, 
  User, 
  Camera, 
  Upload, 
  History, 
  ArrowDownRight, 
  ArrowUpRight, 
  Calendar, 
  ShieldCheck, 
  Mail, 
  Key, 
  Award, 
  Coins, 
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Edit2,
  Save,
  Trash2
} from 'lucide-react';
import { UserProfile, WalletTransaction, CurrencyType } from '../types/poker';
import { translations, Language } from '../utils/translations';
import { soundManager } from '../utils/audioEngine';
import confetti from 'canvas-confetti';
import { adminUpdateUserInFirestore, fetchAllDepositsFromFirestore, fetchAllWithdrawalsFromFirestore } from '../services/firebase';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: UserProfile;
  onUpdateUser: (updatedData: Partial<UserProfile>) => void;
  onLogout?: () => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  user,
  onUpdateUser,
  onLogout,
}) => {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'profile' | 'deposits' | 'withdrawals' | 'account'>('profile');
  
  // Profile edit states
  const [username, setUsername] = useState(user.username || '');
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatar || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // History state
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUsername(user.username || '');
      setAvatarPreview(user.avatar || '');
      loadUserHistory();
    }
  }, [isOpen, user]);

  const loadUserHistory = async () => {
    setLoadingHistory(true);
    try {
      const [allDeps, allWiths] = await Promise.all([
        fetchAllDepositsFromFirestore(),
        fetchAllWithdrawalsFromFirestore()
      ]);

      // Filter by current user ID or email/username
      const myDeps = allDeps.filter(
        d => d.userId === user.id || d.username === user.username || d.email === user.email
      );
      const myWiths = allWiths.filter(
        w => w.userId === user.id || w.username === user.username || w.email === user.email
      );

      setDepositHistory(myDeps);
      setWithdrawalHistory(myWiths);
    } catch (err) {
      console.warn('Error loading user history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Image upload handler from gallery / local files
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      alert(lang === 'az' ? 'Şəkil həcmi 4MB-dan çox olmamalıdır!' : 'Image must be less than 4MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setAvatarPreview(base64);
        soundManager.playChipSound();
      }
    };
    reader.readAsDataURL(file);
  };

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!username.trim()) {
      return;
    }
    setIsSaving(true);
    soundManager.playButtonClick();

    try {
      const updates: Partial<UserProfile> = {
        username: username.trim(),
        avatar: avatarPreview,
      };

      // Update in Firestore
      await adminUpdateUserInFirestore(user.id, updates);
      
      // Update local parent state
      onUpdateUser(updates);

      // Local storage cache update
      try {
        const cached = localStorage.getItem('royal_poker_auth_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          localStorage.setItem('royal_poker_auth_user', JSON.stringify({ ...parsed, ...updates }));
        }
      } catch {}

      setSaveSuccess(true);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const registrationDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('az-AZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Məlum deyil';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-zinc-100 shadow-2xl shadow-black/90 my-auto overflow-hidden"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center space-x-2">
                <span>{lang === 'az' ? 'Hesab & Profil Ayarları' : 'Account & Profile Settings'}</span>
                {user.isAdmin && (
                  <span className="text-[10px] bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded-full uppercase">
                    Admin
                  </span>
                )}
              </h2>
              <p className="text-xs text-zinc-400">
                {lang === 'az'
                  ? 'Qeydiyyat məlumatları, qaleriyadan profil şəkli, depozit və çıxarış tarixçəsi'
                  : 'Account details, gallery profile picture, deposit and withdrawal history'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="user_settings_close_btn"
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-850 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 py-3 border-b border-zinc-850 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-850'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{lang === 'az' ? '👤 Profil & Şəkil' : '👤 Profile & Photo'}</span>
          </button>

          <button
            onClick={() => setActiveTab('deposits')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'deposits'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-850'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'az' ? '💳 Depozit Tarixçəsi' : '💳 Deposit History'}</span>
            {depositHistory.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {depositHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'withdrawals'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-850'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
            <span>{lang === 'az' ? '💸 Çıxarış Tarixçəsi' : '💸 Withdrawal History'}</span>
            {withdrawalHistory.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {withdrawalHistory.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'account'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-850'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{lang === 'az' ? 'ℹ️ Qeydiyyat Məlumatları' : 'ℹ️ Account Info'}</span>
          </button>
        </div>

        {/* Tab 1: Profile & Gallery Photo Upload */}
        {activeTab === 'profile' && (
          <div className="py-4 space-y-5">
            {/* Avatar Selection from Gallery */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full ring-4 ring-amber-400/60 shadow-xl overflow-hidden bg-zinc-950 flex items-center justify-center">
                  <img
                    src={avatarPreview || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop&crop=faces'}
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                >
                  <Camera className="w-6 h-6 mb-1 text-amber-400" />
                  <span className="text-[10px] font-bold">Dəyiş</span>
                </button>
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <h3 className="text-sm font-bold text-white">
                  {lang === 'az' ? 'Profil Şəklinizi Qaleriyadan Yükləyin' : 'Upload Avatar from Gallery'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {lang === 'az'
                    ? 'Telefonunuzun və ya kompüterinizin qaleriyasından şəxsi şəklinizi seçərək masalarda digər oyunçulara fərdi görünüş qazanın.'
                    : 'Select a custom photo from your device gallery to personalize your poker table presence.'}
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-white rounded-xl text-xs font-bold border border-zinc-700 flex items-center space-x-1.5 cursor-pointer active:scale-95 transition-all shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'az' ? '📁 Qaleriyadan Seç' : '📁 Choose from Gallery'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAvatarPreview('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80')}
                    className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl text-xs font-medium border border-zinc-800 transition-colors cursor-pointer"
                  >
                    Sıfırla
                  </button>
                </div>
              </div>
            </div>

            {/* Username Input */}
            <div className="space-y-2">
              <label className="block text-xs text-zinc-300 font-bold uppercase tracking-wider">
                {lang === 'az' ? 'Oyunçu Ləqəbi (Username)' : 'Player Username'}
              </label>
              <input
                type="text"
                value={username}
                disabled={user.isAdmin}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-750 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
                placeholder="Ləqəbiniz..."
              />
              {user.isAdmin && (
                <p className="text-[11px] text-amber-400/80">👑 Admin ləqəbi sistem tərəfindən qorunur.</p>
              )}
            </div>

            {/* Current Balances Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <span className="text-[11px] text-zinc-400 block font-medium">💵 Real Balans:</span>
                <span className="text-base font-black font-mono text-emerald-400">
                  ${(user.realBalance || 0).toFixed(2)}
                </span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                <span className="text-[11px] text-zinc-400 block font-medium">🎁 Bonus Balans:</span>
                <span className="text-base font-black font-mono text-amber-400">
                  ${(user.bonusBalance || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              {saveSuccess ? (
                <div className="flex items-center space-x-1.5 text-emerald-400 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{lang === 'az' ? 'Məlumatlar uğurla yadda saxlanıldı!' : 'Saved successfully!'}</span>
                </div>
              ) : <div />}

              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saxlanılır...' : (lang === 'az' ? 'Dəyişiklikləri Saxla' : 'Save Changes')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Deposit History */}
        {activeTab === 'deposits' && (
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {lang === 'az' ? 'Təsdiqlənmiş & Gözləyən Depozitlər' : 'Deposit Transactions'}
              </h3>
              <button
                onClick={loadUserHistory}
                className="text-[11px] text-amber-400 hover:underline cursor-pointer"
              >
                Yenilə 🔄
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center text-zinc-500 text-xs">Yüklənir...</div>
            ) : depositHistory.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-6 space-y-2">
                <ArrowDownRight className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-medium">
                  {lang === 'az' ? 'Hələ heç bir depozit əməliyyatınız qeydə alınmayıb.' : 'No deposit records found.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {depositHistory.map((d) => (
                  <div
                    key={d.id}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-black font-mono text-emerald-400">
                          +${Number(d.amount || 0).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          d.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : d.status === 'rejected'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {d.status === 'completed' ? 'Təsdiqləndi ✅' : d.status === 'rejected' ? 'İmtina edildi ❌' : 'Yoxlanılır ⏳'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center space-x-2">
                        <span>Çek: {d.receiptName || 'Bilinməyən'}</span>
                        <span>•</span>
                        <span>{d.createdAt ? new Date(d.createdAt).toLocaleString('az-AZ') : ''}</span>
                      </div>
                    </div>

                    {d.receiptPreviewUrl && (
                      <a
                        href={d.receiptPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-400 hover:underline shrink-0 bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-700"
                      >
                        Çekə Bax 📄
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Withdrawal History */}
        {activeTab === 'withdrawals' && (
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {lang === 'az' ? 'Balansdan Çıxarış Sorğuları' : 'Withdrawal Transactions'}
              </h3>
              <button
                onClick={loadUserHistory}
                className="text-[11px] text-amber-400 hover:underline cursor-pointer"
              >
                Yenilə 🔄
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-12 text-center text-zinc-500 text-xs">Yüklənir...</div>
            ) : withdrawalHistory.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-6 space-y-2">
                <ArrowUpRight className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-medium">
                  {lang === 'az' ? 'Hələ heç bir çıxarış sorğunuz yoxdur.' : 'No withdrawal records found.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {withdrawalHistory.map((w) => (
                  <div
                    key={w.id}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-black font-mono text-amber-400">
                          -${Number(w.amount || 0).toFixed(2)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          w.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : w.status === 'rejected'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {w.status === 'approved' ? 'Ödənildi ✅' : w.status === 'rejected' ? 'Ləğv edildi ❌' : 'Gözləmədə ⏳'}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center space-x-2">
                        <span>Kart: {w.cardNumber || '••••'}</span>
                        <span>•</span>
                        <span>{w.createdAt ? new Date(w.createdAt).toLocaleString('az-AZ') : ''}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Account Registration Details */}
        {activeTab === 'account' && (
          <div className="py-4 space-y-4">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>{lang === 'az' ? 'Qeydiyyat & Təhlükəsizlik Məlumatları' : 'Registration & Security Info'}</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                  <span className="text-zinc-500 block text-[11px]">Qeydiyyat Tarixi:</span>
                  <strong className="text-white font-mono">{registrationDate}</strong>
                </div>

                <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                  <span className="text-zinc-500 block text-[11px]">Qeydiyyat E-poçtu:</span>
                  <strong className="text-amber-300 font-mono truncate block">{user.email || 'Qeyd olunmayıb'}</strong>
                </div>

                <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                  <span className="text-zinc-500 block text-[11px]">Hesab ID (UID):</span>
                  <strong className="text-zinc-400 font-mono text-[10px] break-all block">{user.id}</strong>
                </div>

                <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800/80 space-y-1">
                  <span className="text-zinc-500 block text-[11px]">VIP Səviyyə:</span>
                  <strong className="text-yellow-400 font-bold">VIP {user.vipLevel || 1}</strong>
                </div>
              </div>
            </div>

            {/* Quick Logout Button */}
            {onLogout && (
              <div className="pt-2 border-t border-zinc-850 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-red-950/80 to-zinc-900 hover:from-red-900 border border-red-800/50 text-red-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center space-x-1.5"
                >
                  <span>Hesabdan Çıxış Et</span>
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
