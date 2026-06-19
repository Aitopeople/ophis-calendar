/* src/oc/views/timeline/OcTimelineView.tsx
 * resourceTimeline 뷰 + 행 가상화.
 * 단일 스크롤러: sticky 헤더(슬롯) + sticky 좌측 리소스열, 리소스 행은 가상화.
 */

import { useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useOc } from '../../core/store';
import { useVirtual } from '../../core/useVirtual';
import { startOfDay, startOfWeek, addDays, formatDate } from '../../../core/dateUtils';
import type { CalendarEvent, CalendarResource } from '../../../types/calendar';
import { getLocale } from '../../core/locales';
import { isBackgroundEvent } from '../../core/daygridSeg';
import { canMoveEvent, canResizeEvent } from '../../core/options';

const RES_COL_WIDTH = 200;
const ROW_HEIGHT = 44;
const HOUR_SLOT_WIDTH = 56;
const DAY_SLOT_WIDTH = 140;

interface OcTimelineViewProps {
  isWeek: boolean;
  locale: string;
  events: CalendarEvent[];
  onEventClick?: (evt: CalendarEvent, jsEvent: ReactMouseEvent) => void;
  onEventDrop?: (evt: CalendarEvent, newStart: Date, newEnd?: Date, newResourceId?: string) => void;
  onEventResize?: (evt: CalendarEvent, newStart: Date, newEnd?: Date) => void;
}

export function OcTimelineView({ isWeek, locale, events, onEventClick, onEventDrop, onEventResize }: OcTimelineViewProps) {
  const { state, options } = useOc();
  const t = getLocale(state.locale);
  const { resources, currentDate } = state;
  const scrollRef = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);

  const { rangeStart, rangeEnd, slots, slotWidth } = useMemo(() => {
    if (isWeek) {
      const start = startOfWeek(currentDate, 0);
      const s = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        return { label: `${formatDate(d, { weekday: 'short' }, locale)} ${d.getDate()}` };
      });
      return { rangeStart: start, rangeEnd: addDays(start, 7), slots: s, slotWidth: DAY_SLOT_WIDTH };
    }
    const start = startOfDay(currentDate);
    const s = Array.from({ length: 24 }, (_, i) => ({ label: `${i % 12 || 12}${i >= 12 ? 'p' : 'a'}` }));
    return { rangeStart: start, rangeEnd: addDays(start, 1), slots: s, slotWidth: HOUR_SLOT_WIDTH };
  }, [isWeek, currentDate, locale]);

  const totalWidth = slots.length * slotWidth;
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const pxPerMs = totalWidth / totalMs;

  // 전경(막대) 이벤트: 리소스별. 배경 이벤트는 제외.
  const eventsByResource = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const r of resources) map.set(r.id, []);
    for (const evt of events) {
      if (isBackgroundEvent(evt)) continue;
      if (evt.resourceId && map.has(evt.resourceId)) map.get(evt.resourceId)!.push(evt);
    }
    return map;
  }, [events, resources]);

  // 배경 이벤트: resourceId가 일치하거나 없는(=전체 적용) 것 → 레인 가로 음영.
  const bgByResource = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const bgEvents = events.filter(isBackgroundEvent);
    for (const r of resources) {
      map.set(
        r.id,
        bgEvents.filter((e) => !e.resourceId || e.resourceId === r.id)
      );
    }
    return map;
  }, [events, resources]);

  const placeEvent = (evt: CalendarEvent) => {
    const s = Math.max(new Date(evt.start).getTime(), rangeStart.getTime());
    const e = Math.min(
      (evt.end ? new Date(evt.end) : new Date(new Date(evt.start).getTime() + 60 * 60000)).getTime(),
      rangeEnd.getTime()
    );
    if (e <= s) return null;
    return { left: (s - rangeStart.getTime()) * pxPerMs, width: Math.max(2, (e - s) * pxPerMs) };
  };

  // 배경 이벤트 가로 음영 구간. inverse-background는 덮지 않는 구간(앞·뒤)을 음영.
  const placeBg = (evt: CalendarEvent): Array<{ left: number; width: number }> => {
    const rs = rangeStart.getTime();
    const re = rangeEnd.getTime();
    const evtS = new Date(evt.start).getTime();
    const evtE = (evt.end ? new Date(evt.end) : new Date(evtS + 60 * 60000)).getTime();
    const s = Math.min(Math.max(evtS, rs), re);
    const e = Math.min(Math.max(evtE, rs), re);
    const spans: Array<[number, number]> =
      evt.display === 'inverse-background' ? [[rs, s], [e, re]] : [[s, e]];
    return spans
      .filter(([a, b]) => b > a)
      .map(([a, b]) => ({ left: (a - rs) * pxPerMs, width: (b - a) * pxPerMs }));
  };

  interface InteractionState {
    evt: CalendarEvent;
    type: 'drag' | 'resize-start' | 'resize-end';
    initialX: number;
    initialY: number;
    currentX: number;
    currentY: number;
    snappedResourceId: string | null;
    snappedStart: Date;
    snappedEnd: Date;
  }

  const [interaction, setInteraction] = useState<InteractionState | null>(null);

  // 포인터 드래그(이동): 가로 = 시간 이동 (15분 스냅), 세로 = 리소스 이동
  const beginDrag = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    if (!canMoveEvent(evt, options)) return;
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
      snappedResourceId: evt.resourceId || null,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction;

    const onMove = (me: PointerEvent) => {
      const deltaMs = (me.clientX - e.clientX) / pxPerMs;
      const snap = 15 * 60000;
      const ns = new Date(Math.round((os.getTime() + deltaMs) / snap) * snap);
      const ne = new Date(ns.getTime() + (oe.getTime() - os.getTime()));

      const rowEl = (document.elementFromPoint(me.clientX, me.clientY) as HTMLElement | null)?.closest(
        '.oc-timeline-row'
      ) as HTMLElement | null;
      const resId = rowEl?.dataset.resourceId || evt.resourceId || null;

      latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedResourceId: resId, snappedStart: ns, snappedEnd: ne };
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
        onEventDrop?.(latest.evt, latest.snappedStart, latest.snappedEnd, latest.snappedResourceId || undefined);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginResizeStart = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    if (!canResizeEvent(evt, options)) return;
    e.stopPropagation();
    e.preventDefault();

    const os = new Date(evt.start);
    const oe = evt.end ? new Date(evt.end) : new Date(os.getTime() + 60 * 60000);

    const initialInteraction: InteractionState = {
      evt,
      type: 'resize-start',
      initialX: e.clientX,
      initialY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      snappedResourceId: evt.resourceId || null,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction;

    const onMove = (me: PointerEvent) => {
      const deltaMs = (me.clientX - e.clientX) / pxPerMs;
      const snap = 15 * 60000;
      let ns = new Date(Math.round((os.getTime() + deltaMs) / snap) * snap);

      if (ns.getTime() > oe.getTime() - 15 * 60000) {
        ns = new Date(oe.getTime() - 15 * 60000);
      }

      latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedStart: ns };
      setInteraction(latest);
    };

    const onUp = (me: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setInteraction(null);
      if (Math.abs(me.clientX - initialInteraction.initialX) > 4) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        onEventResize?.(latest.evt, latest.snappedStart, latest.snappedEnd);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginResizeEnd = (e: ReactMouseEvent, evt: CalendarEvent) => {
    if ((e as unknown as MouseEvent).button !== 0) return;
    if (!canResizeEvent(evt, options)) return;
    e.stopPropagation();
    e.preventDefault();

    const os = new Date(evt.start);
    const oe = evt.end ? new Date(evt.end) : new Date(os.getTime() + 60 * 60000);

    const initialInteraction: InteractionState = {
      evt,
      type: 'resize-end',
      initialX: e.clientX,
      initialY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      snappedResourceId: evt.resourceId || null,
      snappedStart: os,
      snappedEnd: oe
    };

    setInteraction(initialInteraction);
    let latest = initialInteraction;

    const onMove = (me: PointerEvent) => {
      const deltaMs = (me.clientX - e.clientX) / pxPerMs;
      const snap = 15 * 60000;
      let ne = new Date(Math.round((oe.getTime() + deltaMs) / snap) * snap);

      if (ne.getTime() < os.getTime() + 15 * 60000) {
        ne = new Date(os.getTime() + 15 * 60000);
      }

      latest = { ...latest, currentX: me.clientX, currentY: me.clientY, snappedEnd: ne };
      setInteraction(latest);
    };

    const onUp = (me: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setInteraction(null);
      if (Math.abs(me.clientX - initialInteraction.initialX) > 4) {
        justDragged.current = true;
        setTimeout(() => (justDragged.current = false), 0);
        onEventResize?.(latest.evt, latest.snappedStart, latest.snappedEnd);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  interface FlatResource extends CalendarResource {
    depth: number;
    hasChildren: boolean;
    isExpanded: boolean;
  }

  const flatResources = useMemo(() => {
    const childrenMap = new Map<string, CalendarResource[]>();
    const roots: CalendarResource[] = [];

    resources.forEach((r) => {
      if (r.parentId) {
        if (!childrenMap.has(r.parentId)) childrenMap.set(r.parentId, []);
        childrenMap.get(r.parentId)!.push(r);
      }
    });

    resources.forEach((r) => {
      const hasParent = r.parentId && resources.some((pr) => pr.id === r.parentId);
      if (!hasParent) roots.push(r);
    });

    const list: FlatResource[] = [];
    const traverse = (r: CalendarResource, depth: number) => {
      const children = childrenMap.get(r.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = !collapsedIds.has(r.id);
      list.push({ ...r, depth, hasChildren, isExpanded });
      if (hasChildren && isExpanded) {
        children.forEach((child) => traverse(child, depth + 1));
      }
    };

    roots.forEach((r) => traverse(r, 0));
    return list;
  }, [resources, collapsedIds]);

  const toggleExpand = (e: ReactMouseEvent, resId: string) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(resId)) {
        next.delete(resId);
      } else {
        next.add(resId);
      }
      return next;
    });
  };

  const { start, end, paddingTop, totalHeight } = useVirtual(scrollRef, flatResources.length, ROW_HEIGHT);
  const visibleResources = flatResources.slice(start, end);

  return (
    <div className="oc-view oc-timeline-view">
      <div className="oc-timeline-scroller" ref={scrollRef}>
        <div className="oc-timeline-grid" style={{ width: RES_COL_WIDTH + totalWidth }}>
          {/* 헤더 (sticky top) */}
          <div className="oc-timeline-header-row" style={{ height: ROW_HEIGHT }}>
            <div className="oc-timeline-corner" style={{ width: RES_COL_WIDTH }}>
              {t.resources}
            </div>
            {slots.map((slot, i) => (
              <div key={i} className="oc-timeline-slot-header" style={{ width: slotWidth }}>
                {slot.label}
              </div>
            ))}
          </div>

          {/* 본문 (가상화) */}
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${paddingTop}px)` }}>
              {visibleResources.map((r) => (
                <div className="oc-timeline-row" key={r.id} data-resource-id={r.id} style={{ height: ROW_HEIGHT }}>
                  <div
                    className="oc-timeline-res-cell"
                    style={{
                      width: RES_COL_WIDTH,
                      paddingLeft: `${10 + r.depth * 16}px`,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {r.hasChildren && (
                      <span
                        className="oc-resource-toggle-icon"
                        onClick={(e) => toggleExpand(e, r.id)}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-block',
                          width: '14px',
                          textAlign: 'center',
                          userSelect: 'none',
                          fontSize: '0.8em',
                          color: 'var(--oc-neutral-text-color)'
                        }}
                      >
                        {r.isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                    {!r.hasChildren && <span style={{ width: '14px' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="oc-resource-title">{r.title}</div>
                      {r.extendedProps?.subtitle && (
                        <div className="oc-resource-subtitle">{r.extendedProps.subtitle}</div>
                      )}
                    </div>
                  </div>
                  <div className="oc-timeline-lane" style={{ width: totalWidth }}>
                    {/* 슬롯 세로 격자 */}
                    <div className="oc-timeline-slots-bg">
                      {slots.map((_, i) => (
                        <div key={i} className="oc-timeline-slot-col" style={{ width: slotWidth }} />
                      ))}
                    </div>

                    {/* 배경 이벤트 음영 (가로 구간) */}
                    {(bgByResource.get(r.id) || []).flatMap((be) =>
                      placeBg(be).map((band, i) => (
                        <div
                          key={`${be.id}-${i}`}
                          className="oc-bg-event"
                          style={{
                            left: band.left,
                            width: band.width,
                            top: 0,
                            bottom: 0,
                            height: 'auto',
                            backgroundColor: be.color || 'var(--oc-bg-event-color)'
                          }}
                          title={be.title}
                        />
                      ))
                    )}

                    {/* Snap Guide */}
                    {interaction && interaction.snappedResourceId === r.id && (() => {
                      const guidePos = placeEvent({
                        ...interaction.evt,
                        start: interaction.snappedStart,
                        end: interaction.snappedEnd
                      });
                      if (!guidePos) return null;
                      return (
                        <div
                          className="oc-event-snap-guide"
                          style={{
                            left: guidePos.left,
                            width: guidePos.width,
                            top: 6,
                            height: ROW_HEIGHT - 12,
                            borderColor: interaction.evt.color || 'var(--oc-event-border-color)'
                          }}
                        />
                      );
                    })()}

                    {(eventsByResource.get(r.id) || []).map((evt) => {
                      const pos = placeEvent(evt);
                      if (!pos) return null;
                      const color = evt.color || 'var(--oc-event-bg-color)';
                      const isBeingInteracted = interaction?.evt.id === evt.id;
                      return (
                        <div
                          key={evt.id}
                          className={`oc-event oc-timeline-event${isBeingInteracted ? ' oc-event-dragging-original' : ''}`}
                          onPointerDown={(e) => { if (canMoveEvent(evt, options)) beginDrag(e, evt); }}
                          onClick={(e) => {
                            if (justDragged.current) return;
                            onEventClick?.(evt, e);
                          }}
                          style={{ left: pos.left, width: pos.width, backgroundColor: color, borderColor: color }}
                          title={evt.title}
                        >
                          {canResizeEvent(evt, options) && (
                            <div
                              className="oc-event-resizer oc-event-resizer-start"
                              onPointerDown={(e) => beginResizeStart(e, evt)}
                            />
                          )}
                          <span className="oc-event-title" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                            {evt.title}
                          </span>
                          {canResizeEvent(evt, options) && (
                            <div
                              className="oc-event-resizer oc-event-resizer-end"
                              onPointerDown={(e) => beginResizeEnd(e, evt)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
