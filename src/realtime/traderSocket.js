import { traderConfig } from '../api/config.js';

const OPEN = 1;
const RECONNECT_MIN_MS = 750;
const RECONNECT_MAX_MS = 15000;

function uniqueStrings(values) {
  return [...new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))];
}

function candleKey(item) {
  const symbol = String(item?.symbol || '').trim().toUpperCase();
  const timeframe = String(item?.timeframe || '').trim().toLowerCase();
  return symbol && timeframe ? `${symbol}:${timeframe}` : null;
}

function candleFromKey(key) {
  const separator = key.indexOf(':');
  return { symbol: key.slice(0, separator), timeframe: key.slice(separator + 1) };
}

function increment(map, key) {
  const previous = map.get(key) || 0;
  map.set(key, previous + 1);
  return previous === 0;
}

function decrement(map, key) {
  const previous = map.get(key) || 0;
  if (previous <= 1) {
    map.delete(key);
    return previous === 1;
  }
  map.set(key, previous - 1);
  return false;
}

export class TraderSocket {
  constructor({ onEnvelope, onStatus, onSessionInvalid } = {}) {
    this.onEnvelope = onEnvelope;
    this.onStatus = onStatus;
    this.onSessionInvalid = onSessionInvalid;
    this.socket = null;
    this.token = null;
    this.intentionalClose = true;
    this.ready = false;
    this.retry = 0;
    this.reconnectTimer = null;
    this.lastSequence = 0;
    this.quoteRefs = new Map();
    this.tickRefs = new Map();
    this.candleRefs = new Map();
    this.handleOnline = () => {
      if (!this.intentionalClose && this.token && !this.socket) this.open();
    };
    window.addEventListener('online', this.handleOnline);
  }

  connect(token) {
    const nextToken = String(token || '').trim();
    if (!nextToken) {
      this.disconnect();
      return;
    }
    if (this.token === nextToken && (this.socket || this.reconnectTimer)) return;
    this.closeSocket(1000, 'Session changed');
    this.token = nextToken;
    this.intentionalClose = false;
    this.retry = 0;
    this.open();
  }

  refreshSessionContext(token = this.token) {
    const nextToken = String(token || '').trim();
    if (!nextToken) return false;
    this.closeSocket(1000, 'Account grants changed');
    this.token = nextToken;
    this.intentionalClose = false;
    this.retry = 0;
    this.clearReconnect();
    this.open();
    return true;
  }

  disconnect() {
    this.intentionalClose = true;
    this.token = null;
    this.ready = false;
    this.retry = 0;
    this.clearReconnect();
    this.closeSocket(1000, 'Client disconnected');
    this.emitStatus('disconnected');
  }

  destroy() {
    this.disconnect();
    window.removeEventListener('online', this.handleOnline);
  }

  subscribe({ quotes = [], ticks = [], candles = [] } = {}) {
    const added = { quotes: [], ticks: [], candles: [] };
    for (const symbol of uniqueStrings(quotes).map(value => value.toUpperCase())) {
      if (increment(this.quoteRefs, symbol)) added.quotes.push(symbol);
    }
    for (const symbol of uniqueStrings(ticks).map(value => value.toUpperCase())) {
      if (increment(this.tickRefs, symbol)) added.ticks.push(symbol);
    }
    for (const item of candles || []) {
      const key = candleKey(item);
      if (key && increment(this.candleRefs, key)) added.candles.push(candleFromKey(key));
    }
    if (this.ready) this.sendSubscription('subscribe', added);

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const removed = { quotes: [], ticks: [], candles: [] };
      for (const symbol of uniqueStrings(quotes).map(value => value.toUpperCase())) {
        if (decrement(this.quoteRefs, symbol)) removed.quotes.push(symbol);
      }
      for (const symbol of uniqueStrings(ticks).map(value => value.toUpperCase())) {
        if (decrement(this.tickRefs, symbol)) removed.ticks.push(symbol);
      }
      for (const item of candles || []) {
        const key = candleKey(item);
        if (key && decrement(this.candleRefs, key)) removed.candles.push(candleFromKey(key));
      }
      if (this.ready) this.sendSubscription('unsubscribe', removed);
    };
  }

  requestSnapshot(accountIds = null) {
    const params = accountIds ? { accounts: uniqueStrings(accountIds) } : {};
    return this.send({ action: 'snapshot', params });
  }

  requestStatus() {
    return this.send({ action: 'status' });
  }

  open() {
    if (this.intentionalClose || !this.token || this.socket || !navigator.onLine) {
      if (!navigator.onLine) this.emitStatus('offline');
      return;
    }

    this.emitStatus(this.retry > 0 ? 'reconnecting' : 'connecting');
    this.lastSequence = 0;
    const socket = new WebSocket(traderConfig.wsUrl, ['acg-trader', `auth.${this.token}`]);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (socket !== this.socket) return;
      this.emitStatus('connected');
    });

    socket.addEventListener('message', event => {
      if (socket !== this.socket) return;
      let envelope;
      try {
        envelope = JSON.parse(event.data);
      } catch {
        this.emitStatus('protocol-error', new Error('ACG Trader WebSocket returned invalid JSON'));
        return;
      }
      if (!envelope?.type) return;
      const sequence = Number(envelope.sequence);
      if (Number.isFinite(sequence)) {
        if (sequence <= this.lastSequence) return;
        this.lastSequence = sequence;
      }
      if (envelope.type === 'connection.ready') {
        this.ready = true;
        this.retry = 0;
        this.emitStatus('ready', null, envelope.data);
        this.resubscribeMarket();
      }
      this.onEnvelope?.(envelope);
    });

    socket.addEventListener('error', () => {
      if (socket === this.socket) this.emitStatus('error', new Error('ACG Trader WebSocket connection failed'));
    });

    socket.addEventListener('close', event => {
      if (socket !== this.socket) return;
      this.socket = null;
      this.ready = false;
      if (event.code === 4001) {
        this.intentionalClose = true;
        this.clearReconnect();
        const error = new Error(event.reason || 'Trading session expired');
        this.emitStatus('session-invalid', error);
        this.onSessionInvalid?.(error);
        return;
      }
      if (this.intentionalClose || !this.token) {
        this.emitStatus('disconnected');
        return;
      }
      this.scheduleReconnect();
    });
  }

  resubscribeMarket() {
    this.sendSubscription('subscribe', {
      quotes: [...this.quoteRefs.keys()],
      ticks: [...this.tickRefs.keys()],
      candles: [...this.candleRefs.keys()].map(candleFromKey),
    });
  }

  sendSubscription(action, params) {
    const hasItems = params.quotes?.length || params.ticks?.length || params.candles?.length;
    if (!hasItems) return false;
    return this.send({ action, params });
  }

  send(message) {
    if (!this.socket || this.socket.readyState !== OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.intentionalClose || !this.token) return;
    const base = Math.min(RECONNECT_MIN_MS * (2 ** this.retry), RECONNECT_MAX_MS);
    const delay = Math.round(base * (0.85 + Math.random() * 0.3));
    this.retry += 1;
    this.emitStatus('reconnecting');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  clearReconnect() {
    if (!this.reconnectTimer) return;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  closeSocket(code, reason) {
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    if (socket && socket.readyState < 2) socket.close(code, reason);
  }

  emitStatus(status, error = null, details = null) {
    this.onStatus?.({ status, error, details, at: Date.now() });
  }
}
