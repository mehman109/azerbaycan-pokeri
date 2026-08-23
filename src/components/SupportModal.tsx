import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Headphones, Send, Bot, UserCheck } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { soundManager } from '../utils/audioEngine';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const t = translations[lang];
  const [messages, setMessages] = useState<{ id: string; sender: 'agent' | 'user'; text: string; time: string }[]>([
    {
      id: 'm1',
      sender: 'agent',
      text: lang === 'az' 
        ? 'Salam! Poker Arena Canlı Dəstək xidmətinə xoş gəlmisiniz. Depozit, oyun qaydaları və ya hesabınızla bağlı necə kömək edə bilərik?' 
        : 'Hello! Welcome to Poker Arena 24/7 Live Support. How can we help you with deposits, table rules, or your account today?',
      time: '12:00',
    },
  ]);
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    soundManager.playButtonClick();

    const userMsg = {
      id: `u_${Date.now()}`,
      sender: 'user' as const,
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const query = inputText.toLowerCase();
    setInputText('');

    setTimeout(() => {
      let reply = lang === 'az'
        ? 'Təşəkkür edirik! Sorğunuz qeydə alındı. Dəstək operatorumuz bir neçə dəqiqə ərzində cavablandıracaq.'
        : 'Thank you! Your request has been logged. Our live operator will respond shortly.';

      if (query.includes('depozit') || query.includes('deposit') || query.includes('balans') || query.includes('kassa')) {
        reply = lang === 'az'
          ? 'Depozit əməliyyatları Kassa (Cashier) bölməsindən dərhal həyata keçirilir. Visa/Mastercard və Kripto (USDT) ani olaraq balansa oturur.'
          : 'Deposits can be completed instantly from the Cashier menu. Visa/Mastercard and USDT are credited immediately.';
      } else if (query.includes('qayda') || query.includes('kombinasiya') || query.includes('rule') || query.includes('hand')) {
        reply = lang === 'az'
          ? 'Poker kombinasiyalarının tam reytinqini masada "Kombinasiyalar Bələdçisi" düyməsinə klikləyərək görə bilərsiniz!'
          : 'You can check the full poker hand rankings guide anytime via the "Hand Rankings" button on the table!';
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'agent',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      soundManager.playCardDeal();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-5 text-zinc-100 shadow-2xl shadow-black/90 my-8 flex flex-col h-[520px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Headphones className="w-5 h-5" />
              </div>
              <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950 absolute -bottom-0.5 -right-0.5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">{t.live_support}</h2>
                <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-[10px] text-emerald-400 font-semibold">
                  24/7 Online
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {lang === 'az' ? 'VIP Canlı Dəstək Xidməti' : 'VIP Live Assistance Service'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            id="support_close_btn"
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center space-x-1.5 mb-1 text-[11px] text-zinc-500">
                {m.sender === 'agent' ? (
                  <span className="flex items-center space-x-1 text-emerald-400 font-semibold">
                    <Bot className="w-3 h-3" />
                    <span>Support Desk</span>
                  </span>
                ) : (
                  <span>You</span>
                )}
                <span>• {m.time}</span>
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-amber-500 text-zinc-950 font-medium rounded-tr-xs'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-xs'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="pt-3 border-t border-zinc-800 flex space-x-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={lang === 'az' ? 'Mesajınızı yazın...' : 'Type your message...'}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            id="send_support_msg_btn"
            className="p-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl font-bold transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </div>
  );
};
