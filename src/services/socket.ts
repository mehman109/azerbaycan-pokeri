import { io, Socket } from 'socket.io-client';
import { PokerTableState, ChatMessage, FloatingEmoji, BotSystemConfig, UserProfile } from '../types/poker';

let socket: Socket | null = null;
let isConnected = false;
const connectionListeners = new Set<(connected: boolean) => void>();

export function getSocket(): Socket {
  if (!socket) {
    // In browser, connect to current host origin
    const url = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    
    socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      isConnected = true;
      console.log('🟢 WebSocket connected to server:', socket?.id);
      connectionListeners.forEach(fn => {
        try { fn(true); } catch {}
      });
    });

    socket.on('disconnect', (reason) => {
      isConnected = false;
      console.log('🔴 WebSocket disconnected:', reason);
      connectionListeners.forEach(fn => {
        try { fn(false); } catch {}
      });
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ WebSocket connection error:', err?.message || err);
    });
  }

  return socket;
}

export function isSocketConnected(): boolean {
  return isConnected;
}

export function subscribeToSocketConnection(callback: (connected: boolean) => void): () => void {
  connectionListeners.add(callback);
  callback(isConnected);
  return () => {
    connectionListeners.delete(callback);
  };
}

// ==========================================
// TABLE REAL-TIME WEBSOCKET SYNCHRONIZATION
// ==========================================

// Join a table's real-time room
export function joinTableSocket(tableId: string, user?: Partial<UserProfile>, seatIndex?: number): void {
  const s = getSocket();
  if (s && tableId) {
    s.emit('table:join', { tableId, user, seatIndex });
  }
}

// Leave a table's real-time room
export function leaveTableSocket(tableId: string, userId?: string, seatIndex?: number): void {
  const s = getSocket();
  if (s && tableId) {
    s.emit('table:leave', { tableId, userId, seatIndex });
  }
}

// Explicit player leave / unseat
export function emitPlayerLeaveSocket(tableId: string, playerId: string, seatIndex?: number): void {
  const s = getSocket();
  if (s && tableId) {
    s.emit('table:player_leave', { tableId, playerId, seatIndex });
  }
}

// Admin: Kick player from table
export function emitKickPlayerSocket(tableId: string, playerId: string, reason?: string): void {
  const s = getSocket();
  if (s && tableId && playerId) {
    s.emit('table:kick_player', { tableId, playerId, reason });
  }
}

// Subscribe to kicked player event
export function subscribeToPlayerKickedSocket(
  tableId: string,
  callback: (data: { tableId: string; playerId: string; reason: string }) => void
): () => void {
  const s = getSocket();
  const handleKicked = (data: { tableId: string; playerId: string; reason: string }) => {
    if (data && (!tableId || data.tableId === tableId)) {
      callback(data);
    }
  };
  s.on('table:player_kicked', handleKicked);
  return () => {
    s.off('table:player_kicked', handleKicked);
  };
}

// Admin: Close table completely
export function emitCloseTableSocket(tableId: string, reason?: string): void {
  const s = getSocket();
  if (s && tableId) {
    s.emit('table:close_table', { tableId, reason });
  }
}

// Subscribe to table closed event
export function subscribeToTableClosedSocket(
  tableId: string,
  callback: (data: { tableId: string; reason: string }) => void
): () => void {
  const s = getSocket();
  const handleClosed = (data: { tableId: string; reason: string }) => {
    if (data && (!tableId || data.tableId === tableId)) {
      callback(data);
    }
  };
  s.on('table:closed_by_admin', handleClosed);
  return () => {
    s.off('table:closed_by_admin', handleClosed);
  };
}

// Admin: Update Table Limits
export function emitUpdateTableLimitsSocket(tableId: string, smallBlind: number, bigBlind: number): void {
  const s = getSocket();
  if (s && tableId) {
    s.emit('table:update_limits', { tableId, smallBlind, bigBlind });
  }
}

// Admin: User Balance changed
export function emitUserBalanceChangedSocket(
  userId: string, 
  newReal: number, 
  newBonus: number, 
  newPlay: number, 
  reason?: string
): void {
  const s = getSocket();
  if (s && userId) {
    s.emit('user:balance_changed', { userId, newReal, newBonus, newPlay, reason });
  }
}

// Subscribe to real-time user balance updates
export function subscribeToUserBalanceChangedSocket(
  callback: (data: { userId: string; newReal: number; newBonus: number; newPlay: number; reason?: string }) => void
): () => void {
  const s = getSocket();
  const handleBalance = (data: any) => {
    if (data && data.userId) {
      callback(data);
    }
  };
  s.on('user:balance_updated', handleBalance);
  return () => {
    s.off('user:balance_updated', handleBalance);
  };
}

// Broadcast instant table state (moves, deals, bets, pot)
export function syncTableStateSocket(table: PokerTableState): void {
  const s = getSocket();
  if (s && table && table.id) {
    s.emit('table:sync', table);
  }
}

// Broadcast player action (fold, call, check, bet, raise, all-in) with 0-delay
export interface LivePlayerActionEvent {
  tableId: string;
  playerId: string;
  playerName?: string;
  avatar?: string;
  actionType: string;
  amount?: number;
  seatIndex: number;
  chipsRemaining?: number;
  timestamp?: number;
}

export function emitPlayerActionSocket(actionData: LivePlayerActionEvent): void {
  const s = getSocket();
  if (s && actionData) {
    const payload = {
      ...actionData,
      timestamp: actionData.timestamp || Date.now(),
    };
    s.emit('table:player_action', payload);
  }
}

// Subscribe to real-time live actions performed by players with zero latency
export function subscribeToPlayerActionSocket(
  tableId: string,
  onActionPerformed: (action: LivePlayerActionEvent) => void
): () => void {
  const s = getSocket();
  const handleAction = (data: LivePlayerActionEvent) => {
    if (data && (!tableId || data.tableId === tableId)) {
      onActionPerformed(data);
    }
  };
  s.on('table:action_performed', handleAction);
  return () => {
    s.off('table:action_performed', handleAction);
  };
}

// Subscribe to real-time table state updates for a specific table
export function subscribeToTableStateSocket(
  tableId: string,
  onTableUpdate: (table: PokerTableState) => void
): () => void {
  const s = getSocket();
  
  // Join table room
  joinTableSocket(tableId);

  const handleState = (remoteTable: PokerTableState) => {
    if (remoteTable && remoteTable.id === tableId) {
      onTableUpdate(remoteTable);
    }
  };

  const handleUpdate = (remoteTable: PokerTableState) => {
    if (remoteTable && remoteTable.id === tableId) {
      onTableUpdate(remoteTable);
    }
  };

  s.on('table:state', handleState);
  s.on('table:updated', handleUpdate);

  return () => {
    s.off('table:state', handleState);
    s.off('table:updated', handleUpdate);
    leaveTableSocket(tableId);
  };
}

// ==========================================
// REAL-TIME TABLE CHAT VIA WEBSOCKETS
// ==========================================

export function sendTableChatMessageSocket(tableId: string, message: ChatMessage): void {
  const s = getSocket();
  if (s && tableId && message) {
    s.emit('table:chat_send', { tableId, message });
  }
}

export function subscribeToTableChatSocket(
  tableId: string,
  onMessageReceived: (message: ChatMessage) => void,
  onHistoryReceived?: (history: ChatMessage[]) => void
): () => void {
  const s = getSocket();

  const handleChat = (msg: ChatMessage) => {
    onMessageReceived(msg);
  };

  const handleHistory = (history: ChatMessage[]) => {
    if (onHistoryReceived) {
      onHistoryReceived(history);
    }
  };

  s.on('table:chat_received', handleChat);
  s.on('table:chat_history', handleHistory);

  return () => {
    s.off('table:chat_received', handleChat);
    s.off('table:chat_history', handleHistory);
  };
}

// ==========================================
// REAL-TIME TABLE EMOJIS VIA WEBSOCKETS
// ==========================================

export function sendTableEmojiSocket(tableId: string, emoji: FloatingEmoji): void {
  const s = getSocket();
  if (s && tableId && emoji) {
    s.emit('table:emoji_send', { tableId, emoji });
  }
}

export function subscribeToTableEmojiSocket(
  tableId: string,
  onEmojiReceived: (emoji: FloatingEmoji) => void
): () => void {
  const s = getSocket();

  const handleEmoji = (emoji: FloatingEmoji) => {
    onEmojiReceived(emoji);
  };

  s.on('table:emoji_received', handleEmoji);

  return () => {
    s.off('table:emoji_received', handleEmoji);
  };
}

// ==========================================
// BOT CONFIG REAL-TIME WEBSOCKET
// ==========================================

export function sendBotConfigSocket(config: Partial<BotSystemConfig>): void {
  const s = getSocket();
  if (s && config) {
    s.emit('bot_config:update', config);
  }
}

export function subscribeToBotConfigSocket(
  onConfigUpdate: (config: BotSystemConfig) => void
): () => void {
  const s = getSocket();

  const handleUpdate = (cfg: BotSystemConfig) => {
    if (cfg) {
      onConfigUpdate(cfg);
    }
  };

  s.on('bot_config:updated', handleUpdate);

  // Request initial config
  s.emit('bot_config:get', (initialCfg: BotSystemConfig) => {
    if (initialCfg) {
      onConfigUpdate(initialCfg);
    }
  });

  return () => {
    s.off('bot_config:updated', handleUpdate);
  };
}

// ==========================================
// LOBBY TABLES REAL-TIME WEBSOCKET
// ==========================================

export function subscribeToLobbyTablesSocket(
  onTableChanged: (summary: any) => void
): () => void {
  const s = getSocket();

  const handleTableChanged = (summary: any) => {
    if (summary && summary.id) {
      onTableChanged(summary);
    }
  };

  s.on('lobby:table_changed', handleTableChanged);

  return () => {
    s.off('lobby:table_changed', handleTableChanged);
  };
}

