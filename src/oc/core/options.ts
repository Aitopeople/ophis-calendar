/* src/oc/core/options.ts
 * 캘린더 동작/레이아웃 옵션.
 */

import type { CalendarViewType } from '../../types/calendar';

export interface BusinessHours {
  /** 업무 요일 (0=일 … 6=토) */
  daysOfWeek: number[];
  /** 업무 시작 'HH:mm' */
  startTime: string;
  /** 업무 종료 'HH:mm' */
  endTime: string;
}

export interface OcOptions {
  /** 주 시작 요일 (0=일 … 6=토) */
  firstDay: number;
  /** 주말(토/일) 표시 여부 */
  weekends: boolean;
  /** 주차(week number) 표시 */
  weekNumbers: boolean;
  /** timeGrid 시작 시각(시) */
  slotMinTime: number;
  /** timeGrid 끝 시각(시) */
  slotMaxTime: number;
  /** timeGrid 슬롯 길이(분) */
  slotDuration: number;
  /** 초기 스크롤 시각(시) */
  scrollTime: number;
  /** 가로:세로 비율 (높이 = 너비 / aspectRatio) */
  aspectRatio: number;
  /** 드래그/리사이즈 시 다른 이벤트와 겹침 허용 */
  eventOverlap: boolean;
  /** 업무시간 (false=표시 안 함) — 비업무시간 음영 */
  businessHours: BusinessHours | false;
  /** 이벤트 배치 제한 ('businessHours'=업무시간 밖으로 못 옮김) */
  eventConstraint: false | 'businessHours';
  /** 헤더 툴바에 표시할 뷰 버튼 (순서대로) */
  headerViews: CalendarViewType[];
  /** 이벤트 드래그/리사이즈 전역 허용 (이벤트별 editable이 우선) */
  editable: boolean;
  /** daygrid 셀당 최대 이벤트 수: number=고정, true=높이 기반 자동 */
  dayMaxEvents: number | true;
  /** 이벤트 시각 라벨 포매터 */
  eventTimeFormat: (date: Date) => string;
  /** 시간 슬롯 축 라벨 포매터 */
  slotLabelFormat: (hour: number, minute?: number) => string;
}

/** 기본 시각 포맷 — 컴팩트 am/pm (예: 10a, 1:30p) */
function defaultTimeFormat(date: Date): string {
  let h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'p' : 'a';
  h = h % 12 || 12;
  return `${h}${m ? ':' + String(m).padStart(2, '0') : ''}${ampm}`;
}

/** 기본 슬롯 라벨 — 컴팩트 am/pm (예: 1a, 12p) */
function defaultSlotLabel(hour: number, minute = 0): string {
  const ampm = hour >= 12 ? 'p' : 'a';
  const h = hour % 12 || 12;
  return `${h}${minute ? ':' + String(minute).padStart(2, '0') : ''}${ampm}`;
}

/** 이벤트가 편집 가능(드래그+리사이즈 공통 토대)한지 — 이벤트별 editable이 전역보다 우선 */
function isEventEditable(evt: { editable?: boolean }, opt: OcOptions): boolean {
  return evt.editable ?? opt.editable;
}
/** 이동(드래그)이 허용되는지 — startEditable > editable > 전역 */
export function canMoveEvent(evt: { editable?: boolean; startEditable?: boolean }, opt: OcOptions): boolean {
  return evt.startEditable ?? isEventEditable(evt, opt);
}
/** 길이 조절(리사이즈)이 허용되는지 — durationEditable > editable > 전역 */
export function canResizeEvent(evt: { editable?: boolean; durationEditable?: boolean }, opt: OcOptions): boolean {
  return evt.durationEditable ?? isEventEditable(evt, opt);
}

/** 헤더에 노출 가능한 뷰 버튼 후보 (view → 라벨 키) */
export const HEADER_VIEW_OPTIONS: { view: CalendarViewType; labelKey: string }[] = [
  { view: 'dayGridMonth', labelKey: 'month' },
  { view: 'timeGridWeek', labelKey: 'week' },
  { view: 'timeGridDay', labelKey: 'day' },
  { view: 'multiMonthYear', labelKey: 'year' },
  { view: 'listWeek', labelKey: 'list' },
  { view: 'resourceTimelineDay', labelKey: 'timeline' },
  { view: 'resourceTimeGridDay', labelKey: 'resourceTimeGrid' }
];

export const DEFAULT_OPTIONS: OcOptions = {
  firstDay: 0,
  weekends: true,
  weekNumbers: false,
  slotMinTime: 0,
  slotMaxTime: 24,
  slotDuration: 60,
  scrollTime: 7,
  aspectRatio: 1.35,
  eventOverlap: true,
  businessHours: false,
  eventConstraint: false,
  headerViews: HEADER_VIEW_OPTIONS.map((v) => v.view),
  editable: true,
  dayMaxEvents: true,
  eventTimeFormat: defaultTimeFormat,
  slotLabelFormat: defaultSlotLabel
};

const HM = (s: string): number => {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** 주어진 시작/종료가 업무시간(요일+시간) 안에 완전히 들어가는지 */
export function isWithinBusinessHours(start: Date, end: Date, bh: BusinessHours): boolean {
  const bStart = HM(bh.startTime);
  const bEnd = HM(bh.endTime);
  // 같은 날 안에서만 검사 (멀티데이는 각 날 모두 업무일+시간이어야 함)
  const dayMs = 86400000;
  const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const dEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  for (let t = d0; t <= dEnd; t += dayMs) {
    const d = new Date(t);
    if (!bh.daysOfWeek.includes(d.getDay())) return false;
  }
  const sMin = start.getHours() * 60 + start.getMinutes();
  const eMin = end.getHours() * 60 + end.getMinutes();
  return sMin >= bStart && (eMin <= bEnd || (end.getHours() === 0 && end.getMinutes() === 0));
}

export function resolveOptions(partial?: Partial<OcOptions>): OcOptions {
  return { ...DEFAULT_OPTIONS, ...(partial || {}) };
}
