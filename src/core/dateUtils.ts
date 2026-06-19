/* src/core/dateUtils.ts */

import { RRule } from 'rrule';
import type { CalendarEvent, DateRange } from '../types/calendar';

/** RRULE 문자열을 파싱해 범위 내 인스턴스를 생성 */
function expandRRule(event: CalendarEvent, range: DateRange, out: CalendarEvent[]): void {
  const dtstart = parseISO(event.start);
  // 인스턴스 지속시간(ms): duration(분) > end-start > 기본 60분
  const durationMs =
    event.duration != null
      ? event.duration * 60000
      : event.end
        ? parseISO(event.end).getTime() - dtstart.getTime()
        : 60 * 60000;

  let rule: RRule;
  try {
    const opts = RRule.parseString(event.rrule as string);
    opts.dtstart = dtstart;
    rule = new RRule(opts);
  } catch {
    return; // 잘못된 RRULE은 무시
  }

  // between은 [after, before] 경계를 포함하도록 inc=true
  const occurrences = rule.between(startOfDay(range.start), endOfDay(range.end), true);
  for (const occ of occurrences) {
    const start = new Date(occ);
    const end = new Date(start.getTime() + durationMs);
    const dateStr = start.toISOString().split('T')[0];
    if (event.exdates?.includes(dateStr)) continue; // 단일 인스턴스 편집으로 제외된 날
    out.push({
      ...event,
      id: `${event.id}_rrule_${dateStr}`,
      start,
      end,
      rrule: undefined,
      extendedProps: {
        ...event.extendedProps,
        isRecurrenceInstance: true,
        masterEventId: event.id,
        recurrenceDateStr: dateStr
      }
    });
  }
}

export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

export function parseISO(val: Date | string): Date {
  if (val instanceof Date) return cloneDate(val);
  const parsed = new Date(val);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid Date format: ${val}`);
  }
  return parsed;
}

export function startOfDay(date: Date): Date {
  const d = cloneDate(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = cloneDate(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = cloneDate(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfWeek(date: Date, firstDayOfWeek = 0): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  // Adjust based on first day of week
  const diff = (day < firstDayOfWeek ? 7 : 0) + day - firstDayOfWeek;
  d.setDate(d.getDate() - diff);
  return d;
}

export function endOfWeek(date: Date, firstDayOfWeek = 0): Date {
  const d = startOfWeek(date, firstDayOfWeek);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

export function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function endOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return endOfDay(d);
}

export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0] || '0', 10),
    minutes: parseInt(parts[1] || '0', 10),
  };
}

/**
 * Highly performant browser Intl formatting helper.
 */
export function formatDate(date: Date, options: Intl.DateTimeFormatOptions, locale = 'default'): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Expand both normal and recurring events for the active view date range.
 */
export function expandEvents(events: CalendarEvent[], range: DateRange): CalendarEvent[] {
  const expandedList: CalendarEvent[] = [];
  const rangeStartOfDay = startOfDay(range.start);
  const rangeEndOfDay = endOfDay(range.end);

  events.forEach((event) => {
    // 0. RRULE 표준 반복
    if (event.rrule) {
      expandRRule(event, range, expandedList);
      return;
    }
    // 1. Recurring Event Check
    if (event.daysOfWeek && event.daysOfWeek.length > 0) {
      const eventStartRecur = event.startRecur ? startOfDay(parseISO(event.startRecur)) : null;
      const eventEndRecur = event.endRecur ? endOfDay(parseISO(event.endRecur)) : null;
      
      const searchStart = eventStartRecur && eventStartRecur > rangeStartOfDay ? eventStartRecur : rangeStartOfDay;
      const searchEnd = eventEndRecur && eventEndRecur < rangeEndOfDay ? eventEndRecur : rangeEndOfDay;

      if (searchStart > searchEnd) return;

      // Scan every day in this window
      let current = cloneDate(searchStart);
      while (current <= searchEnd) {
        const currentDayOfWeek = current.getDay();
        if (event.daysOfWeek.includes(currentDayOfWeek)) {
          // Construct start & end times
          const startInstance = cloneDate(current);
          const endInstance = cloneDate(current);

          if (event.startTime) {
            const { hours, minutes } = parseTimeString(event.startTime);
            startInstance.setHours(hours, minutes, 0, 0);
          } else {
            startInstance.setHours(0, 0, 0, 0);
          }

          if (event.endTime) {
            const { hours, minutes } = parseTimeString(event.endTime);
            endInstance.setHours(hours, minutes, 0, 0);
          } else {
            // Default 1 hour if start/end times missing
            endInstance.setTime(startInstance.getTime() + 60 * 60 * 1000);
          }

          const formattedDateStr = startInstance.toISOString().split('T')[0];
          if (event.exdates?.includes(formattedDateStr)) {
            current = addDays(current, 1);
            continue; // 단일 인스턴스 편집으로 제외된 날
          }

          expandedList.push({
            ...event,
            id: `${event.id}_recur_${formattedDateStr}`,
            start: startInstance,
            end: endInstance,
            extendedProps: {
              ...event.extendedProps,
              isRecurrenceInstance: true,
              masterEventId: event.id,
              recurrenceDateStr: formattedDateStr
            }
          });
        }
        current = addDays(current, 1);
      }
    } else {
      // 2. Normal (Non-recurring) Event Check
      const start = parseISO(event.start);
      const end = event.end ? parseISO(event.end) : new Date(start.getTime() + 60 * 60 * 1000); // 1hr default

      // Check overlap with active date range
      // Overlap formula: (startA <= endB) && (endA >= startB)
      if (start <= rangeEndOfDay && end >= rangeStartOfDay) {
        expandedList.push({
          ...event,
          start,
          end
        });
      }
    }
  });

  return expandedList;
}

/**
 * Returns date segments within a range for multi-day grid drawing.
 */
export function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let curr = startOfDay(start);
  const finish = startOfDay(end);
  while (curr <= finish) {
    days.push(cloneDate(curr));
    curr = addDays(curr, 1);
  }
  return days;
}
