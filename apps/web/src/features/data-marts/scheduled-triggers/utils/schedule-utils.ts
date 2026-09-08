import { cronToScheduleConfig } from '../components/ScheduleConfig/cron-parser';
import i18n from '../../../../i18n';

export interface ScheduleConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'interval' | 'custom';
  time: string;
  weekdays: number[];
  monthDays: number[];
  customCron: string;
  intervalType: 'minutes' | 'hours';
  intervalValue: number;
  timezone: string;
}

export const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
];

export const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

export function getScheduleDescription(config: ScheduleConfig, isEnabled: boolean): string {
  const t = i18n.t.bind(i18n);
  if (!isEnabled) return t('scheduleDescription.disabled', 'Schedule is disabled');

  const timeStr = config.time;

  switch (config.type) {
    case 'daily':
      return t('scheduleDescription.daily', 'Daily at {{time}}', { time: timeStr });
    case 'weekly': {
      const selectedDays = config.weekdays
        .map(day =>
          t(
            `scheduleConfig.weekday${day}`,
            WEEKDAYS.find(w => w.value === day)?.label ?? String(day)
          )
        )
        .join(', ');
      return t('scheduleDescription.weekly', 'Weekly on {{days}} at {{time}}', {
        days: selectedDays,
        time: timeStr,
      });
    }
    case 'monthly': {
      const sortedDays = [...config.monthDays].sort((a, b) => a - b);
      const dayStrings = sortedDays.map(day => {
        if (day === 1) return t('scheduleDescription.ordinal1', '1st');
        if (day === 2) return t('scheduleDescription.ordinal2', '2nd');
        if (day === 3) return t('scheduleDescription.ordinal3', '3rd');
        return t('scheduleDescription.ordinalOther', '{{day}}th', { day });
      });
      const daysText =
        dayStrings.length === 1
          ? dayStrings[0]
          : dayStrings.length === 2
            ? `${dayStrings[0]} ${t('scheduleDescription.and', 'and')} ${dayStrings[1]}`
            : `${dayStrings.slice(0, -1).join(', ')}, ${t('scheduleDescription.and', 'and')} ${dayStrings[dayStrings.length - 1]}`;
      return t('scheduleDescription.monthly', 'Monthly on the {{days}} at {{time}}', {
        days: daysText,
        time: timeStr,
      });
    }
    case 'interval':
      return config.intervalType === 'minutes'
        ? t('scheduleDescription.everyMinutes', 'Every {{count}} minute{{suffix}}', {
            count: config.intervalValue,
            suffix: config.intervalValue !== 1 ? 's' : '',
          })
        : t('scheduleDescription.everyHours', 'Every {{count}} hour{{suffix}}', {
            count: config.intervalValue,
            suffix: config.intervalValue !== 1 ? 's' : '',
          });
    case 'custom':
      return t('scheduleDescription.custom', 'Custom schedule');
    default:
      return '';
  }
}

export function parseScheduleFromCron(
  cronExpression: string,
  timeZone: string,
  isEnabled = true
): string {
  const config = cronToScheduleConfig(cronExpression, timeZone);
  return getScheduleDescription(config, isEnabled);
}
