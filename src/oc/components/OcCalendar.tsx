/* src/oc/components/OcCalendar.tsx
 * 캘린더 루트 — .oc 루트 + 툴바 + view-harness 라우팅.
 */

import { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { OcProvider, useOc } from '../core/store';
import type { OcProviderProps } from '../core/store';
import { buildDateProfile } from '../core/dateProfile';
import { formatDate, startOfWeek, endOfWeek, expandEvents, startOfDay } from '../../core/dateUtils';
import type { CalendarEvent } from '../../types/calendar';
import { OcToolbar } from './OcToolbar';
import { OcDayGridView } from '../views/daygrid/OcDayGridView';
import { OcTimeGridView } from '../views/timegrid/OcTimeGridView';
import { OcListView } from '../views/list/OcListView';
import { OcTimelineView } from '../views/timeline/OcTimelineView';
import { OcMultiMonthView } from '../views/multimonth/OcMultiMonthView';
import { OcResourceTimeGridView } from '../views/resourcetimegrid/OcResourceTimeGridView';
import { OcEventDialog } from '../dialog/OcEventDialog';
import { OcSettingsPanel } from '../settings/OcSettingsPanel';
import { isBackgroundEvent } from '../core/daygridSeg';
import { isWithinBusinessHours, canMoveEvent, canResizeEvent } from '../core/options';
import '../styles/tokens.css';
import '../styles/oc.css';

function getTitle(view: string, date: Date, locale: string): string {
  if (view === 'multiMonthYear') {
    return formatDate(date, { year: 'numeric' }, locale);
  }
  if (view === 'dayGridMonth' || view === 'listMonth') {
    return formatDate(date, { year: 'numeric', month: 'long' }, locale);
  }
  if (view.includes('Week')) {
    const s = startOfWeek(date, 0);
    const e = endOfWeek(date, 0);
    if (s.getMonth() === e.getMonth()) {
      return `${formatDate(s, { year: 'numeric', month: 'long' }, locale)} (${s.getDate()}–${e.getDate()})`;
    }
    return `${formatDate(s, { month: 'short', day: 'numeric' }, locale)} – ${formatDate(e, { month: 'short', day: 'numeric' }, locale)}`;
  }
  return formatDate(date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }, locale);
}

function OcCalendarInner() {
  const { state, dispatch, options } = useOc();
  const { currentView, currentDate, locale, events, resources } = state;

  // 너비를 측정해 뷰 높이를 계산 (뷰포트를 채우지 않고 너비 기준 높이)
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewHeight, setViewHeight] = useState(0);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setViewHeight(Math.round(el.clientWidth / options.aspectRatio));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [options.aspectRatio]);

  const dateProfile = useMemo(
    () => buildDateProfile(currentView, currentDate, options.firstDay, options.weekends),
    [currentView, currentDate, options.firstDay, options.weekends]
  );
  const title = useMemo(() => getTitle(currentView, currentDate, locale), [currentView, currentDate, locale]);

  // 반복일정을 표시 범위에 맞춰 전개
  const displayEvents = useMemo(
    () => expandEvents(events, dateProfile.renderRange),
    [events, dateProfile]
  );

  // 설정 패널 상태
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>(undefined);
  const [defaultEnd, setDefaultEnd] = useState<Date | undefined>(undefined);
  const [defaultResourceId, setDefaultResourceId] = useState<string | undefined>(undefined);

  const openForEdit = (evt: CalendarEvent) => {
    // 반복 인스턴스면 마스터 원본을 찾아 편집
    const masterId = evt.extendedProps?.masterEventId as string | undefined;
    const target = masterId ? events.find((e) => e.id === masterId) || evt : evt;
    setEditing(target);
    setDefaultStart(undefined);
    setDefaultEnd(undefined);
    setDefaultResourceId(undefined);
    setDialogOpen(true);
  };

  const openForCreate = (day: Date) => {
    const s = startOfDay(day);
    s.setHours(9, 0, 0, 0);
    setEditing(null);
    setDefaultStart(s);
    setDefaultEnd(undefined);
    setDefaultResourceId(undefined);
    setDialogOpen(true);
  };

  const handleSelectRange = (range: { start: Date; end: Date }, resourceId?: string) => {
    setEditing(null);
    setDefaultStart(range.start);
    setDefaultEnd(range.end);
    setDefaultResourceId(resourceId);
    setDialogOpen(true);
  };

  const handleSave = (evt: CalendarEvent) => {
    if (events.some((e) => e.id === evt.id)) {
      dispatch({ type: 'UPDATE_EVENT', payload: evt });
    } else {
      dispatch({ type: 'ADD_EVENT', payload: evt });
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_EVENT', payload: id });
    setDialogOpen(false);
  };

  // 제한 위반 검사 (eventConstraint='businessHours')
  const violatesConstraint = (ns: Date, ne?: Date) => {
    if (options.eventConstraint !== 'businessHours' || !options.businessHours) return false;
    return !isWithinBusinessHours(ns, ne || new Date(ns.getTime() + 60 * 60000), options.businessHours);
  };

  // 충돌 검사 (eventOverlap=false일 때 drop/resize 차단)
  const hasConflict = (targetId: string, resourceId: string | undefined, ns: Date, ne?: Date) => {
    const nsT = ns.getTime();
    const neT = (ne || ns).getTime();
    return displayEvents.some((e) => {
      if (e.id === targetId) return false;
      if ((e.extendedProps?.masterEventId as string | undefined) === targetId) return false;
      if (isBackgroundEvent(e)) return false;
      // 리소스가 지정된 경우(타임라인) 같은 리소스끼리만 충돌로 본다
      if (resourceId !== undefined && resourceId !== null && e.resourceId !== resourceId) return false;
      const es = new Date(e.start).getTime();
      const ee = e.end ? new Date(e.end).getTime() : es;
      return nsT < ee && es < neT; // 시간 범위 교차
    });
  };

  // 반복 인스턴스 단일 편집 → 마스터에 예외(exdate) 추가 + 독립 이벤트 생성 (단일 occurrence만 수정)
  const splitRecurrence = (
    master: CalendarEvent,
    exDate: string,
    newStart: Date,
    newEnd: Date | undefined,
    newResourceId?: string
  ) => {
    dispatch({
      type: 'UPDATE_EVENT',
      payload: { ...master, exdates: [...(master.exdates || []), exDate] }
    });
    dispatch({
      type: 'ADD_EVENT',
      payload: {
        ...master,
        id: `${master.id}_ex_${exDate}`,
        start: newStart,
        end: newEnd,
        resourceId: newResourceId !== undefined ? newResourceId : master.resourceId,
        // 반복 정의 제거 → 단발 이벤트
        rrule: undefined,
        daysOfWeek: undefined,
        startTime: undefined,
        endTime: undefined,
        startRecur: undefined,
        endRecur: undefined,
        duration: undefined,
        exdates: undefined,
        extendedProps: { ...master.extendedProps }
      }
    });
  };

  const handleEventDrop = (evt: CalendarEvent, newStart: Date, newEnd?: Date, newResourceId?: string) => {
    if (!canMoveEvent(evt, options)) return; // editable/startEditable 미허용
    const masterId = evt.extendedProps?.masterEventId as string | undefined;
    const targetId = masterId || evt.id;
    const original = events.find((e) => e.id === targetId);
    if (!original) return;
    if (violatesConstraint(newStart, newEnd)) return; // 업무시간 밖 → 거부
    if (!options.eventOverlap && hasConflict(targetId, newResourceId, newStart, newEnd)) {
      return; // 겹침 금지 → 원위치 복귀
    }
    const exDate = evt.extendedProps?.recurrenceDateStr as string | undefined;
    if (masterId && exDate) {
      splitRecurrence(original, exDate, newStart, newEnd, newResourceId);
      return;
    }
    dispatch({
      type: 'UPDATE_EVENT',
      payload: {
        ...original,
        start: newStart,
        end: newEnd,
        resourceId: newResourceId !== undefined ? newResourceId : original.resourceId
      }
    });
  };

  const handleEventResize = (evt: CalendarEvent, newStart: Date, newEnd?: Date) => {
    if (!canResizeEvent(evt, options)) return; // editable/durationEditable 미허용
    const masterId = evt.extendedProps?.masterEventId as string | undefined;
    const targetId = masterId || evt.id;
    const original = events.find((e) => e.id === targetId);
    if (!original) return;
    if (violatesConstraint(newStart, newEnd)) return;
    if (!options.eventOverlap && hasConflict(targetId, original.resourceId, newStart, newEnd)) {
      return;
    }
    const exDate = evt.extendedProps?.recurrenceDateStr as string | undefined;
    if (masterId && exDate) {
      splitRecurrence(original, exDate, newStart, newEnd, original.resourceId);
      return;
    }
    dispatch({ type: 'UPDATE_EVENT', payload: { ...original, start: newStart, end: newEnd } });
  };

  const renderView = () => {
    const common = { dateProfile, locale, events: displayEvents, onEventClick: openForEdit };
    switch (currentView) {
      case 'dayGridMonth':
      case 'dayGridWeek':
      case 'dayGridDay':
        return (
          <OcDayGridView
            {...common}
            onDayClick={openForCreate}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onSelectRange={handleSelectRange}
          />
        );
      case 'timeGridWeek':
      case 'timeGridDay':
        return (
          <OcTimeGridView
            {...common}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            onSelectRange={handleSelectRange}
          />
        );
      case 'listMonth':
      case 'listWeek':
        return <OcListView {...common} />;
      case 'multiMonthYear':
        return <OcMultiMonthView locale={locale} events={displayEvents} />;
      case 'resourceTimeGridDay':
      case 'resourceTimeGridWeek':
        return (
          <OcResourceTimeGridView
            locale={locale}
            events={displayEvents}
            onEventClick={openForEdit}
            onSelectRange={handleSelectRange}
          />
        );
      case 'resourceTimelineDay':
        return (
          <OcTimelineView
            isWeek={false}
            locale={locale}
            events={displayEvents}
            onEventClick={openForEdit}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
          />
        );
      case 'resourceTimelineWeek':
        return (
          <OcTimelineView
            isWeek
            locale={locale}
            events={displayEvents}
            onEventClick={openForEdit}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
          />
        );
      default:
        return <OcDayGridView {...common} onDayClick={openForCreate} />;
    }
  };

  return (
    <div className="oc oc-theme-standard oc-direction-ltr" ref={rootRef}>
      <OcToolbar title={settingsOpen ? '설정' : title} onOpenSettings={() => setSettingsOpen((s) => !s)} />
      <div className="oc-view-harness" style={{ height: viewHeight || undefined }}>
        {settingsOpen ? <OcSettingsPanel onClose={() => setSettingsOpen(false)} /> : renderView()}
      </div>
      <OcEventDialog
        open={dialogOpen}
        event={editing}
        defaultStart={defaultStart}
        defaultEnd={defaultEnd}
        defaultResourceId={defaultResourceId}
        resources={resources}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

export function OcCalendar(props: Omit<OcProviderProps, 'children'>) {
  return (
    <OcProvider {...props}>
      <OcCalendarInner />
    </OcProvider>
  );
}
