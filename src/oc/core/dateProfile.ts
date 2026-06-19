/* src/oc/core/dateProfile.ts
 * 현재 뷰의 표시 범위/활성 범위 계산.
 */

import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  getDaysInRange
} from '../../core/dateUtils';
import type { CalendarViewType, DateRange } from '../../types/calendar';

export interface DateProfile {
  /** 사용자가 의도한 활성 범위 (예: 6월 1~30일) */
  activeRange: DateRange;
  /** 화면에 실제로 그려지는 범위 (예: 6주 그리드 = 5/31~7/4) */
  renderRange: DateRange;
  /** renderRange를 일 단위로 펼친 배열 */
  days: Date[];
  /** 주(행) 개수 — daygrid용 */
  rowCount: number;
  /** 한 행의 일 수 (7 또는 단일) */
  colCount: number;
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

export function buildDateProfile(
  view: CalendarViewType,
  currentDate: Date,
  firstDay = 0,
  weekends = true
): DateProfile {
  const applyWeekends = (arr: Date[]) => (weekends ? arr : arr.filter((d) => !isWeekend(d)));

  if (view === 'dayGridMonth' || view === 'listMonth') {
    const activeStart = startOfMonth(currentDate);
    const activeEnd = endOfMonth(currentDate);
    const renderStart = startOfWeek(activeStart, firstDay);
    // 월 그리드는 항상 6주(42일) 고정 — 달마다 행 수가 바뀌지 않게
    const renderEnd =
      view === 'dayGridMonth' ? endOfDay(addDays(renderStart, 6 * 7 - 1)) : endOfWeek(activeEnd, firstDay);
    const days = applyWeekends(getDaysInRange(renderStart, renderEnd));
    const colCount = weekends ? 7 : 5;
    return {
      activeRange: { start: activeStart, end: activeEnd },
      renderRange: { start: renderStart, end: renderEnd },
      days,
      rowCount: Math.max(1, Math.ceil(days.length / colCount)),
      colCount
    };
  }

  if (
    view === 'timeGridWeek' ||
    view === 'dayGridWeek' ||
    view === 'listWeek' ||
    view === 'resourceTimeGridWeek' ||
    view === 'resourceTimelineWeek'
  ) {
    const renderStart = startOfWeek(currentDate, firstDay);
    const renderEnd = endOfWeek(currentDate, firstDay);
    const days = applyWeekends(getDaysInRange(renderStart, renderEnd));
    return {
      activeRange: { start: renderStart, end: renderEnd },
      renderRange: { start: renderStart, end: renderEnd },
      days,
      rowCount: 1,
      colCount: days.length
    };
  }

  if (view === 'multiMonthYear') {
    const y = currentDate.getFullYear();
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    return {
      activeRange: { start, end },
      renderRange: { start, end },
      days: [],
      rowCount: 1,
      colCount: 1
    };
  }

  // day-scoped views
  const start = startOfDay(currentDate);
  const end = addDays(start, 1);
  return {
    activeRange: { start, end },
    renderRange: { start, end },
    days: [start],
    rowCount: 1,
    colCount: 1
  };
}

/** 이전/다음 이동 시 새 기준 날짜 계산 */
export function navigateDate(view: CalendarViewType, currentDate: Date, dir: -1 | 1): Date {
  if (view === 'multiMonthYear') {
    return new Date(currentDate.getFullYear() + dir, currentDate.getMonth(), 1);
  }
  if (view === 'dayGridMonth' || view === 'listMonth') {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
  }
  if (view.includes('Week')) {
    return addDays(currentDate, 7 * dir);
  }
  return addDays(currentDate, dir);
}
