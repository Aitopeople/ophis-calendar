/* src/oc/core/locales.ts */

export interface LocaleSettings {
  today: string;
  month: string;
  week: string;
  day: string;
  year: string;
  list: string;
  timeline: string;
  resourceTimeGrid: string;
  prev: string;
  next: string;
  allDay: string;
  resources: string;
  noEvents: string;
  dialogEdit: string;
  dialogCreate: string;
  title: string;
  start: string;
  end: string;
  color: string;
  resource: string;
  none: string;
  delete: string;
  cancel: string;
  save: string;
  more: string;
  view: string;
  display: string;
  displayAuto: string;
  displayBlock: string;
  displayListItem: string;
  displayBackground: string;
  displayInverseBackground: string;
}

export const LOCALES: Record<string, LocaleSettings> = {
  ko: {
    today: '오늘',
    month: '월',
    week: '주',
    day: '일',
    year: '연',
    list: '목록',
    timeline: '타임라인',
    resourceTimeGrid: '리소스(시간)',
    prev: '이전',
    next: '다음',
    allDay: '종일',
    resources: '리소스',
    noEvents: '표시할 일정이 없습니다.',
    dialogEdit: '일정 수정',
    dialogCreate: '일정 등록',
    title: '제목',
    start: '시작',
    end: '종료',
    color: '색상',
    resource: '리소스',
    none: '(없음)',
    delete: '삭제',
    cancel: '취소',
    save: '저장',
    more: '개 더보기',
    view: '보기',
    display: '표시 방식',
    displayAuto: '자동',
    displayBlock: '막대',
    displayListItem: '목록형',
    displayBackground: '배경 음영',
    displayInverseBackground: '역배경 음영'
  },
  en: {
    today: 'Today',
    month: 'Month',
    week: 'Week',
    day: 'Day',
    year: 'Year',
    list: 'List',
    timeline: 'Timeline',
    resourceTimeGrid: 'Res-Time',
    prev: 'Prev',
    next: 'Next',
    allDay: 'all-day',
    resources: 'Resources',
    noEvents: 'No events to display.',
    dialogEdit: 'Edit Event',
    dialogCreate: 'Create Event',
    title: 'Title',
    start: 'Start',
    end: 'End',
    color: 'Color',
    resource: 'Resource',
    none: '(None)',
    delete: 'Delete',
    cancel: 'Cancel',
    save: 'Save',
    more: 'more',
    view: 'View',
    display: 'Display',
    displayAuto: 'Auto',
    displayBlock: 'Block',
    displayListItem: 'List item',
    displayBackground: 'Background',
    displayInverseBackground: 'Inverse background'
  }
};

export function getLocale(localeCode: string): LocaleSettings {
  return LOCALES[localeCode] || LOCALES.ko;
}
