import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, FloatingEmoji } from '../types/poker';
import { Send, Smile, MessageSquare, X } from 'lucide-react';
import { soundManager } from '../utils/audioEngine';
import { Language } from '../utils/translations';

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = ['🔥', '👏', '💰', '🃏', '🕶️', '🚀', '😢', '🐟', '🦈', '🍻', '💥', '🏆'];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    soundManager.playButtonClick();
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleSelectEmoji = (emoji: string) => {
    soundManager.playButtonClick();
    onSendEmoji(emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="relative">
      {/* Floating Toggle Button */}
      <button
        onClick={onToggle}
        id="table_chat_toggle_btn"
        className={`p-2.5 rounded-xl border flex items-center space-x-1.5 transition-all shadow-lg ${
          isOpen
            ? 'bg-amber-500 border-amber-400 text-zinc-950 shadow-amber-500/20'
            : 'bg-zinc-900/90 border-zinc-700/80 text-zinc-300 hover:text-white hover:border-zinc-500'
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        <span className="text-xs font-semibold hidden sm:inline">
          {lang === 'az' ? 'Söhbət' : 'Chat'}
        </span>
      </button>

      {/* Expanded Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-12 left-0 w-72 sm:w-80 h-80 bg-zinc-950/95 border border-zinc-800 backdrop-blur-md rounded-2xl p-3 shadow-2xl flex flex-col z-30"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>{lang === 'az' ? 'Masa Söhbəti' : 'Table Chat'}</span>
              </span>
              <button
                onClick={onToggle}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-2 space-y-1.5 pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`text-xs ${
                    m.isSystem ? 'text-amber-400 italic text-[11px]' : 'text-zinc-300'
                  }`}
                >
                  {!m.isSystem && (
                    <span className="font-bold text-zinc-100 mr-1">{m.senderName}:</span>
                  )}
                  <span>{m.text}</span>
                </div>
              ))}
            </div>

            {/* Quick Emoji Strip */}
            <div className="py-1.5 border-t border-zinc-800 flex items-center justify-between gap-1 overflow-x-auto">
              {emojis.slice(0, 7).map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => handleSelectEmoji(emo)}
                  className="hover:scale-125 transition-transform text-base p-0.5"
                >
                  {emo}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* More Emojis Popover */}
            {showEmojiPicker && (
              <div className="absolute bottom-12 left-2 right-2 p-2 bg-zinc-900 border border-zinc-700 rounded-xl grid grid-cols-6 gap-2 text-xl z-40 shadow-xl">
                {emojis.map((emo) => (
                  <button
                    key={emo}
                    type="button"
                    onClick={() => handleSelectEmoji(emo)}
                    className="hover:scale-130 transition-transform flex items-center justify-center p-1 rounded hover:bg-zinc-800"
                  >
                    {emo}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSend} className="flex space-x-1.5 pt-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={lang === 'az' ? 'Yazın...' : 'Type...'}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="p-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
