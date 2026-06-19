/* src/oc/views/daygrid/OcDayGridView.tsx
 * dayGrid(월간) 뷰.
 * 계층: oc-scrollgrid > (header) oc-col-header / (body) oc-daygrid-body > rows > days > frame.
 */

import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import type { MouseEvent as ReactMouseEvent, CSSProperties } from 'react';
import { useOc } from '../../core/store';
import type { DateProfile } from '../../core/dateProfile';
import { addDays, isSameDay, formatDate, startOfWeek } from '../../../core/dateUtils';
import type { CalendarEvent } from '../../../types/calendar';
import { getLocale } from '../../core/locales';
import { buildWeekSegs, isBackgroundEvent, type WeekSeg } from '../../core/daygridSeg';
import { canMoveEvent, canResizeEvent } from '../../core/options';

const ROW_MIN_HEIGHT = 88; // 주(week) 행 최소 높이(px) — 창이 짧으면 이 높이로 스크롤, 보통은 균등 채움
const NUMBER_ROW_HEIGHT = 24; // 날짜 숫자 영역 높이(px)
const EVENT_LINE = 22; // 이벤트 한 줄(레벨) 높이(px)

function isBlockEvent(evt: CalendarEvent): boolean {
  if (evt.allDay) return true;
  const s = new Date(evt.start);
  const e = evt.end ? new Date(evt.end) : s;
  return s.getFullYear() !== e.getFullYear() || s.getMonth() !== e.getMonth() || s.getDate() !== e.getDate();
}

/** ISO 8601 주차 번호 */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // 월=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // 해당 주의 목요일
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

interface OcDayGridViewProps {
  dateProfile: DateProfile;
  locale: string;
  events: CalendarEvent[];
  onEventClick?: (evt: CalendarEvent, jsEvent: ReactMouseEvent) => void;
  onDayClick?: (day: Date) => void;
  onEventDrop?: (evt: CalendarEvent, newStart: Date, newEnd?: Date) => void;
  onEventResize?: (evt: CalendarEvent, newStart: Date, newEnd?: Date) => void;
  onSelectRange?: (range: { start: Date; end: Date }) => void;
}

export function OcDayGridView({
  dateProfile,
  locale,
  events,
  onEventClick,
  onDayClick,
  onEventDrop,
  onEventResize,
  onSelectRange
}: OcDayGridViewProps) {
  const { state, options } = useOc();
  const t = getLocale(state.locale);
  const { days, colCount: profileCols, activeRange } = dateProfile;
  // 활성 범위(월 뷰=해당 월) 밖의 날 = 다른 달 셀. 주/일 뷰는 모두 활성이라 없음.
  const activeStartMs = new Date(
    activeRange.start.getFullYear(), activeRange.start.getMonth(), activeRange.start.getDate()
  ).getTime();
  const activeEndMs = new Date(
    activeRange.end.getFullYear(), activeRange.end.getMonth(), activeRange.end.getDate()
  ).getTime();

  const scrollerRef = useRef<HTMLDivElement>(null);
  const rangeSelectionFired = useRef(false);
  const justDragged = useRef(false);

  const [popover, setPopover] = useState<{ day: Date; x: number; y: number } | null>(null);

  interface InteractionState {
    evt: CalendarEvent;
    type: 'drag' | 'resize-start' | 'resize-end';
    initialX: number;
    initialY: number;
    currentX: number;
    currentY: number;
    snappedStart: Date;
    snappedEnd: Date;
  }

  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  const beginResizeStart = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const os = new Date(evt.start);
    const oe = evt.end ? new Date(evt.end) : new Date(os.getTime() + 24 * 60 * 60 * 1000);

    const initialInteraction: InteractionState = {
      evt,
      type: 'resize-start',
      initialX: e.clientX,
      initialY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction;

    const onMove = (me: PointerEvent) => {
      const cellEl = (document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null)?.closest(
        '.oc-daygrid-day'
      ) as HTMLElement | null;
      const dateStr = cellEl?.dataset.date;
      const hoveredDate = dateStr ? new Date(dateStr) : null;

      let ns = os;
      if (hoveredDate && hoveredDate <= oe) {
        ns = new Date(hoveredDate.getFullYear(), hoveredDate.getMonth(), hoveredDate.getDate(), os.getHours(), os.getMinutes(), 0, 0);
      }

      latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedStart: ns };
      setInteraction(latest);
    };

    const onUp = (me: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setInteraction(null);
      if (Math.abs(me.clientX - initialInteraction.initialX) > 4) {
        onEventResize?.(latest.evt, latest.snappedStart, latest.snappedEnd);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginResizeEnd = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const os = new Date(evt.start);
    const oe = evt.end ? new Date(evt.end) : new Date(os.getTime() + 24 * 60 * 60 * 1000);

    const initialInteraction: InteractionState = {
      evt,
      type: 'resize-end',
      initialX: e.clientX,
      initialY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction;

    const onMove = (me: PointerEvent) => {
      const cellEl = (document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null)?.closest(
        '.oc-daygrid-day'
      ) as HTMLElement | null;
      const dateStr = cellEl?.dataset.date;
      const hoveredDate = dateStr ? new Date(dateStr) : null;

      let ne = oe;
      if (hoveredDate && hoveredDate >= os) {
        ne = new Date(hoveredDate.getFullYear(), hoveredDate.getMonth(), hoveredDate.getDate(), oe.getHours(), oe.getMinutes(), 0, 0);
      }

      latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedEnd: ne };
      setInteraction(latest);
    };

    const onUp = (me: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setInteraction(null);
      if (Math.abs(me.clientX - initialInteraction.initialX) > 4) {
        onEventResize?.(latest.evt, latest.snappedStart, latest.snappedEnd);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // PointerEvent-based event drag (replaces HTML5 DnD for cross-browser consistency)
  const beginEventDrag = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const os = new Date(evt.start);
    const oe = evt.end ? new Date(evt.end) : new Date(os.getTime() + 60 * 60000);

    const initialInteraction: InteractionState = {
      evt,
      type: 'drag',
      initialX: e.clientX,
      initialY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction;

    const onMove = (me: PointerEvent) => {
      const cellEl = (document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null)?.closest(
        '.oc-daygrid-day'
      ) as HTMLElement | null;
      const dateStr = cellEl?.dataset.date;
      const hoveredDate = dateStr ? new Date(dateStr) : null;

      if (hoveredDate) {
        const ns = new Date(hoveredDate.getFullYear(), hoveredDate.getMonth(), hoveredDate.getDate(), os.getHours(), os.getMinutes(), 0, 0);
        const ne = new Date(ns.getTime() + (oe.getTime() - os.getTime()));
        latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedStart: ns, snappedEnd: ne };
      } else {
        latest = { ...latest, currentX: me.clientX, currentY: me.clientY };
      }
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

  interface SelectionState {
    start: Date;
    end: Date;
    didDrag: boolean;
  }
  const [selection, setSelection] = useState<SelectionState | null>(null);

  const beginRangeSelection = (e: ReactMouseEvent, startDay: Date) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.oc-event') || target.closest('.oc-daygrid-more-link') || target.closest('.oc-popover')) return;

    e.preventDefault();
    rangeSelectionFired.current = false;

    const initialSelection: SelectionState = {
      start: startDay,
      end: startDay,
      didDrag: false
    };
    setSelection(initialSelection);

    const startX = e.clientX;
    const startY = e.clientY;
    let hasDragged = false;

    let latest: SelectionState = initialSelection;

    const onMove = (me: PointerEvent) => {
      // Only consider it a real drag if moved more than 5px
      if (!hasDragged && (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5)) {
        hasDragged = true;
      }

      const cellEl = (document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null)?.closest(
        '.oc-daygrid-day'
      ) as HTMLElement | null;
      const dateStr = cellEl?.dataset.date;
      const hoveredDate = dateStr ? new Date(dateStr) : null;

      if (hoveredDate) {
        const d1 = startDay < hoveredDate ? startDay : hoveredDate;
        const d2 = startDay < hoveredDate ? hoveredDate : startDay;

        const endDateTime = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate(), 10, 0, 0, 0);

        latest = {
          start: new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 9, 0, 0, 0),
          end: endDateTime,
          didDrag: hasDragged
        };
        setSelection(latest);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSelection(null);
      if (latest.didDrag) {
        // Real drag occurred → open range-based creation dialog
        rangeSelectionFired.current = true;
        setTimeout(() => (rangeSelectionFired.current = false), 0);
        onSelectRange?.({ start: latest.start, end: latest.end });
      }
      // If no drag, let the onClick handler take over (single day click)
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // 실제 행 높이 측정(표시 개수) + 스크롤바 폭 측정(헤더 정렬 보정)
  const rowCount = Math.max(1, Math.ceil(days.length / 7));
  const [capacity, setCapacity] = useState(3);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const DAY_TOP = 26;
    const LINE = 22;
    const update = () => {
      const rowH = Math.max(ROW_MIN_HEIGHT, el.clientHeight / rowCount);
      const auto = Math.max(1, Math.floor((rowH - DAY_TOP) / LINE));
      // dayMaxEvents: number면 고정, true면 높이 기반 자동
      setCapacity(typeof options.dayMaxEvents === 'number' ? Math.max(1, options.dayMaxEvents) : auto);
      setScrollbarWidth(el.offsetWidth - el.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rowCount, options.dayMaxEvents]);

  // 요일 헤더 라벨 (firstDay 기준, 주말 숨김 반영)
  const weekdayLabels = useMemo(() => {
    const ws = startOfWeek(new Date(), options.firstDay);
    const all = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    const visible = options.weekends ? all : all.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
    return visible.map((d) => formatDate(d, { weekday: 'short' }, locale));
  }, [locale, options.firstDay, options.weekends]);

  // 배경 이벤트 분리 (막대/세그먼트 대상에서 제외)
  const fgEvents = useMemo(() => events.filter((e) => !isBackgroundEvent(e)), [events]);
  const bgEvents = useMemo(() => events.filter(isBackgroundEvent), [events]);

  const overlapsDay = (evt: CalendarEvent, day: Date) => {
    const s = new Date(evt.start);
    const e = evt.end ? new Date(evt.end) : s;
    const ds = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
    const de = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    return s <= de && e >= ds;
  };

  // 일자별 (전경) 이벤트 — 더보기 팝오버용
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      const list = fgEvents
        .filter((evt) => overlapsDay(evt, day))
        .sort((a, b) => {
          const ab = isBlockEvent(a);
          const bb = isBlockEvent(b);
          if (ab !== bb) return ab ? -1 : 1;
          return new Date(a.start).getTime() - new Date(b.start).getTime();
        });
      map.set(day.toDateString(), list);
    }
    return map;
  }, [days, fgEvents]);

  // 일자별 배경 이벤트 — 셀 음영용
  // background: 이벤트가 덮는 날을 음영 / inverse-background: 덮지 "않는" 날을 음영
  const bgByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const day of days) {
      map.set(
        day.toDateString(),
        bgEvents.filter((evt) =>
          evt.display === 'inverse-background' ? !overlapsDay(evt, day) : overlapsDay(evt, day)
        )
      );
    }
    return map;
  }, [days, bgEvents]);

  // 주(행) 단위로 분할 (주말 숨김 시 colCount=5)
  const weeks: Date[][] = useMemo(() => {
    const out: Date[][] = [];
    const step = Math.max(1, profileCols);
    for (let i = 0; i < days.length; i += step) out.push(days.slice(i, i + step));
    return out;
  }, [days, profileCols]);

  const renderEvent = (evt: CalendarEvent, day: Date) => {
    const block = isBlockEvent(evt);
    const color = evt.color || 'var(--oc-event-bg-color)';
    const isBeingInteracted = interaction?.evt.id === evt.id;
    const cardClass = `oc-event oc-daygrid-event ${block ? 'oc-daygrid-block-event' : 'oc-daygrid-dot-event'}${isBeingInteracted ? ' oc-event-dragging-original' : ''}`;

    if (block) {
      const s = new Date(evt.start);
      const e = evt.end ? new Date(evt.end) : s;
      const startsToday = isSameDay(s, day);
      const endsToday = isSameDay(e, day);
      return (
        <div key={evt.id} className="oc-daygrid-event-harness">
          <div
            className={cardClass}
            onPointerDown={(e) => { if (canMoveEvent(evt, options)) beginEventDrag(e, evt); }}
            onClick={(e) => {
              e.stopPropagation();
              if (justDragged.current) return;
              onEventClick?.(evt, e);
            }}
            style={{
              backgroundColor: color,
              borderColor: color,
              borderTopLeftRadius: startsToday ? 3 : 0,
              borderBottomLeftRadius: startsToday ? 3 : 0,
              borderTopRightRadius: endsToday ? 3 : 0,
              borderBottomRightRadius: endsToday ? 3 : 0
            }}
            title={evt.title}
          >
            {startsToday && canResizeEvent(evt, options) && (
              <div
                className="oc-event-resizer oc-event-resizer-start"
                onPointerDown={(e) => beginResizeStart(e, evt)}
              />
            )}
            {!evt.allDay && startsToday && <span className="oc-event-time">{options.eventTimeFormat(s)}</span>}
            <span className="oc-event-title">{evt.title}</span>
            {endsToday && canResizeEvent(evt, options) && (
              <div
                className="oc-event-resizer oc-event-resizer-end"
                onPointerDown={(e) => beginResizeEnd(e, evt)}
              />
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={evt.id} className="oc-daygrid-event-harness">
        <div
          className={cardClass}
          onPointerDown={(e) => { if (canMoveEvent(evt, options)) beginEventDrag(e, evt); }}
          onClick={(e) => {
            e.stopPropagation();
            if (justDragged.current) return;
            onEventClick?.(evt, e);
          }}
          title={evt.title}
        >
          <span className="oc-daygrid-event-dot" style={{ borderColor: color }} />
          <span className="oc-event-time">{options.eventTimeFormat(new Date(evt.start))}</span>
          <span className="oc-event-title">{evt.title}</span>
        </div>
      </div>
    );
  };

  // 스패닝 세그먼트 1개 렌더 (전경 그리드의 grid item)
  const renderSeg = (seg: WeekSeg) => {
    const evt = seg.evt;
    const color = evt.color || 'var(--oc-event-bg-color)';
    const isBeingInteracted = interaction?.evt.id === evt.id;
    const block = isBlockEvent(evt);
    const harnessStyle: CSSProperties = {
      gridColumn: `${seg.startCol + 1} / ${seg.endCol + 2}`,
      gridRow: seg.level + 1
    };
    const cardClass = `oc-event oc-daygrid-event ${
      block ? 'oc-daygrid-block-event' : 'oc-daygrid-dot-event'
    }${isBeingInteracted ? ' oc-event-dragging-original' : ''}`;
    const pointerHandlers = {
      onPointerDown: (e: ReactMouseEvent) => {
        if (canMoveEvent(evt, options)) beginEventDrag(e, evt);
      },
      onClick: (e: ReactMouseEvent) => {
        e.stopPropagation();
        if (justDragged.current) return;
        onEventClick?.(evt, e);
      }
    };

    if (block) {
      return (
        <div key={evt.id} className="oc-daygrid-event-harness" style={harnessStyle}>
          <div
            className={cardClass}
            {...pointerHandlers}
            style={{
              backgroundColor: color,
              borderColor: color,
              borderTopLeftRadius: seg.isStart ? 3 : 0,
              borderBottomLeftRadius: seg.isStart ? 3 : 0,
              borderTopRightRadius: seg.isEnd ? 3 : 0,
              borderBottomRightRadius: seg.isEnd ? 3 : 0
            }}
            title={evt.title}
          >
            {seg.isStart && canResizeEvent(evt, options) && (
              <div className="oc-event-resizer oc-event-resizer-start" onPointerDown={(e) => beginResizeStart(e, evt)} />
            )}
            {!evt.allDay && seg.isStart && <span className="oc-event-time">{options.eventTimeFormat(new Date(evt.start))}</span>}
            <span className="oc-event-title">{seg.isStart ? evt.title : ' '}</span>
            {seg.isEnd && canResizeEvent(evt, options) && (
              <div className="oc-event-resizer oc-event-resizer-end" onPointerDown={(e) => beginResizeEnd(e, evt)} />
            )}
          </div>
        </div>
      );
    }
    return (
      <div key={evt.id} className="oc-daygrid-event-harness" style={harnessStyle}>
        <div className={cardClass} {...pointerHandlers} title={evt.title}>
          <span className="oc-daygrid-event-dot" style={{ borderColor: color }} />
          <span className="oc-event-time">{options.eventTimeFormat(new Date(evt.start))}</span>
          <span className="oc-event-title">{evt.title}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="oc-view oc-daygrid-view">
      <div className="oc-scrollgrid">
        {/* Header: weekdays (table) — 본문 스크롤바 폭만큼 우측 여백으로 정렬 보정 */}
        <div className="oc-scrollgrid-section-header" style={{ paddingRight: scrollbarWidth }}>
          <table className="oc-col-header-table">
            <colgroup>
              {weekdayLabels.map((_, i) => (
                <col key={i} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {weekdayLabels.map((wd, i) => (
                  <th key={i} className="oc-col-header-cell">
                    <span className="oc-col-header-cell-cushion">{wd}</span>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Body: weeks (배경 셀 + 전경 스패닝 세그먼트 레이어) */}
        <div className="oc-scrollgrid-section-body">
          <div className="oc-scroller" ref={scrollerRef}>
            <div className={`oc-daygrid-body${interaction || selection ? ' oc-interacting' : ''}`}>
              {weeks.map((week, wi) => {
                // 이번 주 세그먼트 + 레벨 + 오버플로 계산 (배경 이벤트 제외)
                const segs = buildWeekSegs(fgEvents, week);
                const levelsUsed = segs.reduce((m, s) => Math.max(m, s.level + 1), 0);
                const overflow = levelsUsed > capacity;
                const visibleLevels = overflow ? Math.max(0, capacity - 1) : levelsUsed;
                const visibleSegs = segs.filter((s) => s.level < visibleLevels);
                const colCount = week.length;
                const hiddenByCol = new Array(colCount).fill(0) as number[];
                if (overflow) {
                  for (const s of segs) {
                    if (s.level >= visibleLevels) {
                      for (let c = s.startCol; c <= s.endCol; c++) hiddenByCol[c]++;
                    }
                  }
                }
                return (
                  <div className="oc-daygrid-week" key={wi} style={{ minHeight: ROW_MIN_HEIGHT }}>
                    {/* 배경: 날짜 셀 (상호작용/번호/하이라이트) */}
                    <div
                      className="oc-daygrid-week-bg"
                      style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
                    >
                      {week.map((day, dayIdx) => {
                        const dayMs = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
                        const isOther = dayMs < activeStartMs || dayMs > activeEndMs;
                        const today = isSameDay(day, new Date());
                        const showWeekNum = options.weekNumbers && dayIdx === 0;
                        const isHighlighted =
                          (interaction &&
                            (() => {
                              const start = new Date(interaction.snappedStart);
                              start.setHours(0, 0, 0, 0);
                              const end = new Date(interaction.snappedEnd);
                              end.setHours(23, 59, 59, 999);
                              return day >= start && day <= end;
                            })()) ||
                          (selection &&
                            (() => {
                              const start = new Date(selection.start);
                              start.setHours(0, 0, 0, 0);
                              const end = new Date(selection.end);
                              end.setHours(23, 59, 59, 999);
                              return day >= start && day <= end;
                            })());
                        return (
                          <div
                            key={day.toISOString()}
                            className={`oc-daygrid-day${today ? ' oc-day-today' : ''}${isOther ? ' oc-day-other' : ''}`}
                            data-date={day.toISOString()}
                            onPointerDown={(e) => beginRangeSelection(e, day)}
                            onClick={() => {
                              if (rangeSelectionFired.current) return;
                              onDayClick?.(day);
                            }}
                          >
                            {showWeekNum && <span className="oc-daygrid-week-number">W{isoWeek(day)}</span>}
                            {/* 비업무 요일 음영 */}
                            {options.businessHours &&
                              !options.businessHours.daysOfWeek.includes(day.getDay()) && (
                                <div className="oc-non-business" style={{ top: 0, bottom: 0 }} />
                              )}
                            {/* 배경 이벤트 음영 */}
                            {(bgByDay.get(day.toDateString()) || []).map((be) => (
                              <div
                                key={be.id}
                                className="oc-bg-event"
                                style={{ backgroundColor: be.color || 'var(--oc-bg-event-color)' }}
                                title={be.title}
                              />
                            ))}
                            {isHighlighted && (
                              <div
                                className="oc-event-snap-guide"
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  zIndex: 1,
                                  pointerEvents: 'none',
                                  borderColor: interaction?.evt.color || 'var(--oc-event-border-color)'
                                }}
                              />
                            )}
                            <div className="oc-daygrid-day-top">
                              <a className="oc-daygrid-day-number">{day.getDate()}</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 전경: 스패닝 세그먼트 (레벨별 grid 배치) */}
                    <div
                      className="oc-daygrid-week-events"
                      style={{
                        top: NUMBER_ROW_HEIGHT,
                        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                        gridAutoRows: `${EVENT_LINE}px`
                      }}
                    >
                      {visibleSegs.map((seg) => renderSeg(seg))}
                      {overflow &&
                        hiddenByCol.map((n, c) =>
                          n > 0 ? (
                            <div
                              key={`more-${c}`}
                              className="oc-daygrid-more-harness"
                              style={{ gridColumn: `${c + 1}`, gridRow: visibleLevels + 1 }}
                            >
                              <a
                                className="oc-daygrid-more-link"
                                onClick={(e) => {
                                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setPopover({ day: week[c], x: r.left, y: r.bottom });
                                }}
                              >
                                +{n} {t.more}
                              </a>
                            </div>
                          ) : null
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* More-link popover */}
      {popover && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setPopover(null)}
          />
          <div
            className="oc-popover"
            style={{ left: Math.min(popover.x, window.innerWidth - 260), top: popover.y + 2 }}
          >
            <div className="oc-popover-header">
              <span>{formatDate(popover.day, { month: 'long', day: 'numeric' }, locale)}</span>
              <button className="oc-popover-close" onClick={() => setPopover(null)}>
                &times;
              </button>
            </div>
            <div className="oc-popover-body">
              {(eventsByDay.get(popover.day.toDateString()) || []).map((evt) => renderEvent(evt, popover.day))}
            </div>
          </div>
        </>
      )}

      {/* Floating Ghost */}
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
            {formatDate(interaction.snappedStart, { month: 'short', day: 'numeric' }, locale)} - {formatDate(interaction.snappedEnd, { month: 'short', day: 'numeric' }, locale)}
          </div>
        </div>
      )}
    </div>
  );
}
