/* src/oc/views/list/OcListView.tsx
 * list 뷰 + 가상화(고정 행 높이).
 */

import { useMemo, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { DateProfile } from '../../core/dateProfile';
import { useVirtual } from '../../core/useVirtual';
import { getDaysInRange, formatDate } from '../../../core/dateUtils';
import type { CalendarEvent } from '../../../types/calendar';
import { useOc } from '../../core/store';
import { getLocale } from '../../core/locales';
import { isBackgroundEvent } from '../../core/daygridSeg';

const ROW_HEIGHT = 41;

function fmtTime(d: Date, locale: string): string {
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function eventTimeText(evt: CalendarEvent, locale: string, allDayLabel: string): string {
  if (evt.allDay) return allDayLabel;
  const s = new Date(evt.start);
  const e = evt.end ? new Date(evt.end) : null;
  return e ? `${fmtTime(s, locale)} - ${fmtTime(e, locale)}` : fmtTime(s, locale);
}

type Row =
  | { kind: 'day'; day: Date }
  | { kind: 'event'; evt: CalendarEvent };

interface OcListViewProps {
  dateProfile: DateProfile;
  locale: string;
  events: CalendarEvent[];
  onEventClick?: (evt: CalendarEvent, jsEvent: ReactMouseEvent) => void;
}

export function OcListView({ dateProfile, locale, events, onEventClick }: OcListViewProps) {
  const { state, options } = useOc();
  const t = getLocale(state.locale);
  const { activeRange } = dateProfile;
  const scrollRef = useRef<HTMLDivElement>(null);

  // 날짜 그룹 → 평탄화된 행 배열 (가상화용)
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let days = getDaysInRange(activeRange.start, activeRange.end);
    if (!options.weekends) days = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    for (const day of days) {
      const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
      const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
      const list = events
        .filter((evt) => {
          if (isBackgroundEvent(evt)) return false; // 배경 이벤트는 목록에서 제외
          const s = new Date(evt.start);
          const e = evt.end ? new Date(evt.end) : s;
          return s <= de && e >= ds;
        })
        .sort((a, b) => {
          if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
          return new Date(a.start).getTime() - new Date(b.start).getTime();
        });
      if (list.length) {
        out.push({ kind: 'day', day });
        for (const evt of list) out.push({ kind: 'event', evt });
      }
    }
    return out;
  }, [activeRange, events, options.weekends]);

  const { start, end, paddingTop, totalHeight } = useVirtual(scrollRef, rows.length, ROW_HEIGHT);
  const slice = rows.slice(start, end);

  return (
    <div className="oc-view oc-list-view">
      <div className="oc-scroller" ref={scrollRef}>
        {rows.length === 0 ? (
          <div className="oc-list-empty">{t.noEvents}</div>
        ) : (
          <div className="oc-list" style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${paddingTop}px)` }}>
              {slice.map((row, i) => {
                if (row.kind === 'day') {
                  return (
                    <div className="oc-list-day" key={`d-${start + i}`} style={{ height: ROW_HEIGHT }}>
                      <span className="oc-list-day-text">
                        {formatDate(row.day, { month: 'long', day: 'numeric', weekday: 'long' }, locale)}
                      </span>
                    </div>
                  );
                }
                const evt = row.evt;
                const color = evt.color || 'var(--oc-event-bg-color)';
                return (
                  <div
                    className="oc-list-event"
                    key={`${evt.id}-${start + i}`}
                    title={evt.title}
                    style={{ height: ROW_HEIGHT }}
                    onClick={(e) => onEventClick?.(evt, e)}
                  >
                    <div className="oc-list-event-time">{eventTimeText(evt, locale, t.allDay)}</div>
                    <div className="oc-list-event-graphic">
                      <span className="oc-list-event-dot" style={{ borderColor: color }} />
                    </div>
                    <div className="oc-list-event-title">{evt.title}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
