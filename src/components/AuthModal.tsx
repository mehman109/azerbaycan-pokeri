import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { translations, Language } from '../utils/translations';
import { CurrencyType, UserProfile, GOLDEN_ACE_AVATAR } from '../types/poker';
import { 
  ShieldCheck, 
  Sparkles, 
  KeyRound, 
  Mail, 
  User, 
  Lock, 
  CheckSquare, 
  Square, 
  X, 
  AlertCircle,
  ArrowLeft,
  UserPlus,
  LogIn,
  Loader2
} from 'lucide-react';
import { soundManager } from '../utils/audioEngine';
import { 
  auth, 
  googleProvider, 
  syncUserProfile,
  registerUserSeamlessly,
  signInUserSeamlessly
} from '../services/firebase';
import { 
  signInWithPopup, 
  sendPasswordResetEmail 
} from 'firebase/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSuccessAuth: (user: UserProfile) => void;
  initialMode?: 'signin' | 'signup' | 'admin';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSuccessAuth,
  initialMode = 'signup',
}) => {
  const t = translations[lang];
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'admin'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forgotPassSent, setForgotPassSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Sync mode when initialMode changes
  React.useEffect(() => {
    setAuthMode(initialMode);
    setErrorMsg('');
    setIsLoading(false);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const isSignUp = authMode === 'signup';
  const isAdminMode = authMode === 'admin';

  const handleGoogleAuth = async () => {
    soundManager.playButtonClick();
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const profile = await syncUserProfile(res.user, { currency });
      onSuccessAuth(profile);
      onClose();
    } catch (err: any) {
      console.error('Google auth error:', err);
      setErrorMsg(err.message || (lang === 'az' ? 'Google ilə giriş xətası' : 'Google sign-in error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(lang === 'az' ? 'Şifrəni bərpa etmək üçün düzgün e-poçt ünvanınızı daxil edin' : 'Enter a valid email address to reset password');
      return;
    }
    soundManager.playButtonClick();
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setForgotPassSent(true);
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(err.message || (lang === 'az' ? 'Xəta baş verdi' : 'Error sending reset email'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playButtonClick();
    setErrorMsg('');

    // 1. ADMIN LOGIN FLOW
    if (isAdminMode) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        setErrorMsg(lang === 'az' ? 'Zəhmət olmasa e-poçt və şifrəni daxil edin' : 'Please enter email and password');
        return;
      }

      if (cleanEmail !== 'nmehman659@gmail.com') {
        soundManager.playErrorSound();
        setErrorMsg(
          lang === 'az'
            ? 'Yanlış admin məlumatları'
            : 'Access Denied'
        );
        return;
      }

      setIsLoading(true);
      try {
        const profile = await signInUserSeamlessly(cleanEmail, password);
        if (profile.isAdmin || profile.username === 'ADMIN' || cleanEmail === 'nmehman659@gmail.com') {
          profile.isAdmin = true;
          profile.username = 'ADMIN';
          profile.realBalance = profile.realBalance > 0 ? profile.realBalance : 7500.00;
          profile.bonusBalance = 0.00;
          profile.vipLevel = 10;
          profile.avatar = GOLDEN_ACE_AVATAR;
          localStorage.setItem('poker_user_session', JSON.stringify(profile));
        }
        soundManager.playWinSound();
        onSuccessAuth(profile);
        onClose();
      } catch (err: any) {
        console.error('Admin Sign In error:', err);
        if (err.message === 'auth/wrong-password' || err.code === 'auth/wrong-password') {
          setErrorMsg(lang === 'az' ? 'Admin şifrəsi yanlışdır' : 'Invalid admin password');
        } else {
          // If first-time creation or credential creation
          try {
            const adminProfile = await registerUserSeamlessly(cleanEmail, password, 'ADMIN', 'USD');
            adminProfile.isAdmin = true;
            adminProfile.username = 'ADMIN';
            adminProfile.realBalance = 7500.00;
            adminProfile.bonusBalance = 0.00;
            adminProfile.vipLevel = 10;
            adminProfile.avatar = GOLDEN_ACE_AVATAR;
            localStorage.setItem('poker_user_session', JSON.stringify(adminProfile));
            soundManager.playWinSound();
            onSuccessAuth(adminProfile);
            onClose();
          } catch (regErr: any) {
            console.error('Admin registration fallback error:', regErr);
            setErrorMsg(regErr.message || (lang === 'az' ? 'Admin girişi zamanı xəta baş verdi' : 'Admin sign-in error'));
          }
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. USER SIGN UP FLOW
    if (isSignUp) {
      if (!username.trim() || username.length < 3) {
        setErrorMsg(lang === 'az' ? 'İstifadəçi adı ən azı 3 simvol olmalıdır' : 'Username must be at least 3 characters');
        return;
      }
      if (!email.includes('@')) {
        setErrorMsg(lang === 'az' ? 'Düzgün e-poçt ünvanı daxil edin' : 'Please enter a valid email address');
        return;
      }
      if (password.length < 6) {
        setErrorMsg(lang === 'az' ? 'Şifrə ən azı 6 simvoldan ibarət olmalıdır' : 'Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg(lang === 'az' ? 'Şifrə təkrarı uyğun gəlmir' : 'Passwords do not match');
        return;
      }
      if (!agreeTerms) {
        setErrorMsg(lang === 'az' ? 'Şərtlər və Qaydaları qəbul etməlisiniz' : 'You must accept the Terms & Conditions');
        return;
      }
      if (!agreeAge) {
        setErrorMsg(lang === 'az' ? '18 yaş təsdiqi tələb olunur (+18)' : 'Age verification (+18) is required');
        return;
      }

      setIsLoading(true);
      try {
        const profile = await registerUserSeamlessly(email.trim(), password, username.trim(), currency);
        onSuccessAuth(profile);
        onClose();
      } catch (err: any) {
        console.error('Sign up error:', err);
        if (err.code === 'auth/email-already-in-use') {
          setErrorMsg(lang === 'az' ? 'Bu e-poçt ünvanı artıq qeydiyyatdan keçib' : 'This email address is already registered');
        } else if (err.code === 'auth/weak-password') {
          setErrorMsg(lang === 'az' ? 'Şifrə çox zəifdir (ən azı 6 simvol)' : 'Password is too weak');
        } else {
          setErrorMsg(err.message || (lang === 'az' ? 'Qeydiyyat zamanı xəta baş verdi' : 'Registration failed'));
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // 3. USER SIGN IN FLOW
      if (!email.trim() || !password) {
        setErrorMsg(lang === 'az' ? 'Zəhmət olmasa bütün xanaları doldurun' : 'Please fill in all fields');
        return;
      }

      setIsLoading(true);
      try {
        const profile = await signInUserSeamlessly(email.trim(), password);
        onSuccessAuth(profile);
        onClose();
      } catch (err: any) {
        console.error('Sign in error:', err);
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.message === 'auth/wrong-password') {
          setErrorMsg(lang === 'az' ? 'E-poçt və ya şifrə yanlışdır' : 'Invalid email or password');
        } else {
          setErrorMsg(err.message || (lang === 'az' ? 'Giriş zamanı xəta baş verdi' : 'Sign in failed'));
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-zinc-950 border ${
          isAdminMode ? 'border-amber-400 shadow-amber-500/20' : 'border-amber-500/40'
        } rounded-2xl text-zinc-100 shadow-2xl shadow-black/90 overflow-hidden`}
      >
        {/* Sticky Header with Back button, Brand, and Close */}
        <div className={`p-4 sm:p-5 border-b ${isAdminMode ? 'border-amber-500/30 bg-amber-950/20' : 'border-zinc-850 bg-zinc-950/95'} backdrop-blur-sm shrink-0 space-y-3`}>
          {/* Mobile Drag Bar */}
          <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto sm:hidden" />

          {/* Top Row */}
          <div className="flex items-center justify-between">
            {authMode !== 'signin' ? (
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  setAuthMode('signin');
                  setErrorMsg('');
                }}
                id="auth_back_to_signin_btn"
                className="flex items-center space-x-1.5 py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-700/80 text-zinc-300 hover:text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                title={lang === 'az' ? 'Giriş Ekranına Qayıt' : 'Back to Sign In'}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'az' ? 'Geri Qayıt' : 'Back'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-zinc-950 font-black text-sm shadow-md">
                  ♠
                </div>
                <span className="text-sm sm:text-base font-black text-white tracking-wide">
                  ROYAL POKER
                </span>
              </div>
            )}

            {authMode !== 'signin' && (
              <div className="flex items-center space-x-2">
                <div className={`w-7 h-7 rounded-lg ${isAdminMode ? 'bg-gradient-to-tr from-amber-400 to-yellow-200' : 'bg-gradient-to-tr from-amber-600 to-amber-400'} flex items-center justify-center text-zinc-950 font-black text-sm shadow-md`}>
                  {isAdminMode ? '👑' : '♠'}
                </div>
                <span className={`text-sm sm:text-base font-black ${isAdminMode ? 'text-amber-300' : 'text-white'} tracking-wide`}>
                  {isAdminMode ? 'ADMIN GİRİŞİ' : 'ROYAL POKER'}
                </span>
              </div>
            )}

            {/* Close X */}
            <button
              onClick={onClose}
              id="auth_modal_close_btn"
              className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-850 transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher Tabs (Daxil Ol vs Qeydiyyat vs Admin) */}
          {!isAdminMode ? (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMsg('');
                  soundManager.playButtonClick();
                }}
                id="auth_tab_signin"
                className={`py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  authMode === 'signin'
                    ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t.signin_btn}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMsg('');
                  soundManager.playButtonClick();
                }}
                id="auth_tab_signup"
                className={`py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t.signup_btn}</span>
              </button>
            </div>
          ) : (
            <div className="p-2 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center justify-center space-x-2 text-amber-300 font-black text-xs">
              <span className="text-amber-400 font-black text-sm">👑</span>
              <span>ADMIN GİRİŞİ</span>
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900">
          {/* Header Subtitle / Alert Banner */}
          {isAdminMode ? null : isSignUp ? (
            <div className="p-3 bg-gradient-to-r from-amber-950/60 via-zinc-900 to-amber-950/60 border border-amber-500/40 rounded-xl space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-300 text-xs font-black">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>{lang === 'az' ? '$5.00 Qeydiyyat Bonusu Hədiyyə!' : '$5.00 Welcome Bonus Gift!'}</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                {lang === 'az'
                  ? 'Qeydiyyatdan dərhal sonra hesabınıza $5 bonus balansı əlavə olunacaq və poker masalarında oynaya biləcəksiniz.'
                  : 'Get $5 instant bonus balance right after registration to play on poker tables.'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 text-center">
              {t.auth_subtitle_signin}
            </p>
          )}

          {/* Error Alert */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex items-center space-x-2 shadow"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forgot password confirmation */}
          {forgotPassSent && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center space-x-2 shadow">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {lang === 'az'
                  ? 'Şifrə bərpa linki e-poçt ünvanınıza göndərildi.'
                  : 'Password reset link sent to your email address.'}
              </span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Username Field (Sign Up only) */}
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  {t.username} *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    id="auth_username_input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.username_placeholder}
                    required
                    disabled={isLoading}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                {isSignUp ? t.email : (lang === 'az' ? 'E-poçt ünvanı' : 'Email address')} *
              </label>
              <div className="relative">
                <Mail className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isAdminMode ? 'text-amber-400' : 'text-zinc-500'}`} />
                <input
                  type="email"
                  id="auth_email_input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isAdminMode ? 'admin@royalpoker.com' : isSignUp ? t.email_placeholder : 'adiniz@misal.com'}
                  required
                  disabled={isLoading}
                  className={`w-full bg-zinc-900 border ${
                    isAdminMode ? 'border-amber-500/60 focus:border-amber-400' : 'border-zinc-700 focus:border-amber-400'
                  } rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-300">
                  {t.password} *
                </label>
                {!isSignUp && !isAdminMode && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                    className="text-[11px] text-amber-400 hover:underline cursor-pointer font-medium"
                  >
                    {t.forgot_password}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isAdminMode ? 'text-amber-400' : 'text-zinc-500'}`} />
                <input
                  type="password"
                  id="auth_password_input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isAdminMode ? '••••••••••••' : t.password_placeholder}
                  required
                  disabled={isLoading}
                  className={`w-full bg-zinc-900 border ${
                    isAdminMode ? 'border-amber-500/60 focus:border-amber-400' : 'border-zinc-700 focus:border-amber-400'
                  } rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50`}
                />
              </div>
            </div>

            {/* Confirm Password Field (Sign Up only) */}
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  {t.confirm_password} *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    id="auth_confirm_password_input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t.confirm_password_placeholder}
                    required
                    disabled={isLoading}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {/* Currency Selector (Sign Up only) */}
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  {t.select_currency}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['USD', 'EUR', 'AZN', 'USDT'] as CurrencyType[]).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => {
                        setCurrency(curr);
                        soundManager.playButtonClick();
                      }}
                      className={`py-2 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        currency === curr
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/20'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      {curr === 'USD' && '$ USD'}
                      {curr === 'EUR' && '€ EUR'}
                      {curr === 'AZN' && '₼ AZN'}
                      {curr === 'USDT' && '₮ USDT'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Terms & Age Checkboxes for Sign Up */}
            {isSignUp && (
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAgreeTerms(!agreeTerms)}
                  className="flex items-center space-x-2.5 text-xs text-zinc-300 hover:text-white text-left cursor-pointer"
                >
                  {agreeTerms ? (
                    <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                  )}
                  <span>{t.terms_agree}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAgreeAge(!agreeAge)}
                  className="flex items-center space-x-2.5 text-xs text-zinc-300 hover:text-white text-left cursor-pointer"
                >
                  {agreeAge ? (
                    <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-600 shrink-0" />
                  )}
                  <span>{t.age_confirm}</span>
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              id="auth_submit_btn"
              disabled={isLoading}
              className={`w-full py-3.5 px-4 rounded-xl ${
                isAdminMode 
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-200 text-zinc-950 shadow-amber-500/30' 
                  : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-zinc-950 shadow-amber-500/25'
              } font-black text-sm shadow-lg transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span>{isAdminMode ? 'Daxil Ol' : isSignUp ? t.signup_btn : t.signin_btn}</span>
              )}
            </button>
          </form>

          {/* Social Logins (Only on standard non-admin modes) */}
          {!isAdminMode && (
            <div className="pt-3 border-t border-zinc-850">
              <div className="relative text-center mb-3">
                <span className="bg-zinc-950 px-2 text-[11px] text-zinc-500 uppercase tracking-wider font-bold">
                  {t.or_social}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isLoading}
                  className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs text-zinc-200 hover:text-white transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <span className="font-black text-red-400 text-sm">G</span>
                  <span className="font-bold">{lang === 'az' ? 'Google ilə Daxil Ol' : 'Continue with Google'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Footer */}
        <div className="p-3.5 bg-zinc-950 border-t border-zinc-850 flex items-center justify-between text-xs shrink-0">
          {!isAdminMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setAuthMode(isSignUp ? 'signin' : 'signup');
                  setErrorMsg('');
                  soundManager.playButtonClick();
                }}
                id="auth_toggle_mode_bottom_btn"
                className="text-amber-400 hover:text-amber-300 font-bold transition-colors cursor-pointer"
              >
                {isSignUp ? t.already_have_account : t.need_account}
              </button>

              {/* Dedicated Admin Login Button replacing the close button on Sign-In screen */}
              {isSignUp ? (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setAuthMode('signin');
                    setErrorMsg('');
                  }}
                  id="auth_bottom_back_to_signin_btn"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'az' ? 'Girişə Qayıt' : 'Back to Sign In'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setAuthMode('admin');
                    setErrorMsg('');
                  }}
                  id="auth_bottom_admin_btn"
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/80 to-zinc-900 hover:from-amber-900 hover:to-zinc-850 border border-amber-500/50 hover:border-amber-400 text-amber-300 hover:text-amber-200 font-black text-xs cursor-pointer transition-all active:scale-95 shadow-md shadow-amber-950/30"
                  title="Admin İdarəetmə Girişi"
                >
                  <span>👑</span>
                  <span>{lang === 'az' ? 'Admin Girişi' : 'Admin Login'}</span>
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  soundManager.playButtonClick();
                  setAuthMode('signin');
                  setErrorMsg('');
                }}
                id="auth_admin_back_to_user_btn"
                className="flex items-center space-x-1.5 text-zinc-400 hover:text-zinc-200 font-bold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === 'az' ? 'Oyunçu Girişinə Qayıt' : 'Back to Player Sign In'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                id="auth_admin_close_btn"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'az' ? 'Bağla' : 'Close'}</span>
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
