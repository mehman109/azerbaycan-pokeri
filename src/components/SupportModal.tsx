import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Send, 
  ShieldCheck, 
  Bot, 
  User, 
  CheckCheck, 
  Sparkles, 
  Clock, 
  MessageSquare,
  HelpCircle,
  Coins,
  ArrowDownCircle,
  AlertCircle
} from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { soundManager } from '../utils/audioEngine';
import { UserProfile } from '../types/poker';
import { 
  SupportMessage, 
  sendSupportMessage, 
  subscribeToPlayerSupportMessages, 
  markSupportMessagesReadByUser 
} from '../services/firebase';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: UserProfile | null;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  lang,
  user,
}) => {
  const t = translations[lang];
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const userId = user?.id || 'guest_user';
  const username = user?.username || (lang === 'az' ? 'Qonaq Oyunçu' : 'Guest Player');
  const userEmail = user?.email || 'guest@royalpoker.com';
  const userAvatar = user?.avatar || '';

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen) return;

    // Mark messages as read by this user
    markSupportMessagesReadByUser(userId);

    // Subscribe to live messages
    const unsubscribe = subscribeToPlayerSupportMessages(userId, (liveMessages) => {
      if (liveMessages && liveMessages.length > 0) {
        setMessages(liveMessages);
      } else {
        // Default welcome message from Admin if conversation is empty
        const defaultWelcome: SupportMessage = {
          id: 'welcome_msg',
          userId: userId,
          username: username,
          userEmail: userEmail,
          sender: 'admin',
          text: lang === 'az'
            ? 'Salam! Royal Poker Arenanın 7/24 Canlı Dəstək və İdarəetmə Mərkəzinə xoş gəlmisiniz. Depozit, pul çıxarışı və ya oyun masaları ilə bağlı hər hansı sualınızı birbaşa adminə yaza bilərsiniz.'
            : 'Hello! Welcome to Royal Poker 24/7 Live Support & Administration Center. Feel free to message the admin directly regarding deposits, withdrawals, or table issues.',
          createdAt: Date.now() - 60000,
          readByAdmin: true,
          readByUser: true,
        };
        setMessages([defaultWelcome]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, userId, username, userEmail, lang]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);
    soundManager.playButtonClick();

    try {
      await sendSupportMessage({
        userId,
        username,
        userEmail,
        userAvatar,
        sender: 'user',
        text,
        createdAt: Date.now(),
      });
      soundManager.playChipSound();
    } catch (err) {
      console.warn('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickQuestion = (text: string) => {
    setInputText(text);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-lg bg-zinc-950 border border-amber-500/30 rounded-3xl p-4 sm:p-5 text-zinc-100 shadow-2xl shadow-black/90 my-auto flex flex-col h-[560px] max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-amber-300 font-bold">
                  👑
                </div>
              </div>
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950 absolute -bottom-0.5 -right-0.5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight flex items-center space-x-1.5">
                  <span>{lang === 'az' ? 'Adminlə Canlı Əlaqə' : 'Live Admin Support'}</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-black uppercase tracking-wider">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium">
                {lang === 'az' ? 'Royal Poker 7/24 İdarəetmə Mərkəzi' : 'Royal Poker 24/7 Admin Desk'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.playButtonClick();
              onClose();
            }}
            id="support_close_btn"
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-850 transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 border-b border-zinc-900">
          <button
            type="button"
            onClick={() => handleQuickQuestion(lang === 'az' ? 'Salam admin, depozit çekimi göndərdim, zəhmət olmasa təsdiqləyin.' : 'Hello admin, I sent my deposit receipt, please verify.')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-amber-300 border border-zinc-800 text-[10.5px] font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <Coins className="w-3 h-3 text-amber-400" />
            <span>{lang === 'az' ? 'Depozit təsdiqi' : 'Deposit approval'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickQuestion(lang === 'az' ? 'Salam, balansdan pul çıxarışı ilə bağlı məlumat almaq istəyirəm.' : 'Hello, I have a question about withdrawal.')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-amber-300 border border-zinc-800 text-[10.5px] font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <ArrowDownCircle className="w-3 h-3 text-emerald-400" />
            <span>{lang === 'az' ? 'Pul çıxarışı' : 'Withdrawal'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickQuestion(lang === 'az' ? 'Oyun masası və qaydalar haqqında sualım var.' : 'I have a question about table rules.')}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-amber-300 border border-zinc-800 text-[10.5px] font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <HelpCircle className="w-3 h-3 text-cyan-400" />
            <span>{lang === 'az' ? 'Masa Qaydaları' : 'Table Rules'}</span>
          </button>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {messages.map((m) => {
            const isMe = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
              >
                <div className="flex items-center space-x-1.5 mb-1 text-[10.5px] text-zinc-500">
                  {!isMe ? (
                    <span className="flex items-center space-x-1 text-amber-300 font-bold">
                      <span>👑</span>
                      <span>Admin Dəstək</span>
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-semibold">{m.username || username}</span>
                  )}
                  <span>• {formatTime(m.createdAt)}</span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isMe
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-semibold rounded-tr-xs shadow-md shadow-amber-500/20'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-xs shadow-md shadow-black/40'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="pt-3 border-t border-zinc-800/80 flex items-center space-x-2 shrink-0">
          <input
            type="text"
            id="support_message_input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={lang === 'az' ? 'Adminə birbaşa mesajınızı yazın...' : 'Type message to Admin...'}
            disabled={isSending}
            className="flex-1 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50"
          />
          <button
            type="submit"
            id="send_support_msg_btn"
            disabled={!inputText.trim() || isSending}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-40 text-zinc-950 rounded-2xl font-black transition-all active:scale-95 cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );
};
