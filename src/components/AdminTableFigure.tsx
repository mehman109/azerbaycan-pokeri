import React, { useState } from 'react';
import { PokerTableState, Player } from '../types/poker';
import { soundManager } from '../utils/audioEngine';
import { 
  UserX, 
  Bot, 
  User, 
  Plus, 
  Coins, 
  Sparkles, 
  Check, 
  AlertTriangle,
  Flame,
  Layers,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AdminTableFigureProps {
  table: PokerTableState;
  onKickPlayer?: (tableId: string, playerId: string) => void;
  onAddBotToTable?: (tableId: string) => void;
  onRemoveBotFromTable?: (tableId: string, botId?: string) => void;
  showToast: (msg: string) => void;
}

export const AdminTableFigure: React.FC<AdminTableFigureProps> = ({
  table,
  onKickPlayer,
  onAddBotToTable,
  onRemoveBotFromTable,
  showToast,
}) => {
  const [hoveredSeat, setHoveredSeat] = useState<number | null>(null);
  const [confirmKickPlayer, setConfirmKickPlayer] = useState<{ id: string; name: string; isHuman: boolean; seatIdx: number } | null>(null);

  const capacity = table.capacity || 6;
  const players = table.players || [];
  const activePlayers = players.filter((p): p is Player => p !== null);
  const humanCount = activePlayers.filter((p) => p.isHuman).length;
  const botCount = activePlayers.filter((p) => !p.isHuman).length;

  const handleKick = (player: Player, seatIdx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onKickPlayer) {
      onKickPlayer(table.id, player.id);
      soundManager.playErrorSound();
      showToast(
        player.isHuman
          ? `⛔ "${player.name}" (İnsan Oyunçu) masadan kənarlaşdırıldı (Kick olundu).`
          : `🤖 "${player.name}" (Pro Bot) masasından çıxarıldı.`
      );
      setConfirmKickPlayer(null);
    }
  };

  const handleKickAllBots = () => {
    const bots = activePlayers.filter((p) => !p.isHuman);
    if (bots.length === 0) {
      showToast('Masada heç bir bot yoxdur.');
      return;
    }
    bots.forEach((b) => {
      if (onKickPlayer) onKickPlayer(table.id, b.id);
    });
    soundManager.playFoldSound();
    showToast(`🧹 "${table.name}" masasındakı bütün ${bots.length} bot təmizləndi.`);
  };

  const handleKickAllPlayers = () => {
    if (activePlayers.length === 0) {
      showToast('Masa artıq tamamilə boşdur.');
      return;
    }
    if (confirm(`"${table.name}" masasındakı BÜTÜN ${activePlayers.length} oyunçunu (insanlar və botlar) masadan çıxarmaq istəyirsiniz?`)) {
      activePlayers.forEach((p) => {
        if (onKickPlayer) onKickPlayer(table.id, p.id);
      });
      soundManager.playErrorSound();
      showToast(`⛔ "${table.name}" masası tamamilə boşaldıldı.`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual Poker Table Figure Container */}
      <div className="relative w-full rounded-3xl bg-zinc-950/90 border border-zinc-800/80 p-4 sm:p-6 overflow-hidden shadow-2xl select-none">
        
        {/* Table Felt Background Lighting & Rim */}
        <div className="relative w-full max-w-2xl mx-auto h-[380px] sm:h-[440px] flex items-center justify-center">
          
          {/* Outer Leather Rail / Table Border */}
          <div className="absolute inset-2 sm:inset-4 rounded-[999px] bg-gradient-to-b from-amber-950/80 via-zinc-900 to-black border-4 sm:border-[6px] border-amber-900/60 ring-2 ring-amber-500/20 shadow-[0_0_50px_rgba(0,0,0,0.9)_inset] flex items-center justify-center">
            
            {/* Inner Gold Inlay Ring */}
            <div className="w-[94%] h-[92%] rounded-[999px] border border-amber-500/30 p-2 flex items-center justify-center">
              
              {/* Green Felt Surface */}
              <div className="w-full h-full rounded-[999px] bg-gradient-to-b from-emerald-850 via-emerald-950 to-teal-950 shadow-[0_0_60px_rgba(0,0,0,0.85)_inset] border border-emerald-500/30 flex flex-col items-center justify-center relative overflow-hidden">
                
                {/* Felt Texture & Radial Glow */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,transparent_75%)] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_40%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

                {/* Felt Center Watermark & Branding */}
                <div className="text-center z-10 pointer-events-none space-y-1 sm:space-y-1.5 px-4">
                  <div className="flex items-center justify-center space-x-2 text-emerald-300/40 text-[10px] sm:text-xs font-black uppercase tracking-widest font-mono">
                    <span>♠</span>
                    <span>POKER ARENA PRO</span>
                    <span>♥</span>
                  </div>
                  
                  {/* Pot & Blinds Badge in Center */}
                  <div className="inline-flex flex-col items-center justify-center bg-black/60 backdrop-blur-md border border-amber-500/40 px-3.5 py-1.5 sm:py-2 rounded-2xl shadow-xl">
                    <div className="flex items-center space-x-1.5 text-amber-400 font-mono font-black text-xs sm:text-sm">
                      <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>BANK: ${(table.pot || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-zinc-300 font-medium mt-0.5">
                      <span className="text-emerald-400 font-bold font-mono">
                        ${table.smallBlind.toFixed(2)} / ${table.bigBlind.toFixed(2)}
                      </span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-zinc-800/80 text-amber-300 uppercase font-mono text-[9px]">
                        {table.stage}
                      </span>
                    </div>
                  </div>

                  {/* Community Cards Display if present */}
                  {table.communityCards && table.communityCards.length > 0 && (
                    <div className="flex items-center justify-center space-x-1 pt-1">
                      {table.communityCards.map((c, cIdx) => {
                        const isRed = c.suit === 'hearts' || c.suit === 'diamonds';
                        const suitSymbol = c.suit === 'hearts' ? '♥' : c.suit === 'diamonds' ? '♦' : c.suit === 'clubs' ? '♣' : '♠';
                        return (
                          <div
                            key={cIdx}
                            className={`w-6 h-9 sm:w-7 sm:h-10 bg-white rounded-md border border-zinc-400 shadow-md flex flex-col items-center justify-center font-mono font-black text-[11px] sm:text-xs ${
                              isRed ? 'text-red-600' : 'text-zinc-950'
                            }`}
                          >
                            <span>{c.rank}</span>
                            <span className="text-[9px] -mt-1">{suitSymbol}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Action Hint */}
                  <div className="text-[9.5px] sm:text-[10.5px] text-emerald-200/60 font-bold tracking-wide">
                    👆 Çıxarmaq (Kick) üçün oyunçunun üzərinə klikləyin
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Symmetrically Positioned Player Seats around the Table Figure */}
          {Array.from({ length: capacity }).map((_, seatIdx) => {
            const player = players[seatIdx];
            
            // Calculate trigonometric coordinates for standard oval layout (0 to 360 deg)
            // Angle starts from bottom (+90 deg offset) and goes clockwise
            const angle = ((seatIdx * (360 / capacity)) + 90) * (Math.PI / 180);
            const radiusX = 41; // horizontal spread %
            const radiusY = 39; // vertical spread %
            const left = 50 + radiusX * Math.cos(angle);
            const top = 50 + radiusY * Math.sin(angle);

            if (player) {
              const isHuman = player.isHuman;

              return (
                <div
                  key={player.id || seatIdx}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                  onMouseEnter={() => setHoveredSeat(seatIdx)}
                  onMouseLeave={() => setHoveredSeat(null)}
                >
                  {/* Clickable Player Card */}
                  <button
                    type="button"
                    onClick={(e) => handleKick(player, seatIdx, e)}
                    title={`"${player.name}" oyunçusunu masadan çıxartmaq (Kick) üçün klikləyin`}
                    className={`relative flex items-center space-x-2 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl border-2 backdrop-blur-md transition-all duration-200 cursor-pointer shadow-xl ${
                      isHuman
                        ? 'bg-zinc-950/95 border-emerald-500 hover:border-red-500 hover:bg-red-950/80 hover:shadow-red-500/40 ring-1 ring-emerald-400/40'
                        : 'bg-zinc-950/95 border-purple-500 hover:border-red-500 hover:bg-red-950/80 hover:shadow-red-500/40 ring-1 ring-purple-400/40'
                    } group-hover:scale-110 active:scale-95`}
                  >
                    {/* Avatar & Seat Number Badge */}
                    <div className="relative shrink-0">
                      <img
                        src={player.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.name}`}
                        alt={player.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-900 border border-zinc-700 object-cover"
                      />
                      <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-200 text-[8px] sm:text-[9px] font-mono font-black flex items-center justify-center shadow">
                        {seatIdx + 1}
                      </span>
                      {isHuman ? (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-zinc-950 flex items-center justify-center text-[8px] text-zinc-950 font-black shadow" title="Canlı İnsan Oyunçu">
                          👤
                        </span>
                      ) : (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 border border-zinc-950 flex items-center justify-center text-[8px] text-white font-black shadow" title="%95 Pro AI Bot">
                          🤖
                        </span>
                      )}
                    </div>

                    {/* Player Info (Name & Chips) */}
                    <div className="text-left min-w-0 max-w-[70px] sm:max-w-[85px]">
                      <div className="text-[11px] sm:text-xs font-black text-white truncate group-hover:text-red-200">
                        {player.name}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-mono font-bold text-amber-400 truncate">
                        ${(player.chips || 0).toFixed(2)}
                      </div>
                      <div className="text-[8px] font-extrabold uppercase tracking-tight truncate">
                        {isHuman ? (
                          <span className="text-emerald-400">İNSAN</span>
                        ) : (
                          <span className="text-purple-300">PRO BOT</span>
                        )}
                      </div>
                    </div>

                    {/* Prominent Red Kick Badge on Top Right */}
                    <div className="ml-1 shrink-0 p-1 rounded-lg bg-red-600/80 group-hover:bg-red-500 text-white shadow-md flex items-center justify-center transition-all group-hover:scale-110">
                      <UserX className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>

                    {/* Hover Tooltip Overlay */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30">
                      KİCK ET (ÇIXAR)
                    </div>
                  </button>
                </div>
              );
            }

            // Empty Seat in Figure
            return (
              <div
                key={seatIdx}
                style={{ left: `${left}%`, top: `${top}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onAddBotToTable) {
                      onAddBotToTable(table.id);
                      soundManager.playChipSound();
                      showToast(`🤖 Yer #${seatIdx + 1}-ə Pro Bot əlavə edildi.`);
                    }
                  }}
                  title="Boş yerə 1 kliklə Pro Bot oturt"
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-950/70 hover:bg-purple-950/60 hover:border-purple-500/80 text-zinc-500 hover:text-purple-300 transition-all flex items-center space-x-1.5 cursor-pointer shadow group"
                >
                  <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-purple-500 text-zinc-500 group-hover:text-purple-300 text-[9px] font-mono font-bold flex items-center justify-center">
                    {seatIdx + 1}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold group-hover:text-purple-300 whitespace-nowrap">
                    + Boş Yer
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom Figure Control Strip */}
        <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center space-x-3 text-zinc-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-300 font-bold">{humanCount} İnsan</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-zinc-300 font-bold">{botCount} Pro Bot</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-dashed border-zinc-500" />
              <span className="text-zinc-400">{capacity - activePlayers.length} Boş Yer</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {botCount > 0 && (
              <button
                type="button"
                onClick={handleKickAllBots}
                className="px-2.5 py-1 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95 flex items-center space-x-1"
                title="Masadakı bütün botları çıxar"
              >
                <Bot className="w-3 h-3 text-purple-400" />
                <span>Bütün Botları Çıxar ({botCount})</span>
              </button>
            )}

            {activePlayers.length > 0 && (
              <button
                type="button"
                onClick={handleKickAllPlayers}
                className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95 flex items-center space-x-1"
                title="Bütün oyunçuları masadan çıxar"
              >
                <UserX className="w-3 h-3 text-red-400" />
                <span>Masanı Tam Boşalt ({activePlayers.length})</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
