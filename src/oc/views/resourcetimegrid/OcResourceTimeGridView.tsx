/* src/oc/views/resourcetimegrid/OcResourceTimeGridView.tsx
 * resourceTimeGridDay 뷰 — 세로 시간축 + 리소스별 컬럼.
 * TimeGrid 구조/CSS(oc-timegrid-*)를 재사용한다. (드래그/리사이즈는 추후)
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useOc } from '../../core/store';
import { getLocale } from '../../core/locales';
import { isBackgroundEvent, isAllDayEvent } from '../../core/daygridSeg';
import type { CalendarEvent } from '../../../types/calendar';

const SLOT_HEIGHT = 48;
const AXIS_WIDTH = 64;

interface Placed {
  evt: CalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
}

/** 하루치 시간 이벤트를 겹침 클러스터 → 열 배치 */
function layoutDay(evts: CalendarEvent[], day: Date, startHour: number, endHour: number): Placed[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0).getTime();
  const minsOf = (t: number) => (t - dayStart) / 60000;
  const items = evts
    .map((evt) => {
      const s = new Date(evt.start).getTime();
      const e = evt.end ? new Date(evt.end).getTime() : s + 30 * 60000;
      return { evt, start: Math.max(s, dayStart), end: e };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const placed: Placed[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const colOf = new Map<number, number>();
    cluster.forEach((it, i) => {
      let c = colEnds.findIndex((end) => end <= it.start);
      if (c === -1) {
        c = colEnds.length;
        colEnds.push(it.end);
      } else colEnds[c] = it.end;
      colOf.set(i, c);
    });
    const cols = colEnds.length;
    cluster.forEach((it, i) => {
      const startMin = Math.max(0, minsOf(it.start));
      const endMin = Math.min((endHour - startHour) * 60, minsOf(it.end));
      placed.push({
        evt: it.evt,
        top: (startMin / 60) * SLOT_HEIGHT,
        height: Math.max(18, ((endMin - startMin) / 60) * SLOT_HEIGHT),
        widthPct: 100 / cols,
        leftPct: (colOf.get(i)! / cols) * 100
      });
    });
    cluster = [];
    clusterEnd = -Infinity;
  };
  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return placed;
}

interface Props {
  locale: string;
  events: CalendarEvent[];
  onEventClick?: (evt: CalendarEvent, jsEvent: ReactMouseEvent) => void;
  onSelectRange?: (range: { start: Date; end: Date }, resourceId?: string) => void;
}

export function OcResourceTimeGridView({ locale, events, onEventClick, onSelectRange }: Props) {
  const { state, options } = useOc();
  const t = getLocale(locale);
  const { resources, currentDate } = state;

  const startHour = options.slotMinTime;
  const endHour = options.slotMaxTime;
  const day = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  const [now, setNow] = useState(() => new Date());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = Math.max(0, (options.scrollTime - startHour) * SLOT_HEIGHT);
  }, [options.scrollTime, startHour]);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  // 리소스별 종일/시간/배경 이벤트 (해당 날짜)
  const byResource = useMemo(() => {
    const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const inDay = events.filter((evt) => {
      const s = new Date(evt.start);
      const e = evt.end ? new Date(evt.end) : s;
      return s <= de && e >= ds;
    });
    const map = new Map<string, { allday: CalendarEvent[]; timed: CalendarEvent[]; bg: CalendarEvent[] }>();
    for (const r of resources) {
      const mine = inDay.filter((e) => e.resourceId === r.id && !isBackgroundEvent(e));
      // 배경 이벤트: resourceId가 일치하거나 없는(=전체 적용) 것.
      // background는 해당 날 겹칠 때만, inverse-background는 항상(겹치지 않으면 종일 음영).
      const bg = events.filter((e) => {
        if (!isBackgroundEvent(e)) return false;
        if (e.resourceId && e.resourceId !== r.id) return false;
        if (e.display === 'inverse-background') return true;
        const s = new Date(e.start);
        const en = e.end ? new Date(e.end) : s;
        return s <= de && en >= ds;
      });
      map.set(r.id, { allday: mine.filter(isAllDayEvent), timed: mine.filter((e) => !isAllDayEvent(e)), bg });
    }
    return map;
  }, [events, resources, day]);

  const totalHeight = (endHour - startHour) * SLOT_HEIGHT;
  const today = now.getFullYear() === day.getFullYear() && now.getMonth() === day.getMonth() && now.getDate() === day.getDate();
  const nowMins = now.getHours() * 60 + now.getMinutes() - startHour * 60;
  const nowTop = today && nowMins >= 0 && nowMins <= (endHour - startHour) * 60 ? (nowMins / 60) * SLOT_HEIGHT : null;
  const hasAllday = resources.some((r) => (byResource.get(r.id)?.allday.length || 0) > 0);

  const handleColClick = (e: ReactMouseEvent, resId: string) => {
    const colEvents = e.currentTarget.querySelector('.oc-timegrid-col-events');
    const rect = (colEvents || e.currentTarget).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const mins = Math.max(0, Math.round(((relY / SLOT_HEIGHT) * 60) / options.slotDuration) * options.slotDuration);
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0);
    start.setMinutes(start.getMinutes() + mins);
    const end = new Date(start.getTime() + 60 * 60000);
    onSelectRange?.({ start, end }, resId);
  };

  if (resources.length === 0) {
    return (
      <div className="oc-view oc-timegrid-view">
        <div className="oc-list-empty">{t.noEvents}</div>
      </div>
    );
  }

  return (
    <div className="oc-view oc-timegrid-view">
      <div className="oc-scrollgrid">
        {/* Header: 축 + 리소스 컬럼 */}
        <div className="oc-scrollgrid-section-header" style={{ paddingRight: scrollbarWidth }}>
          <div className="oc-timegrid-header">
            <div className="oc-timegrid-axis" style={{ width: AXIS_WIDTH }} />
            <div className="oc-timegrid-header-cols">
              {resources.map((r) => (
                <div key={r.id} className="oc-timegrid-col-header">
                  <div className="oc-col-header-cell-cushion">{r.title}</div>
                </div>
              ))}
            </div>
          </div>
          {hasAllday && (
            <div className="oc-timegrid-allday">
              <div className="oc-timegrid-axis" style={{ width: AXIS_WIDTH }}>
                <span className="oc-timegrid-axis-cushion">{t.allDay}</span>
              </div>
              <div className="oc-timegrid-allday-cols">
                {resources.map((r) => (
                  <div key={r.id} className="oc-timegrid-allday-col">
                    {(byResource.get(r.id)?.allday || []).map((evt) => {
                      const color = evt.color || 'var(--oc-event-bg-color)';
                      return (
                        <div
                          key={evt.id}
                          className="oc-event oc-daygrid-event oc-daygrid-block-event"
                          onClick={(e) => onEventClick?.(evt, e)}
                          style={{ backgroundColor: color, borderColor: color }}
                          title={evt.title}
                        >
                          <span className="oc-event-title">{evt.title}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Body: 축 + 리소스 컬럼 */}
        <div className="oc-scrollgrid-section-body">
          <div className="oc-scroller-harness">
            <div className="oc-scroller" ref={scrollerRef}>
              <div className="oc-timegrid-body" style={{ height: totalHeight }}>
                <div className="oc-timegrid-axis-col" style={{ width: AXIS_WIDTH }}>
                  {hours.map((h) => (
                    <div key={h} className="oc-timegrid-slot-label" style={{ height: SLOT_HEIGHT }}>
                      <span className="oc-timegrid-slot-label-cushion">
                        {h === startHour ? '' : options.slotLabelFormat(h)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="oc-timegrid-cols">
                  {resources.map((r) => {
                    const placed = layoutDay(byResource.get(r.id)?.timed || [], day, startHour, endHour);
                    return (
                      <div
                        key={r.id}
                        className="oc-timegrid-col"
                        onPointerDown={(e) => {
                          if ((e.target as HTMLElement).closest('.oc-event')) return;
                          handleColClick(e, r.id);
                        }}
                      >
                        <div className="oc-timegrid-col-bg">
                          {hours.map((h) => (
                            <div key={h} className="oc-timegrid-slot" style={{ height: SLOT_HEIGHT }} />
                          ))}
                        </div>
                        {/* 배경 이벤트 음영 (시간대) */}
                        {(byResource.get(r.id)?.bg || []).flatMap((be) => {
                          const dayLen = (endHour - startHour) * 60;
                          const winStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0).getTime();
                          const winEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, 0, 0, 0).getTime();
                          const bs = new Date(be.start).getTime();
                          const beEnd = be.end ? new Date(be.end).getTime() : bs + 60 * 60000;
                          const covStart = Math.min(Math.max((Math.min(Math.max(bs, winStart), winEnd) - winStart) / 60000, 0), dayLen);
                          const covEnd = Math.min(Math.max((Math.min(Math.max(beEnd, winStart), winEnd) - winStart) / 60000, 0), dayLen);
                          const bands: Array<[number, number]> =
                            be.display === 'inverse-background'
                              ? [[0, covStart], [covEnd, dayLen]]
                              : [[covStart, covEnd]];
                          return bands
                            .filter(([a, b]) => b > a)
                            .map(([a, b], i) => (
                              <div
                                key={`${be.id}-${i}`}
                                className="oc-bg-event"
                                style={{
                                  top: (a / 60) * SLOT_HEIGHT,
                                  bottom: 'auto',
                                  height: ((b - a) / 60) * SLOT_HEIGHT,
                                  backgroundColor: be.color || 'var(--oc-bg-event-color)'
                                }}
                                title={be.title}
                              />
                            ));
                        })}
                        {nowTop !== null && <div className="oc-timegrid-now-indicator-line" style={{ top: nowTop }} />}
                        <div className="oc-timegrid-col-events">
                          {placed.map((p) => {
                            const color = p.evt.color || 'var(--oc-event-bg-color)';
                            return (
                              <div
                                key={p.evt.id}
                                className="oc-event oc-timegrid-event oc-v-event"
                                onClick={(e) => onEventClick?.(p.evt, e)}
                                style={{
                                  top: p.top,
                                  height: p.height,
                                  left: `${p.leftPct}%`,
                                  width: `calc(${p.widthPct}% - 2px)`,
                                  backgroundColor: color,
                                  borderColor: color
                                }}
                                title={p.evt.title}
                              >
                                <div className="oc-event-time">{options.eventTimeFormat(new Date(p.evt.start))}</div>
                                <div className="oc-event-title">{p.evt.title}</div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
