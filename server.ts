import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';

const app = express();
const httpServer = http.createServer(app);
const PORT = 3000;

// Setup Socket.IO Server with ultra-low latency, zero-delay TCP configuration
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 5000,
  pingTimeout: 3000,
  transports: ['websocket', 'polling'],
  perMessageDeflate: false, // Disables compression buffering to achieve 0-second instantaneous packet transmission
  allowUpgrades: true,
  httpCompression: false,
});

// Disable Nagle's algorithm on incoming TCP connections for instant packet dispatch
httpServer.on('connection', (socket: any) => {
  if (typeof socket.setNoDelay === 'function') {
    socket.setNoDelay(true);
  }
});

app.use(express.json());

// In-Memory Real-Time State
const activeTables = new Map<string, any>();
const tableChats = new Map<string, any[]>();
let currentBotConfig = {
  isBotsActive: false, // Default to FALSE: Admin must explicitly enable bot games
  botDifficulty: 'pro',
  autoJoinLeaveEnabled: false, // Default to FALSE
  minThinkSeconds: 4,
  maxThinkSeconds: 9,
  targetTableOccupancy: 4,
  updatedAt: Date.now(),
};

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeTablesCount: activeTables.size,
    connectedSocketsCount: io.engine.clientsCount,
    uptime: process.uptime(),
  });
});

// Helper to sanitize table state per player (Zero-Cheat Security: Masks other players' hole cards during active hand)
function sanitizeTableStateForRecipient(tableState: any, recipientUserId?: string): any {
  if (!tableState || !tableState.players) return tableState;

  const isShowdownOrEnded = tableState.stage === 'showdown' || tableState.stage === 'hand_ended';

  const sanitizedPlayers = tableState.players.map((p: any) => {
    if (!p) return null;
    
    // If it's the player's own cards, or showdown stage, keep the cards visible
    const isOwnCards = recipientUserId && p.id === recipientUserId;
    if (isOwnCards || isShowdownOrEnded) {
      return p;
    }

    // For opponents during active betting rounds (preflop, flop, turn, river),
    // mask the ranks/suits so network sniffers/cheaters cannot see them!
    const maskedCards = (p.cards || []).map(() => ({
      suit: 'spades',
      rank: 'hidden',
      id: 'hidden_card',
    }));

    return {
      ...p,
      cards: maskedCards,
      bestFiveCards: undefined,
      handRankName: undefined,
      handRankScore: undefined,
    };
  });

  return {
    ...tableState,
    deck: [], // Always hide remaining deck from client payload for security
    players: sanitizedPlayers,
  };
}

// Socket.io Real-Time Event Handlers
const socketUserMap = new Map<string, { tableId: string; userId?: string; seatIndex?: number }>();

function broadcastTableStateSecurely(tableData: any, excludeSocketId?: string) {
  if (!tableData || !tableData.id) return;
  const roomName = `table_${tableData.id}`;
  const room = io.sockets.adapter.rooms.get(roomName);

  if (room) {
    for (const socketId of room) {
      if (excludeSocketId && socketId === excludeSocketId) continue;
      const clientSocket = io.sockets.sockets.get(socketId);
      if (clientSocket) {
        const userInfo = socketUserMap.get(socketId);
        const recipientUserId = userInfo?.userId;
        const sanitized = sanitizeTableStateForRecipient(tableData, recipientUserId);
        clientSocket.emit('table:updated', sanitized);
      }
    }
  }
}

io.on('connection', (socket) => {
  // 1. Join a specific table room for instant updates
  socket.on('table:join', ({ tableId, user, seatIndex }) => {
    if (!tableId) return;
    const roomName = `table_${tableId}`;
    socket.join(roomName);
    socketUserMap.set(socket.id, { tableId, userId: user?.id, seatIndex });

    // If server already has the cached state, send it securely to the joining user
    const existingTable = activeTables.get(tableId);
    if (existingTable) {
      // If this user was already seated and disconnected, mark them back active (isDisconnected: false)
      if (user?.id && existingTable.players) {
        let reconnected = false;
        existingTable.players = existingTable.players.map((p: any) => {
          if (p && p.id === user.id) {
            reconnected = true;
            return {
              ...p,
              isDisconnected: false,
            };
          }
          return p;
        });
        if (reconnected) {
          activeTables.set(tableId, existingTable);
          broadcastTableStateSecurely(existingTable);
        }
      }

      const sanitized = sanitizeTableStateForRecipient(existingTable, user?.id);
      socket.emit('table:state', sanitized);
    }

    const existingChat = tableChats.get(tableId) || [];
    if (existingChat.length > 0) {
      socket.emit('table:chat_history', existingChat);
    }
  });

  // 2. Leave a specific table room (viewer/spectator leaves without unseating player)
  socket.on('table:leave', ({ tableId }) => {
    if (!tableId) return;
    socket.leave(`table_${tableId}`);
    socketUserMap.delete(socket.id);
  });

  // 2b. Explicit Player Leave / Unseat event (When user deliberately clicks 'Leave Table' or stands up)
  socket.on('table:player_leave', ({ tableId, playerId, seatIndex }) => {
    if (!tableId) return;
    const existingTable = activeTables.get(tableId);
    if (existingTable && existingTable.players) {
      const updatedPlayers = [...existingTable.players];
      if (typeof seatIndex === 'number' && seatIndex >= 0 && seatIndex < updatedPlayers.length) {
        updatedPlayers[seatIndex] = null;
      }
      if (playerId) {
        for (let i = 0; i < updatedPlayers.length; i++) {
          if (updatedPlayers[i] && updatedPlayers[i].id === playerId) {
            updatedPlayers[i] = null;
          }
        }
      }
      const remainingOccupancy = updatedPlayers.filter((p: any) => p !== null).length;
      if (remainingOccupancy < 2) {
        existingTable.stage = 'waiting';
        existingTable.pot = 0;
        existingTable.communityCards = [];
        existingTable.handWinners = [];
      }
      existingTable.players = updatedPlayers;
      activeTables.set(tableId, existingTable);
      broadcastTableStateSecurely(existingTable);
      io.emit('lobby:table_changed', {
        id: existingTable.id,
        name: existingTable.name,
        stage: existingTable.stage,
        pot: existingTable.pot,
        playerCount: remainingOccupancy,
        capacity: existingTable.capacity,
        smallBlind: existingTable.smallBlind,
        bigBlind: existingTable.bigBlind,
        isCustomCreated: existingTable.isCustomCreated,
        gameType: existingTable.gameType,
        stakesTier: existingTable.stakesTier,
      });
    }
  });

  // 3. Instant table state synchronization (Moves, Cards, Pot, Turns, Showdown)
  socket.on('table:sync', (tableData) => {
    if (!tableData || !tableData.id) return;
    activeTables.set(tableData.id, tableData);

    // Broadcast instantaneously and securely to each player in the room
    broadcastTableStateSecurely(tableData, socket.id);

    // Broadcast table summary update to lobby
    io.emit('lobby:table_changed', {
      id: tableData.id,
      name: tableData.name,
      stage: tableData.stage,
      pot: tableData.pot,
      playerCount: (tableData.players || []).filter((p: any) => p !== null).length,
      capacity: tableData.capacity,
      smallBlind: tableData.smallBlind,
      bigBlind: tableData.bigBlind,
      isCustomCreated: tableData.isCustomCreated,
      gameType: tableData.gameType,
      stakesTier: tableData.stakesTier,
    });
  });

  // 4. Instant Player Action (Fold, Check, Call, Bet, Raise, All-in)
  socket.on('table:player_action', (actionData) => {
    if (!actionData || !actionData.tableId) return;
    io.to(`table_${actionData.tableId}`).emit('table:action_performed', actionData);
  });

  // 5. Instant Table Live Chat
  socket.on('table:chat_send', ({ tableId, message }) => {
    if (!tableId || !message) return;
    const textContent = String(message.text || message.message || '');
    const cleanMsg = {
      id: message.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tableId,
      senderId: message.senderId || (message.isSystem ? 'system' : 'unknown_player'),
      senderName: message.senderName || (message.isSystem ? 'System' : 'Player'),
      senderAvatar: message.senderAvatar || '',
      text: textContent,
      message: textContent,
      timestamp: typeof message.timestamp === 'number' ? message.timestamp : Date.now(),
      isSystem: Boolean(message.isSystem),
    };
    const list = tableChats.get(tableId) || [];
    list.push(cleanMsg);
    if (list.length > 80) list.shift();
    tableChats.set(tableId, list);

    io.to(`table_${tableId}`).emit('table:chat_received', cleanMsg);
  });

  // 6. Instant Table Floating Emojis
  socket.on('table:emoji_send', ({ tableId, emoji }) => {
    if (!tableId || !emoji) return;
    io.to(`table_${tableId}`).emit('table:emoji_received', emoji);
  });

  // 6b. Admin: Kick player from a live table
  socket.on('table:kick_player', ({ tableId, playerId, reason }) => {
    if (!tableId || !playerId) return;
    const defaultReason = reason || 'Admin tərəfindən masadan kənarlaşdırıldınız.';
    io.to(`table_${tableId}`).emit('table:player_kicked', { tableId, playerId, reason: defaultReason });
    
    const existingTable = activeTables.get(tableId);
    if (existingTable && existingTable.players) {
      existingTable.players = existingTable.players.map((p: any) => (p && p.id === playerId ? null : p));
      activeTables.set(tableId, existingTable);
      io.to(`table_${tableId}`).emit('table:updated', existingTable);
      io.emit('lobby:table_changed', {
        id: existingTable.id,
        name: existingTable.name,
        stage: existingTable.stage,
        pot: existingTable.pot,
        playerCount: existingTable.players.filter((p: any) => p !== null).length,
        capacity: existingTable.capacity,
        smallBlind: existingTable.smallBlind,
        bigBlind: existingTable.bigBlind,
        isCustomCreated: existingTable.isCustomCreated,
        gameType: existingTable.gameType,
        stakesTier: existingTable.stakesTier,
      });
    }
  });

  // 6c. Admin: Close Table completely
  socket.on('table:close_table', ({ tableId, reason }) => {
    if (!tableId) return;
    const closeReason = reason || 'Masa Admin tərəfindən bağlandı.';
    io.to(`table_${tableId}`).emit('table:closed_by_admin', { tableId, reason: closeReason });
    activeTables.delete(tableId);
    io.emit('lobby:table_removed', { tableId });
  });

  // 6d. Admin: Update Table Limits (SB/BB)
  socket.on('table:update_limits', ({ tableId, smallBlind, bigBlind }) => {
    if (!tableId || !smallBlind || !bigBlind) return;
    const existingTable = activeTables.get(tableId);
    if (existingTable) {
      existingTable.smallBlind = Number(smallBlind);
      existingTable.bigBlind = Number(bigBlind);
      existingTable.minBuyIn = Number(bigBlind) * 20;
      existingTable.maxBuyIn = Number(bigBlind) * 100;
      activeTables.set(tableId, existingTable);
      io.to(`table_${tableId}`).emit('table:updated', existingTable);
      io.emit('lobby:table_changed', {
        id: existingTable.id,
        name: existingTable.name,
        stage: existingTable.stage,
        pot: existingTable.pot,
        playerCount: (existingTable.players || []).filter((p: any) => p !== null).length,
        capacity: existingTable.capacity,
        smallBlind: existingTable.smallBlind,
        bigBlind: existingTable.bigBlind,
        isCustomCreated: existingTable.isCustomCreated,
        gameType: existingTable.gameType,
        stakesTier: existingTable.stakesTier,
      });
    }
  });

  // 6e. Admin: Real-time User Balance adjustment broadcast
  socket.on('user:balance_changed', ({ userId, newReal, newBonus, newPlay, reason }) => {
    if (!userId) return;
    io.emit('user:balance_updated', { userId, newReal, newBonus, newPlay, reason });
  });

  // 7. Lobby: Get all current active tables
  socket.on('lobby:get_all_tables', (callback) => {
    if (typeof callback === 'function') {
      callback(Array.from(activeTables.values()));
    }
  });

  // 8. Bot Configuration Real-Time Synchronization
  socket.on('bot_config:get', (callback) => {
    if (typeof callback === 'function') {
      callback(currentBotConfig);
    }
  });

  socket.on('bot_config:update', (newConfig) => {
    if (!newConfig) return;
    currentBotConfig = { ...currentBotConfig, ...newConfig, updatedAt: Date.now() };
    io.emit('bot_config:updated', currentBotConfig);

    // If bots were deactivated, remove all bots from all in-memory active tables
    if (newConfig.isBotsActive === false) {
      activeTables.forEach((tbl, tblId) => {
        if (tbl && tbl.players) {
          const cleaned = tbl.players.map((p: any) => (p && !p.isHuman ? null : p));
          const humanCount = cleaned.filter((p: any) => p !== null).length;
          tbl.players = cleaned;
          if (humanCount < 2) {
            tbl.stage = 'waiting';
            tbl.pot = 0;
            tbl.communityCards = [];
            tbl.handWinners = [];
          }
          activeTables.set(tblId, tbl);
          io.to(`table_${tblId}`).emit('table:updated', tbl);
          io.emit('lobby:table_changed', {
            id: tbl.id,
            name: tbl.name,
            stage: tbl.stage,
            pot: tbl.pot,
            playerCount: humanCount,
            capacity: tbl.capacity,
            smallBlind: tbl.smallBlind,
            bigBlind: tbl.bigBlind,
            isCustomCreated: tbl.isCustomCreated,
            gameType: tbl.gameType,
            stakesTier: tbl.stakesTier,
          });
        }
      });
    }
  });

  // 9. On Disconnect Cleanup (Preserve seats, mark player as temporarily disconnected so refresh resumes seamlessly)
  socket.on('disconnect', () => {
    const userSession = socketUserMap.get(socket.id);
    if (userSession && userSession.tableId) {
      const { tableId, userId } = userSession;
      const existingTable = activeTables.get(tableId);
      if (existingTable && existingTable.players && userId) {
        let modified = false;
        const updatedPlayers = existingTable.players.map((p: any) => {
          if (p && p.id === userId && !p.isDisconnected) {
            modified = true;
            return {
              ...p,
              isDisconnected: true,
            };
          }
          return p;
        });

        if (modified) {
          existingTable.players = updatedPlayers;
          activeTables.set(tableId, existingTable);
          broadcastTableStateSecurely(existingTable);
        }
      }
    }
    socketUserMap.delete(socket.id);
  });
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ WebSocket & HTTP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
