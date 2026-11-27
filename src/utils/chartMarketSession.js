// Calendar-only presentation of an instrument's actual published sessions.
// Never infer execution permission or real-time market-data entitlement from hours.
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const zonedFormatters = new Map();

function zoneName(instrument) {
  const requested = String(instrument?.timezone || 'UTC');
  try { new Intl.DateTimeFormat('en-US', { timeZone: requested }); return requested; }
  catch { return 'UTC'; }
}

function zonedParts(time, timeZone) {
  let formatter = zonedFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    zonedFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(time)).map(x => [x.type, x.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute) };
}

function dateKey(day) {
  return `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
}

function nextLocalDay(day, delta = 1) {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day + delta));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekday(day) {
  return new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
}

function toUtcMs(day, minute, timeZone) {
  const localTarget = Date.UTC(day.year, day.month - 1, day.day, Math.floor(minute / 60), minute % 60);
  let guess = localTarget;
  // Reconcile local civil time and UTC through DST without assuming a fixed offset.
  for (let n = 0; n < 5; n += 1) {
    const observed = zonedParts(guess, timeZone);
    const asUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
    const shift = localTarget - asUtc;
    if (shift === 0) return guess;
    guess += shift;
  }
  return guess;
}

function minutes(clock) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(clock || ''));
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function sessionsOnDate(instrument, day) {
  const key = dateKey(day);
  const override = (instrument?.sessionOverrides || []).find(item => item?.date === key);
  if (override) return override.closed ? [] : (Array.isArray(override.sessions) ? override.sessions : []);
  if ((instrument?.tradingHolidays || []).includes(key)) return [];
  return (instrument?.tradingSessions || []).filter(item =>
    Array.isArray(item?.days) && item.days.map(Number).includes(weekday(day)));
}

function buildWindows(instrument, now, timeZone) {
  const currentDay = zonedParts(now, timeZone);
  const windows = [];
  for (let dayOffset = -2; dayOffset < 12; dayOffset += 1) {
    const day = nextLocalDay(currentDay, dayOffset);
    for (const session of sessionsOnDate(instrument, day)) {
      const openMinute = minutes(session.open), closeMinute = minutes(session.close);
      if (openMinute == null || closeMinute == null) continue;
      const openAt = toUtcMs(day, openMinute, timeZone);
      const nextDay = openMinute > closeMinute || closeMinute === 1439;
      const closeAt = toUtcMs(nextDay ? nextLocalDay(day) : day,
        closeMinute === 1439 ? 0 : closeMinute, timeZone);
      if (closeAt > openAt) windows.push({ openAt, closeAt });
    }
  }
  return windows.sort((a, b) => a.openAt - b.openAt);
}

function explicitStatus(instrument) {
  const state = String(instrument?.marketState || '').toUpperCase();
  if (instrument?.status && instrument.status !== 'ACTIVE') return 'unavailable';
  if (['DISABLED', 'ERROR', 'DISCONNECTED', 'WAITING', 'SUBSCRIPTION_ERROR'].includes(state)) return 'unavailable';
  if (instrument?.sessionOpen === false || state === 'CLOSED') return 'closed';
  if (instrument?.sessionOpen === true || ['OPEN', 'LIVE'].includes(state)) return 'open';
  return null;
}

export function chartMarketSession(instrument, nowMs = Date.now()) {
  const now = Number(nowMs);
  const timeZone = zoneName(instrument);
  const assetClass = String(instrument?.assetClass || '').toUpperCase();
  if (!instrument || !Number.isFinite(now)) {
    return { status: 'unknown', timeZone, windows: [], nextAt: null, daySegments: [], isContinuous: false };
  }
  const sessions = Array.isArray(instrument.tradingSessions) ? instrument.tradingSessions : [];
  const continuous = assetClass === 'CRYPTO' && sessions.length === 0;
  const published = continuous || sessions.length > 0;
  const windows = sessions.length ? buildWindows(instrument, now, timeZone) : [];
  const active = windows.find(w => w.openAt <= now && now < w.closeAt) || null;
  const next = windows.find(w => w.openAt > now) || null;
  const statusFromFeed = explicitStatus(instrument);
  const calendarStatus = continuous || active ? 'open' : published ? 'closed' : 'unknown';
  const status = statusFromFeed || calendarStatus;
  const nextAt = status === 'open'
    ? (continuous ? null : active?.closeAt ?? null)
    : (status === 'closed' ? next?.openAt ?? null : null);

  const local = zonedParts(now, timeZone);
  const dayStart = toUtcMs(local, 0, timeZone);
  const nextDayStart = toUtcMs(nextLocalDay(local), 0, timeZone);
  const dayLength = Math.max(MINUTE_MS, nextDayStart - dayStart);
  const clamp = value => Math.max(0, Math.min(100, value));
  const daySegments = continuous ? [{ from: 0, width: 100 }] : windows
    .filter(w => w.closeAt > dayStart && w.openAt < nextDayStart)
    .map(w => ({
      from: clamp(((Math.max(w.openAt, dayStart) - dayStart) / dayLength) * 100),
      width: clamp(((Math.min(w.closeAt, nextDayStart) - Math.max(w.openAt, dayStart)) / dayLength) * 100),
    }));
  const position = clamp(((now - dayStart) / dayLength) * 100);

  return {
    status, timeZone, isContinuous: continuous,
    isCalendarStatus: !statusFromFeed,
    hasPublishedHours: published,
    active, nextAt, daySegments, position,
    todayWindows: windows.filter(w => w.closeAt > dayStart && w.openAt < nextDayStart),
    now,
  };
}

export function chartSessionDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'now';
  const minutesLeft = Math.ceil(ms / MINUTE_MS);
  const days = Math.floor(minutesLeft / 1440), hours = Math.floor((minutesLeft % 1440) / 60);
  const mins = minutesLeft % 60;
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', mins && !days ? `${mins}m` : ''].filter(Boolean).join(' ') || 'under 1m';
}

export function chartSessionClock(timeMs, timeZone) {
  if (!Number.isFinite(timeMs)) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(timeMs));
}
