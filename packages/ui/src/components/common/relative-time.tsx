import { useMemo } from 'react';

interface RelativeTimeProps {
  date: Date;
  className?: string;
  locale?: 'vi' | 'en';
}

function resolveDefaultLocale(explicit?: 'vi' | 'en'): 'vi' | 'en' {
  if (explicit) return explicit;
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage?.getItem('p2p_language');
      if (stored && stored.startsWith('vi')) return 'vi';
    }
  } catch {
    // ignore storage errors
  }
  return 'en';
}

const VI_UNIT_LABELS: Record<string, string> = {
  minute: 'phút',
  hour: 'giờ',
  week: 'tuần',
  month: 'tháng',
  year: 'năm',
};

export default function RelativeTime({ date, className = '', locale }: RelativeTimeProps) {
  const resolvedLocale = resolveDefaultLocale(locale);
  const isVi = resolvedLocale === 'vi';

  const relativeText = useMemo(() => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const absDiffMs = Math.abs(diffMs);
    const isPast = diffMs < 0;

    // Calculate the difference in minutes, hours, days, weeks, months, and years
    const minutes = Math.floor(absDiffMs / (1000 * 60));
    const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    // Format the value and unit correctly
    const format = (value: number, unit: string) => {
      if (isVi) {
        const viUnit = VI_UNIT_LABELS[unit] ?? unit;
        return isPast ? `${value} ${viUnit} trước` : `Sau ${value} ${viUnit}`;
      }
      const label = value === 1 ? unit : `${unit}s`;
      return isPast ? `${value} ${label} ago` : `In ${value} ${label}`;
    };

    // Format the time correctly
    const formatTime = (d: Date) =>
      d.toLocaleTimeString(isVi ? 'vi-VN' : 'en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: !isVi,
      });

    // Format the day name correctly
    const dayName = (d: Date) => d.toLocaleDateString(isVi ? 'vi-VN' : 'en-US', { weekday: 'long' });

    // < 1 minute = Just now / In a moment
    if (minutes < 1) {
      if (isVi) return isPast ? 'Vừa xong' : 'Trong giây lát';
      return isPast ? 'Just now' : 'In a moment';
    }

    // Minutes
    if (minutes < 60) {
      return format(minutes, 'minute');
    }

    // Hours
    if (hours < 24) {
      return format(hours, 'hour');
    }

    // Yesterday / Tomorrow
    if (days === 1) {
      if (isVi) {
        return isPast ? `Hôm qua lúc ${formatTime(date)}` : `Ngày mai lúc ${formatTime(date)}`;
      }
      return isPast ? `Yesterday at ${formatTime(date)}` : `Tomorrow at ${formatTime(date)}`;
    }

    // This / Last week (2–6 days)
    if (days < 7) {
      if (isVi) {
        return isPast
          ? `${dayName(date)} trước lúc ${formatTime(date)}`
          : `${dayName(date)} này lúc ${formatTime(date)}`;
      }
      const label = isPast ? 'Last' : 'This';
      return `${label} ${dayName(date)} at ${formatTime(date)}`;
    }

    // Next / Last week (7–13 days)
    if (days < 14) {
      if (isVi) {
        return isPast
          ? `${dayName(date)} tuần trước lúc ${formatTime(date)}`
          : `${dayName(date)} tuần tới lúc ${formatTime(date)}`;
      }
      const label = isPast ? 'Last' : 'Next';
      return `${label} ${dayName(date)} at ${formatTime(date)}`;
    }

    // Weeks (2–3)
    if (weeks < 4) {
      return format(weeks, 'week');
    }

    // 4 weeks (28–31 days)
    if (days >= 28 && days <= 31) {
      return format(4, 'week');
    }

    // Months
    if (months >= 1 && months < 12) {
      return format(months, 'month');
    }

    // Years
    if (years >= 1) {
      return format(years, 'year');
    }

    // Fallback: show absolute date if no relative rule matched
    return date.toLocaleString(isVi ? 'vi-VN' : undefined);
  }, [date, isVi]);

  return (
    <span className={`${className}`} title={date.toLocaleString(isVi ? 'vi-VN' : undefined)}>
      {relativeText}
    </span>
  );
}
