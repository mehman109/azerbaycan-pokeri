import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage } from '../types/poker';
import { Send, Smile, MessageSquare, X, Zap, ChevronRight } from 'lucide-react';
import { soundManager } from '../utils/audioEngine';
import { Language } from '../utils/translations';
import {
  QUICK_CHAT_PHRASES,
  QUICK_PHRASE_CATEGORIES,
  QuickPhrase,
  getQuickPhraseText,
} from '../constants/chatPhrases';

interface TableChatProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSendEmoji: (emoji: string) => void;
  lang: Language;
  isOpen: boolean;
  onToggle: () => void;
}

export const TableChat: React.FC<TableChatProps> = ({
  messages,
  onSendMessage,
  onSendEmoji,
  lang,
  isOpen,
  onToggle,
}) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'quick_phrases'>('messages');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = ['🔥', '👏', '💰', '🃏', '🕶️', '🚀', '😢', '🐟', '🦈', '🍻', '💥', '🏆', '🎯', '🍀', '👑'];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    soundManager.playButtonClick();
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleSendQuickPhrase = (phrase: QuickPhrase) => {
    soundManager.playButtonClick();
    const text = getQuickPhraseText(phrase, lang);
    onSendMessage(text);
    // Switch back to messages view so player sees it delivered
    setActiveTab('messages');
  };

  const handleSelectEmoji = (emoji: string) => {
    soundManager.playButtonClick();
    onSendEmoji(emoji);
    setShowEmojiPicker(false);
  };

  const filteredPhrases = selectedCategory === 'all'
    ? QUICK_CHAT_PHRASES
    : QUICK_CHAT_PHRASES.filter((p) => p.category === selectedCategory);

  return (
    <div className="relative">
      {/* Floating Chat & Quick Phrase Trigger Button */}
      <button
        onClick={onToggle}
        id="table_chat_toggle_btn"
        className={`px-3 py-2 rounded-xl border flex items-center space-x-1.5 transition-all shadow-lg cursor-pointer ${
          isOpen
            ? 'bg-amber-500 border-amber-400 text-zinc-950 shadow-amber-500/20 font-bold'
            : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-300 hover:text-white hover:border-amber-400/60'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-semibold hidden sm:inline">
          {lang === 'az' ? 'Söhbət & Tez Frazalar' : 'Chat & Phrases'}
        </span>
        {messages.length > 0 && !isOpen && (
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse ml-0.5" />
        )}
      </button>

      {/* Expanded Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-12 right-0 sm:right-auto sm:left-0 w-80 sm:w-96 h-96 bg-zinc-950/98 border border-zinc-800 backdrop-blur-xl rounded-2xl p-3 shadow-2xl flex flex-col z-40"
          >
            {/* Header with Navigation Tabs */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
              <div className="flex items-center space-x-1">
                {/* Messages Tab */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setActiveTab('messages');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    activeTab === 'messages'
                      ? 'bg-amber-500 text-zinc-950 font-black shadow'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{lang === 'az' ? 'Söhbət' : 'Messages'}</span>
                </button>

                {/* Quick Phrases Tab */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playButtonClick();
                    setActiveTab('quick_phrases');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                    activeTab === 'quick_phrases'
                      ? 'bg-amber-500 text-zinc-950 font-black shadow'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{lang === 'az' ? 'Tez Frazalar' : 'Quick Phrases'}</span>
                </button>
              </div>

              <button
                onClick={onToggle}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TAB CONTENT: Messages vs Quick Phrases */}
            {activeTab === 'messages' ? (
              <>
                {/* Messages Scroll Area */}
                <div className="flex-1 overflow-y-auto py-2 space-y-2 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500 space-y-1">
                      <MessageSquare className="w-6 h-6 stroke-1 text-zinc-600 mb-1" />
                      <p className="text-xs font-semibold text-zinc-400">
                        {lang === 'az' ? 'Hələ heç bir mesaj yoxdur' : 'No messages yet'}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {lang === 'az' ? 'Tez fraza seçin və ya mesaj yazın' : 'Send a quick phrase or type below'}
                      </p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`text-xs ${
                          m.isSystem
                            ? 'text-amber-400/90 italic text-[11px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg'
                            : 'text-zinc-200 bg-zinc-900/80 border border-zinc-850 p-2 rounded-xl'
                        }`}
                      >
                        {!m.isSystem && (
                          <div className="flex items-center space-x-1.5 mb-0.5">
                            {m.senderAvatar && (
                              <img
                                src={m.senderAvatar}
                                alt={m.senderName}
                                referrerPolicy="no-referrer"
                                className="w-4 h-4 rounded-full object-cover"
                              />
                            )}
                            <span className="font-bold text-amber-400 text-[11px]">{m.senderName}</span>
                            <span className="text-[9px] text-zinc-500 font-mono ml-auto">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                        <p className={m.isSystem ? '' : 'text-zinc-100 font-medium pl-0.5'}>{m.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Popular Quick Phrases Shortcut Bar in Messages view */}
                <div className="py-1.5 border-t border-zinc-850 overflow-x-auto flex items-center space-x-1.5 scrollbar-none">
                  {QUICK_CHAT_PHRASES.slice(0, 4).map((phrase) => (
                    <button
                      key={phrase.id}
                      type="button"
                      onClick={() => handleSendQuickPhrase(phrase)}
                      className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-amber-500/20 hover:border-amber-400/50 border border-zinc-800 text-[11px] text-zinc-300 hover:text-amber-300 whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1 shrink-0 font-medium"
                    >
                      <span>{getQuickPhraseText(phrase, lang)}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playButtonClick();
                      setActiveTab('quick_phrases');
                    }}
                    className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-400 text-[10px] font-bold whitespace-nowrap shrink-0 flex items-center space-x-0.5"
                  >
                    <span>{lang === 'az' ? 'Hamısı' : 'More'}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Quick Emoji Strip */}
                <div className="py-1 border-t border-zinc-850 flex items-center justify-between gap-1 overflow-x-auto">
                  {emojis.slice(0, 8).map((emo) => (
                    <button
                      key={emo}
                      type="button"
                      onClick={() => handleSelectEmoji(emo)}
                      className="hover:scale-130 active:scale-95 transition-transform text-base p-1 cursor-pointer"
                    >
                      {emo}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-zinc-400 hover:text-amber-400 p-1 rounded hover:bg-zinc-900 transition-colors"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                </div>

                {/* More Emojis Popover */}
                {showEmojiPicker && (
                  <div className="absolute bottom-14 left-2 right-2 p-2 bg-zinc-900 border border-zinc-700 rounded-xl grid grid-cols-6 gap-2 text-xl z-50 shadow-2xl">
                    {emojis.map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() => handleSelectEmoji(emo)}
                        className="hover:scale-130 active:scale-95 transition-transform flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-800"
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text Input */}
                <form onSubmit={handleSend} className="flex space-x-1.5 pt-1">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={lang === 'az' ? 'Mesaj yazın və ya fraza seçin...' : 'Type a message...'}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black rounded-xl transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            ) : (
              /* QUICK PHRASES FULL SELECTION VIEW */
              <div className="flex-1 flex flex-col overflow-hidden py-2 space-y-2">
                {/* Category Filter Pills */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playButtonClick();
                      setSelectedCategory('all');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-amber-500 text-zinc-950 font-black'
                        : 'bg-zinc-900 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {lang === 'az' ? 'Bütün Frazalar' : 'All Phrases'}
                  </button>

                  {QUICK_PHRASE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        setSelectedCategory(cat.id);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center space-x-1 ${
                        selectedCategory === cat.id
                          ? 'bg-amber-500 text-zinc-950 font-black'
                          : 'bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{lang === 'az' ? cat.nameAz : cat.nameEn}</span>
                    </button>
                  ))}
                </div>

                {/* Phrase Buttons Grid */}
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                  {filteredPhrases.map((phrase) => {
                    const text = getQuickPhraseText(phrase, lang);
                    return (
                      <button
                        key={phrase.id}
                        type="button"
                        onClick={() => handleSendQuickPhrase(phrase)}
                        className="w-full text-left px-3 py-2 rounded-xl bg-zinc-900/90 hover:bg-amber-500/20 border border-zinc-800 hover:border-amber-400/60 text-xs font-semibold text-zinc-200 hover:text-amber-300 transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer"
                      >
                        <span className="flex items-center space-x-2">
                          <span className="text-base">{phrase.icon || '💬'}</span>
                          <span>{text}</span>
                        </span>
                        <Send className="w-3.5 h-3.5 text-zinc-600 group-hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
