/* src/oc/core/daygridSeg.ts
 * daygrid 멀티데이 세그먼트 + 레벨 스태킹 알고리즘.
 * 한 주(7일) 안에서 이벤트를 세그먼트로 자르고, 겹치지 않게 레벨(행 슬롯)에 배치한다.
 */

import type { CalendarEvent } from '../../types/calendar';

/** 배경 이벤트 여부 (막대가 아닌 셀 음영으로 렌더) */
export function isBackgroundEvent(evt: CalendarEvent): boolean {
  return evt.display === 'background' || evt.display === 'inverse-background';
}

/** 종일(all-day) 이벤트 여부 — 시간 그리드에서 종일 행으로 분류하는 기준 */
export function isAllDayEvent(evt: CalendarEvent): boolean {
  return !!evt.allDay;
}

export interface WeekSeg {
  evt: CalendarEvent;
  startCol: number; // 주 내 시작 열 0..6
  endCol: number; // 주 내 끝 열 0..6 (포함)
  isStart: boolean; // 이번 주에서 실제로 시작 (모서리/제목 처리용)
  isEnd: boolean; // 이번 주에서 실제로 끝
  level: number; // 세로 레벨(슬롯)
}

/** 한 주의 7일에 대해 세그먼트를 만들고 레벨을 배정한다 */
export function buildWeekSegs(events: CalendarEvent[], weekDays: Date[]): WeekSeg[] {
  if (!weekDays.length) return [];
  const cols = weekDays.length; // 보통 7, 주말 숨김/주·일 뷰에선 더 적을 수 있음
  const lastDay = weekDays[cols - 1];
  const wStart = new Date(weekDays[0].getFullYear(), weekDays[0].getMonth(), weekDays[0].getDate(), 0, 0, 0, 0);
  const wEnd = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999);
  // 각 컬럼(=weekDays[i]) 날짜 경계 미리 계산
  const colStart = weekDays.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime());
  const colEnd = weekDays.map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime());

  const segs: WeekSeg[] = [];
  for (const evt of events) {
    const s = new Date(evt.start);
    const e = evt.end ? new Date(evt.end) : s;
    if (s > wEnd || e < wStart) continue; // 이 주와 겹치지 않음
    // 이벤트가 덮는 컬럼 범위 스캔 (불연속 주말 제거에도 안전)
    const sT = s.getTime();
    const eT = e.getTime();
    let startCol = -1;
    let endCol = -1;
    for (let i = 0; i < cols; i++) {
      if (sT <= colEnd[i] && eT >= colStart[i]) {
        if (startCol < 0) startCol = i;
        endCol = i;
      }
    }
    if (startCol < 0) continue;
    segs.push({
      evt,
      startCol,
      endCol,
      isStart: s >= wStart,
      isEnd: e <= wEnd,
      level: 0
    });
  }

  // 정렬: 긴 막대 먼저(위 레벨) → 시작 열 → 시작 시각
  segs.sort((a, b) => {
    const spanA = a.endCol - a.startCol;
    const spanB = b.endCol - b.startCol;
    if (spanB !== spanA) return spanB - spanA;
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return new Date(a.evt.start).getTime() - new Date(b.evt.start).getTime();
  });

  // 그리디 레벨 배정: 각 세그를 [startCol..endCol]이 모두 빈 가장 낮은 레벨에 둔다
  const occupied: boolean[][] = [];
  for (const seg of segs) {
    let lvl = 0;
    for (;;) {
      if (!occupied[lvl]) occupied[lvl] = new Array(cols).fill(false);
      let free = true;
      for (let c = seg.startCol; c <= seg.endCol; c++) {
        if (occupied[lvl][c]) {
          free = false;
          break;
        }
      }
      if (free) {
        for (let c = seg.startCol; c <= seg.endCol; c++) occupied[lvl][c] = true;
        seg.level = lvl;
        break;
      }
      lvl++;
    }
  }

  return segs;
}
