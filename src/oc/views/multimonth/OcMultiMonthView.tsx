/* src/oc/views/multimonth/OcMultiMonthView.tsx
 * multiMonthYear 뷰 — 1년치 미니 월간 12개를 반응형 격자로 표시.
 * 각 미니 월은 daygrid처럼 주(week)별 스패닝 이벤트 막대 + "+N" 오버플로로 렌더.
 */

import { useMemo } from 'react';
import { useOc } from '../../core/store';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  getDaysInRange,
  isSameDay,
  addDays,
  formatDate
} from '../../../core/dateUtils';
import type { CalendarEvent } from '../../../types/calendar';
import { buildWeekSegs, isBackgroundEvent } from '../../core/daygridSeg';

const MINI_CAPACITY = 2; // 주당 표시할 최대 이벤트 줄 수 (초과분은 +N)

interface OcMultiMonthViewProps {
  locale: string;
  events: CalendarEvent[];
}

export function OcMultiMonthView({ locale, events }: OcMultiMonthViewProps) {
  const { state, dispatch, options } = useOc();
  const year = state.currentDate.getFullYear();

  // 막대 대상 전경 이벤트만 (배경 이벤트 제외)
  const fgEvents = useMemo(() => events.filter((e) => !isBackgroundEvent(e)), [events]);

  // 요일 헤더 라벨 (firstDay 기준)
  const weekdayLabels = useMemo(() => {
    const ws = startOfWeek(new Date(), options.firstDay);
    return Array.from({ length: 7 }, (_, i) => formatDate(addDays(ws, i), { weekday: 'narrow' }, locale));
  }, [locale, options.firstDay]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, m) => new Date(year, m, 1)), [year]);

  const goToDay = (day: Date) => {
    dispatch({ type: 'SET_DATE', payload: day });
    dispatch({ type: 'SET_VIEW', payload: 'timeGridDay' });
  };

  return (
    <div className="oc-view oc-multimonth-view">
      <div className="oc-multimonth-scroller">
        <div className="oc-multimonth-grid-wrap">
          {months.map((monthStart) => {
            const gridStart = startOfWeek(startOfMonth(monthStart), options.firstDay);
            const gridEnd = endOfWeek(endOfMonth(monthStart), options.firstDay);
            const days = getDaysInRange(gridStart, gridEnd);
            // 주(7일) 단위로 분할
            const weeks: Date[][] = [];
            for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
            return (
              <div className="oc-multimonth-month" key={monthStart.getMonth()}>
                <div className="oc-multimonth-title">
                  {formatDate(monthStart, { month: 'long' }, locale)}
                </div>
                <div className="oc-multimonth-weekdays">
                  {weekdayLabels.map((wd, i) => (
                    <div key={i} className="oc-multimonth-weekday">
                      {wd}
                    </div>
                  ))}
                </div>
                <div className="oc-multimonth-weeks">
                  {weeks.map((week, wi) => {
                    const segs = buildWeekSegs(fgEvents, week);
                    const visible = segs.filter((s) => s.level < MINI_CAPACITY);
                    const hiddenByCol = new Array(7).fill(0) as number[];
                    for (const s of segs) {
                      if (s.level >= MINI_CAPACITY) {
                        for (let c = s.startCol; c <= s.endCol; c++) hiddenByCol[c]++;
                      }
                    }
                    return (
                      <div className="oc-multimonth-week" key={wi}>
                        {/* 날짜 숫자 셀 */}
                        <div className="oc-multimonth-week-bg">
                          {week.map((day) => {
                            const isOther = day.getMonth() !== monthStart.getMonth();
                            const today = isSameDay(day, new Date());
                            return (
                              <button
                                type="button"
                                key={day.toISOString()}
                                className={`oc-multimonth-day${today ? ' oc-day-today' : ''}${isOther ? ' oc-day-other' : ''}`}
                                onClick={() => goToDay(day)}
                              >
                                <span className="oc-multimonth-daynum">{day.getDate()}</span>
                              </button>
                            );
                          })}
                        </div>
                        {/* 스패닝 이벤트 막대 오버레이 */}
                        <div className="oc-multimonth-week-events">
                          {visible.map((seg) => {
                            const color = seg.evt.color || 'var(--oc-event-bg-color)';
                            return (
                              <div
                                key={seg.evt.id}
                                className="oc-multimonth-event"
                                style={{
                                  gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
                                  gridRow: seg.level + 1,
                                  backgroundColor: color,
                                  borderTopLeftRadius: seg.isStart ? 2 : 0,
                                  borderBottomLeftRadius: seg.isStart ? 2 : 0,
                                  borderTopRightRadius: seg.isEnd ? 2 : 0,
                                  borderBottomRightRadius: seg.isEnd ? 2 : 0
                                }}
                                title={seg.evt.title}
                                onClick={() => goToDay(new Date(seg.evt.start))}
                              >
                                {seg.isStart ? seg.evt.title : ' '}
                              </div>
                            );
                          })}
                          {hiddenByCol.map((n, c) =>
                            n > 0 ? (
                              <div
                                key={`more-${c}`}
                                className="oc-multimonth-more"
                                style={{ gridColumn: `${c + 1}`, gridRow: MINI_CAPACITY + 1 }}
                                onClick={() => goToDay(week[c])}
                              >
                                +{n}
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
