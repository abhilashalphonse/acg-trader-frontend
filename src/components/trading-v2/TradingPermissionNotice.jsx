import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ShieldCheck } from 'lucide-react';

function timeLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function countdown(target, now) {
  const targetMs = new Date(target || '').getTime();
  if (!Number.isFinite(targetMs)) return null;
  const delta = targetMs - now;
  if (delta <= 0) return 'now';
  const totalSeconds = Math.max(0, Math.ceil(delta / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function noticeFor(status, now) {
  if (!status?.permissions) return null;
  const permissions = status.permissions;
  const news = status.news || {};
  const weekend = status.weekend || {};
  const enforcement = status.enforcement || {};

  if (permissions.newsTrading === false && news.active && news.event && !(weekend.active && enforcement.weekendEnabled && !enforcement.newsEnabled)) {
    return {
      priority: 100,
      tone: enforcement.newsEnabled ? 'danger' : 'warning',
      icon: CalendarClock,
      title: `${news.event.currency || ''} high-impact news window`.trim(),
      message: enforcement.newsEnabled
        ? `New ${status.symbol || 'instrument'} exposure is temporarily unavailable until ${timeLabel(news.blockedUntil)}. Existing positions may remain open; closing or reducing is always available.`
        : `Monitoring only: this account's News Trading setting would restrict new ${status.symbol || 'instrument'} exposure once enforcement is active. Existing positions may remain open.`,
      detail: news.event.title || 'High-impact economic event',
    };
  }

  if (permissions.weekendHolding === false && weekend.active) {
    return {
      priority: 90,
      tone: enforcement.weekendEnabled ? 'danger' : 'warning',
      icon: AlertTriangle,
      title: 'Weekend holding cutoff',
      message: enforcement.weekendEnabled
        ? `This account does not include Weekend Holding. Open ${status.symbol || 'instrument'} positions are scheduled for protective closure before the market shuts at ${timeLabel(weekend.marketCloseAt)}.`
        : `Monitoring only: this account's Weekend Holding setting would apply a protective cutoff at ${timeLabel(weekend.autoCloseAt)} once enforcement is active.`,
      detail: 'Protective weekend closure is not an account breach.',
    };
  }

  if (permissions.newsTrading === false && news.next?.blockedFrom) {
    const startsMs = new Date(news.next.blockedFrom).getTime();
    const delta = startsMs - now;
    if (Number.isFinite(delta) && delta > 0 && delta <= 15 * 60 * 1000) {
      return {
        priority: 70,
        tone: 'info',
        icon: CalendarClock,
        title: `${news.next.currency || ''} high-impact news in ${countdown(news.next.timestamp, now) || 'soon'}`.trim(),
        message: enforcement.newsEnabled
          ? `The ${status.symbol || 'instrument'} restriction window starts in ${countdown(news.next.blockedFrom, now)} at ${timeLabel(news.next.blockedFrom)}.`
          : `Monitoring only: the configured news window starts at ${timeLabel(news.next.blockedFrom)}. Automated news restrictions are not active.`,
        detail: `${news.next.title || 'High-impact event'} · Existing positions may remain open.`,
      };
    }
  }

  if (permissions.weekendHolding === false && weekend.warning && weekend.autoCloseAt) {
    return {
      priority: 60,
      tone: 'info',
      icon: AlertTriangle,
      title: `Weekend cutoff in ${countdown(weekend.autoCloseAt, now) || 'soon'}`,
      message: enforcement.weekendEnabled
        ? `Protective closure of ${status.symbol || 'instrument'} positions begins at ${timeLabel(weekend.autoCloseAt)}. The target to be flat is ${timeLabel(weekend.requiredFlatAt)}.`
        : 'Monitoring only: automatic weekend closure is not active for this account.',
      detail: `Cutoff ${timeLabel(weekend.autoCloseAt)} · Market close ${timeLabel(weekend.marketCloseAt)}`,
    };
  }

  if (permissions.newsTrading === false && ['STALE', 'UNAVAILABLE', 'EXPIRED'].includes(String(news.dataStatus || '').toUpperCase())) {
    return {
      priority: 30,
      tone: 'neutral',
      icon: ShieldCheck,
      title: 'Economic calendar verification unavailable',
      message: enforcement.newsEnabled
        ? 'New exposure is paused until the calendar is verified. Existing positions may still be closed or reduced.'
        : 'Monitoring only: automated news restrictions are not active. Calendar timing is currently unverified.',
      detail: 'The dashboard calendar may still show cached events for planning.',
    };
  }

  return null;
}

const TONES = {
  danger: 'border-rose-500/30 bg-[#180b0e]/96 text-rose-100',
  warning: 'border-amber-500/25 bg-[#171208]/96 text-amber-100',
  info: 'border-sky-500/20 bg-[#07131a]/96 text-sky-100',
  neutral: 'border-white/[0.10] bg-[#0b0b0b]/96 text-[#d7e0e7]',
};

export default function TradingPermissionNotice({ status }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const notice = useMemo(() => noticeFor(status, now), [status, now]);
  if (!notice) return null;
  const Icon = notice.icon;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[64px] z-[190] w-[calc(100%-16px)] max-w-[560px] -translate-x-1/2 px-1">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-[0_14px_38px_rgba(0,0,0,.38)] backdrop-blur-xl ${TONES[notice.tone] || TONES.neutral}`}
      >
        <span className="mt-0.5 shrink-0"><Icon size={14} /></span>
        <div className="min-w-0">
          <strong className="block text-[10px] font-black tracking-[-0.01em]">{notice.title}</strong>
          <p className="mt-0.5 text-[8px] font-medium leading-relaxed opacity-85">{notice.message}</p>
          {notice.detail && <p className="mt-1 text-[7px] leading-relaxed opacity-55">{notice.detail}</p>}
        </div>
      </div>
    </div>
  );
}

export { noticeFor, countdown };
