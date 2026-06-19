/* src/types/calendar.ts */

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string; // Date or ISO string
  end?: Date | string;   // Date or ISO string
  allDay?: boolean;
  resourceId?: string;   // Linked resource (e.g. Room A, User B)
  resourceIds?: string[]; // Multiple resources if needed
  groupId?: string;
  color?: string;
  textColor?: string;
  /** 표시 모드: 'background'/'inverse-background'는 막대가 아닌 셀 배경 음영으로 렌더 */
  display?: 'auto' | 'block' | 'list-item' | 'background' | 'inverse-background';
  editable?: boolean;
  startEditable?: boolean;
  durationEditable?: boolean;
  resourceEditable?: boolean;
  extendedProps?: Record<string, any>;
  
  // Recurrence Rules
  daysOfWeek?: number[];   // 0 = Sunday, 1 = Monday, etc.
  startTime?: string;      // "HH:mm" e.g. "09:00"
  endTime?: string;        // "HH:mm" e.g. "10:30"
  startRecur?: Date | string;
  endRecur?: Date | string;
  /** RRULE 표준 문자열 (예: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE") */
  rrule?: string;
  /** rrule 사용 시 각 인스턴스 지속시간(분). 없으면 60분 */
  duration?: number;
  /** 반복에서 제외할 날짜들('YYYY-MM-DD'). 단일 인스턴스 편집 시 예외로 추가됨 */
  exdates?: string[];
}

export interface CalendarResource {
  id: string;
  title: string;
  parentId?: string; // Support hierarchical nested resources
  extendedProps?: Record<string, any>;
}

export type CalendarViewType =
  | 'dayGridMonth'
  | 'dayGridWeek'
  | 'dayGridDay'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'resourceTimeGridWeek'
  | 'resourceTimeGridDay'
  | 'resourceTimelineDay'
  | 'resourceTimelineWeek'
  | 'listMonth'
  | 'listWeek'
  | 'multiMonthYear';

export interface DateRange {
  start: Date;
  end: Date;
}
