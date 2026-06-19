/* src/oc/views/timegrid/OcTimeGridView.tsx
 * timeGrid(주/일) 뷰.
 * 계층: header(축+요일) / all-day 행 / body(시간축 + 일별 컬럼, 이벤트 절대배치).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { DateProfile } from '../../core/dateProfile';
import { isSameDay, formatDate } from '../../../core/dateUtils';
import type { CalendarEvent } from '../../../types/calendar';
import { useOc } from '../../core/store';
import { getLocale } from '../../core/locales';
import { isBackgroundEvent, isAllDayEvent } from '../../core/daygridSeg';
import { canMoveEvent, canResizeEvent } from '../../core/options';

const SLOT_HEIGHT = 48; // 1시간 = 48px
const AXIS_WIDTH = 64;

interface Placed {
  evt: CalendarEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
}

/** 하루치 시간 이벤트를 겹침 클러스터 → 열 배치로 절대좌표 계산 */
function layoutDay(evts: CalendarEvent[], day: Date, startHour: number, endHour: number, slotHeight: number): Placed[] {
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
  // 1) 겹치는 것끼리 클러스터로 묶기
  let cluster: typeof items = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    if (!cluster.length) return;
    // 2) 클러스터 내 그리디 열 배치
    const colEnds: number[] = [];
    const colOf = new Map<number, number>();
    cluster.forEach((it, i) => {
      let c = colEnds.findIndex((end) => end <= it.start);
      if (c === -1) {
        c = colEnds.length;
        colEnds.push(it.end);
      } else {
        colEnds[c] = it.end;
      }
      colOf.set(i, c);
    });
    const cols = colEnds.length;
    cluster.forEach((it, i) => {
      const startMin = Math.max(0, minsOf(it.start));
      const endMin = Math.min((endHour - startHour) * 60, minsOf(it.end));
      const c = colOf.get(i)!;
      placed.push({
        evt: it.evt,
        top: (startMin / 60) * slotHeight,
        height: Math.max(18, ((endMin - startMin) / 60) * slotHeight),
        widthPct: 100 / cols,
        leftPct: (c / cols) * 100
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

interface OcTimeGridViewProps {
  dateProfile: DateProfile;
  locale: string;
  events: CalendarEvent[];
  onEventClick?: (evt: CalendarEvent, jsEvent: ReactMouseEvent) => void;
  onEventDrop?: (evt: CalendarEvent, newStart: Date, newEnd?: Date) => void;
  onEventResize?: (evt: CalendarEvent, newStart: Date, newEnd?: Date) => void;
  onSelectRange?: (range: { start: Date; end: Date }) => void;
}

export function OcTimeGridView({ dateProfile, locale, events, onEventClick, onEventDrop, onEventResize, onSelectRange }: OcTimeGridViewProps) {
  const { state, options } = useOc();
  const t = getLocale(state.locale);
  const { days } = dateProfile;

  const startHour = options.slotMinTime;
  const endHour = options.slotMaxTime;
  const slotMin = options.slotDuration;

  interface InteractionState {
    evt: CalendarEvent;
    type: 'drag' | 'resize-bottom';
    initialX: number;
    initialY: number;
    currentX: number;
    currentY: number;
    snappedDayIdx: number | null;
    snappedStart: Date;
    snappedEnd: Date;
  }

  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const justDragged = useRef(false);

  const beginDrag = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    if (!canMoveEvent(evt, options)) return;
    e.preventDefault();

    const os = new Date(evt.start);
    const oe = evt.end ? new Date(evt.end) : new Date(os.getTime() + 30 * 60000);

    const startDayStr = os.toDateString();
    const initDayIdx = days.findIndex((d) => d.toDateString() === startDayStr);

    const initialInteraction: InteractionState = {
      evt,
      type: 'drag',
      initialX: e.clientX,
      initialY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      snappedDayIdx: initDayIdx !== -1 ? initDayIdx : null,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction; // 최신 스냅 값 (setState 업데이터 밖에서 콜백 호출용)

    const onMove = (me: PointerEvent) => {
      const dyMin = Math.round((((me.clientY - e.clientY) / SLOT_HEIGHT) * 60) / slotMin) * slotMin;

      const colEl = (document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null)?.closest(
        '.oc-timegrid-col'
      ) as HTMLElement | null;
      const colIdx = colEl?.dataset.dayIndex
        ? Number(colEl.dataset.dayIndex)
        : initDayIdx !== -1
        ? initDayIdx
        : null;

      let ns = new Date(os.getTime() + dyMin * 60000);
      if (colIdx != null && !Number.isNaN(colIdx) && days[colIdx]) {
        const td = days[colIdx];
        ns = new Date(td.getFullYear(), td.getMonth(), td.getDate(), ns.getHours(), ns.getMinutes(), 0, 0);
      }
      const ne = new Date(ns.getTime() + (oe.getTime() - os.getTime()));

      latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedDayIdx: colIdx, snappedStart: ns, snappedEnd: ne };
      setInteraction(latest);
    };

    const onUp = (me: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setInteraction(null);
      const moved = Math.abs(me.clientX - initialInteraction.initialX) > 4 || Math.abs(me.clientY - initialInteraction.initialY) > 4;
      if (moved) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        onEventDrop?.(latest.evt, latest.snappedStart, latest.snappedEnd);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginResizeBottom = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    if (!canResizeEvent(evt, options)) return;
    e.stopPropagation();
    e.preventDefault();

    const os = new Date(evt.start);
    const oe = evt.end ? new Date(evt.end) : new Date(os.getTime() + 30 * 60000);

    const startDayStr = os.toDateString();
    const initDayIdx = days.findIndex((d) => d.toDateString() === startDayStr);

    const initialInteraction: InteractionState = {
      evt,
      type: 'resize-bottom',
      initialX: e.clientX,
      initialY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      snappedDayIdx: initDayIdx !== -1 ? initDayIdx : null,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction;

    const onMove = (me: PointerEvent) => {
      const dyMin = Math.round((((me.clientY - e.clientY) / SLOT_HEIGHT) * 60) / slotMin) * slotMin;

      let ne = new Date(oe.getTime() + dyMin * 60000);
      if (ne.getTime() < os.getTime() + 30 * 60000) {
        ne = new Date(os.getTime() + 30 * 60000);
      }

      latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedEnd: ne };
      setInteraction(latest);
    };

    const onUp = (me: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setInteraction(null);
      const moved = Math.abs(me.clientY - initialInteraction.initialY) > 4;
      if (moved) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        onEventResize?.(latest.evt, latest.snappedStart, latest.snappedEnd);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  interface SelectionState {
    start: Date;
    end: Date;
    dayIdx: number;
  }
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const beginRangeSelection = (e: ReactMouseEvent, targetDay: Date) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.oc-event')) return;

    e.preventDefault();

    const colsEl = document.querySelector('.oc-timegrid-cols') as HTMLElement | null;
    if (!colsEl) return;
    const rect = colsEl.getBoundingClientRect();

    const getYTime = (clientY: number): { hours: number; minutes: number } => {
      const relativeY = clientY - rect.top;
      const rawMinutes = startHour * 60 + (relativeY / SLOT_HEIGHT) * 60;
      const clamped = Math.min(endHour * 60, Math.max(startHour * 60, rawMinutes));
      const snappedMinutes = Math.round(clamped / slotMin) * slotMin;
      const h = Math.floor(snappedMinutes / 60);
      const m = snappedMinutes % 60;
      return { hours: Math.min(23, Math.max(0, h)), minutes: Math.min(59, Math.max(0, m)) };
    };

    const tStart = getYTime(e.clientY);
    const startDateTime = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), tStart.hours, tStart.minutes, 0, 0);

    const initialSelection: SelectionState = {
      start: startDateTime,
      end: new Date(startDateTime.getTime() + 30 * 60000),
      dayIdx: Number(e.currentTarget.getAttribute('data-day-index'))
    };

    setSelection(initialSelection);
    let latest = initialSelection;

    const onMove = (me: PointerEvent) => {
      const tEnd = getYTime(me.clientY);
      const endDateTime = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(), tEnd.hours, tEnd.minutes, 0, 0);

      if (endDateTime.getTime() !== startDateTime.getTime()) {
        const d1 = startDateTime < endDateTime ? startDateTime : endDateTime;
        const d2 = startDateTime < endDateTime ? endDateTime : startDateTime;
        latest = { start: d1, end: d2, dayIdx: initialSelection.dayIdx };
        setSelection(latest);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSelection(null);
      onSelectRange?.({ start: latest.start, end: latest.end });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const [now, setNow] = useState(() => new Date());
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 본문 스크롤바 폭 측정 → 헤더 우측 여백으로 정렬 보정
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setScrollbarWidth(el.offsetWidth - el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // now-indicator 1분마다 갱신
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // 초기 스크롤을 scrollTime 부근으로
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = Math.max(0, (options.scrollTime - startHour) * SLOT_HEIGHT);
  }, [options.scrollTime, startHour]);

  const hours = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  // 배경/종일/시간 이벤트 분리, 일자별로 그룹
  const { alldayByDay, timedByDay, bgByDay } = useMemo(() => {
    const allday = new Map<string, CalendarEvent[]>();
    const timed = new Map<string, CalendarEvent[]>();
    const bg = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const key = day.toDateString();
      const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
      const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
      const inDay = events.filter((evt) => {
        const s = new Date(evt.start);
        const e = evt.end ? new Date(evt.end) : s;
        return s <= de && e >= ds;
      });
      const fg = inDay.filter((e) => !isBackgroundEvent(e));
      allday.set(key, fg.filter(isAllDayEvent));
      timed.set(key, fg.filter((e) => !isAllDayEvent(e)));
      // background: 겹치는 날만 / inverse-background: 모든 날(겹치지 않는 날은 종일 음영)
      bg.set(
        key,
        events.filter(
          (e) => isBackgroundEvent(e) && (e.display === 'inverse-background' || inDay.includes(e))
        )
      );
    }
    return { alldayByDay: allday, timedByDay: timed, bgByDay: bg };
  }, [days, events]);

  const totalHeight = (endHour - startHour) * SLOT_HEIGHT;
  const hasAllday = days.some((d) => (alldayByDay.get(d.toDateString()) || []).length > 0);

  return (
    <div className="oc-view oc-timegrid-view">
      <div className="oc-scrollgrid">
        {/* Header: 축 코너 + 요일/날짜 (본문 스크롤바 폭만큼 정렬 보정) */}
        <div className="oc-scrollgrid-section-header" style={{ paddingRight: scrollbarWidth }}>
          <div className="oc-timegrid-header">
            <div className="oc-timegrid-axis" style={{ width: AXIS_WIDTH }} />
            <div className="oc-timegrid-header-cols">
              {days.map((day) => {
                const today = isSameDay(day, now);
                return (
                  <div key={day.toISOString()} className={`oc-timegrid-col-header${today ? ' oc-day-today' : ''}`}>
                    <div className="oc-col-header-cell-cushion">
                      {formatDate(day, { weekday: 'short' }, locale)} {day.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-day 행 */}
          {hasAllday && (
            <div className="oc-timegrid-allday">
              <div className="oc-timegrid-axis" style={{ width: AXIS_WIDTH }}>
                <span className="oc-timegrid-axis-cushion">{t.allDay}</span>
              </div>
              <div className="oc-timegrid-allday-cols">
                {days.map((day) => (
                  <div key={day.toISOString()} className="oc-timegrid-allday-col">
                    {(alldayByDay.get(day.toDateString()) || []).map((evt) => {
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

        {/* Body: 시간축 + 일별 컬럼 */}
        <div className="oc-scrollgrid-section-body">
          <div className="oc-scroller-harness">
            <div className="oc-scroller" ref={scrollerRef}>
              <div className="oc-timegrid-body" style={{ height: totalHeight }}>
                {/* 좌측 시간 눈금 */}
                <div className="oc-timegrid-axis-col" style={{ width: AXIS_WIDTH }}>
                  {hours.map((h) => (
                    <div key={h} className="oc-timegrid-slot-label" style={{ height: SLOT_HEIGHT }}>
                      <span className="oc-timegrid-slot-label-cushion">
                        {h === startHour ? '' : options.slotLabelFormat(h)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 일별 컬럼 */}
                <div className="oc-timegrid-cols">
                  {days.map((day, dayIdx) => {
                    const today = isSameDay(day, now);
                    const placed = layoutDay(timedByDay.get(day.toDateString()) || [], day, startHour, endHour, SLOT_HEIGHT);
                    const nowMinsFromStart = now.getHours() * 60 + now.getMinutes() - startHour * 60;
                    const nowTop =
                      today && nowMinsFromStart >= 0 && nowMinsFromStart <= (endHour - startHour) * 60
                        ? (nowMinsFromStart / 60) * SLOT_HEIGHT
                        : null;
                    return (
                      <div
                        key={day.toISOString()}
                        className={`oc-timegrid-col${today ? ' oc-day-today' : ''}`}
                        data-day-index={dayIdx}
                        onPointerDown={(e) => beginRangeSelection(e, day)}
                      >
                        {/* 슬롯 가로선 배경 */}
                        <div className="oc-timegrid-col-bg">
                          {hours.map((h) => (
                            <div key={h} className="oc-timegrid-slot" style={{ height: SLOT_HEIGHT }} />
                          ))}
                        </div>
                        {/* 비업무시간 음영 */}
                        {options.businessHours &&
                          (() => {
                            const bh = options.businessHours;
                            const parse = (s: string) => {
                              const [h, m] = s.split(':').map(Number);
                              return (h || 0) * 60 + (m || 0);
                            };
                            const total = (endHour - startHour) * 60;
                            const segs: [number, number][] = [];
                            if (!bh.daysOfWeek.includes(day.getDay())) {
                              segs.push([0, total]);
                            } else {
                              const bs = parse(bh.startTime) - startHour * 60;
                              const be = parse(bh.endTime) - startHour * 60;
                              if (bs > 0) segs.push([0, Math.min(bs, total)]);
                              if (be < total) segs.push([Math.max(0, be), total]);
                            }
                            return segs.map(([a, b], i) => (
                              <div
                                key={i}
                                className="oc-non-business"
                                style={{ top: (a / 60) * SLOT_HEIGHT, height: ((b - a) / 60) * SLOT_HEIGHT }}
                              />
                            ));
                          })()}
                        {/* 배경 이벤트 음영 (시간대) */}
                        {(bgByDay.get(day.toDateString()) || []).flatMap((be) => {
                          // 이 날의 표시 창([startHour, endHour])에 대한 분 단위 기준
                          const dayLen = (endHour - startHour) * 60;
                          const winStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0).getTime();
                          const winEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), endHour, 0, 0, 0).getTime();
                          const bs = new Date(be.start).getTime();
                          const beEnd = be.end ? new Date(be.end).getTime() : bs + 60 * 60000;
                          // 이벤트가 이 날 표시 창과 겹치는 구간(분)
                          const covStart = Math.min(Math.max((Math.min(Math.max(bs, winStart), winEnd) - winStart) / 60000, 0), dayLen);
                          const covEnd = Math.min(Math.max((Math.min(Math.max(beEnd, winStart), winEnd) - winStart) / 60000, 0), dayLen);
                          // 음영을 칠할 (시작분, 끝분) 구간들
                          const bands: Array<[number, number]> =
                            be.display === 'inverse-background'
                              ? [[0, covStart], [covEnd, dayLen]] // 덮지 않는 구간
                              : [[covStart, covEnd]]; // 덮는 구간
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
                        {/* now indicator */}
                        {nowTop !== null && (
                          <div className="oc-timegrid-now-indicator-line" style={{ top: nowTop }} />
                        )}
                        {/* 시간 이벤트 */}
                        <div className="oc-timegrid-col-events">
                          {/* Selection Guide */}
                          {selection && selection.dayIdx === dayIdx && (() => {
                            const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0).getTime();
                            const minsOf = (t: number) => (t - dayStart) / 60000;
                            const startMin = Math.max(0, minsOf(selection.start.getTime()));
                            const endMin = Math.min((endHour - startHour) * 60, minsOf(selection.end.getTime()));
                            const top = (startMin / 60) * SLOT_HEIGHT;
                            const height = Math.max(18, ((endMin - startMin) / 60) * SLOT_HEIGHT);
                            return (
                              <div
                                className="oc-event-snap-guide"
                                style={{
                                  top,
                                  height,
                                  left: 0,
                                  width: '100%'
                                }}
                              />
                            );
                          })()}
                          {/* Snap Guide */}
                          {(() => {
                            if (!interaction || interaction.snappedDayIdx !== dayIdx) return null;
                            const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), startHour, 0, 0, 0).getTime();
                            const minsOf = (t: number) => (t - dayStart) / 60000;
                            const startMin = Math.max(0, minsOf(interaction.snappedStart.getTime()));
                            const endMin = Math.min((endHour - startHour) * 60, minsOf(interaction.snappedEnd.getTime()));
                            const top = (startMin / 60) * SLOT_HEIGHT;
                            const height = Math.max(18, ((endMin - startMin) / 60) * SLOT_HEIGHT);
                            return (
                              <div
                                className="oc-event-snap-guide"
                                style={{
                                  top,
                                  height,
                                  left: 0,
                                  width: '100%',
                                  borderColor: interaction.evt.color || 'var(--oc-event-border-color)'
                                }}
                              />
                            );
                          })()}

                          {placed.map((p) => {
                            const color = p.evt.color || 'var(--oc-event-bg-color)';
                            const isBeingInteracted = interaction?.evt.id === p.evt.id;
                            return (
                              <div
                                key={p.evt.id}
                                className={`oc-event oc-timegrid-event oc-v-event${isBeingInteracted ? ' oc-event-dragging-original' : ''}`}
                                onPointerDown={(e) => { if (canMoveEvent(p.evt, options)) beginDrag(e, p.evt); }}
                                onClick={(e) => {
                                  if (justDragged.current) return;
                                  onEventClick?.(p.evt, e);
                                }}
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
                                {canResizeEvent(p.evt, options) && (
                                  <div
                                    className="oc-event-resizer oc-event-resizer-bottom"
                                    onPointerDown={(e) => beginResizeBottom(e, p.evt)}
                                  />
                                )}
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
      {interaction && (
        <div
          className="oc-event-drag-ghost"
          style={{
            left: interaction.currentX + 10,
            top: interaction.currentY + 10,
            backgroundColor: interaction.evt.color || 'var(--oc-event-bg-color)',
            borderColor: interaction.evt.color || 'var(--oc-event-border-color)'
          }}
        >
          <strong>{interaction.evt.title}</strong>
          <div style={{ fontSize: '0.8em', marginTop: '2px', opacity: 0.9 }}>
            {options.eventTimeFormat(interaction.snappedStart)} - {options.eventTimeFormat(interaction.snappedEnd)}
          </div>
        </div>
      )}
    </div>
  );
}
