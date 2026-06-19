/* 라이브러리 공개 진입점 (barrel) */

// 메인 컴포넌트
export { OcCalendar } from './oc/components/OcCalendar';

// 고급 사용(직접 Provider 구성 / 상태 접근)
export { OcProvider, useOc } from './oc/core/store';
export type { OcProviderProps, OcEventSource, OcState, OcAction } from './oc/core/store';

// 옵션 타입 + 편집 가능 여부 헬퍼
export type { OcOptions, BusinessHours } from './oc/core/options';
export { DEFAULT_OPTIONS, resolveOptions, canMoveEvent, canResizeEvent } from './oc/core/options';

// 다국어
export { getLocale, LOCALES } from './oc/core/locales';
export type { LocaleSettings } from './oc/core/locales';

// 데이터 타입
export type {
  CalendarEvent,
  CalendarResource,
  CalendarViewType,
  DateRange
} from './types/calendar';
