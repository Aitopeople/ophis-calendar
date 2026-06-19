# Ophis Calendar

여러 뷰(월·주·일·연·목록·리소스 타임라인·리소스 타임그리드)를 제공하는 독립형 React 캘린더 컴포넌트입니다.
모든 클래스·디자인 토큰은 **`oc-*`**(Our Calendar) 네임스페이스를 사용하며, 외부 캘린더 라이브러리에 의존하지 않습니다.

- **피어 의존성**: `react` / `react-dom` (>=18) — 나머지(`rrule` 등)는 번들에 포함
- **7개 뷰**: 월 / 주 / 일 / 연 / 목록 / 리소스 타임라인 / 리소스 타임그리드
- **기능**: 드래그·리사이즈, 반복 일정 전개, 배경 이벤트, 업무시간 음영, 일정 등록/수정 다이얼로그, 런타임 설정 패널, 한/영 다국어
- **번들**: ESM(`ophis-calendar.js`) + CJS(`ophis-calendar.cjs`) + 타입(`.d.ts`) + 스타일(`style.css`) 제공

---

## 목차

1. [설치 및 사용 (소비 프로젝트)](#1-설치-및-사용-소비-프로젝트)
2. [기본 사용법](#2-기본-사용법)
3. [뷰(View) 종류](#3-뷰view-종류)
4. [이벤트(Event)](#4-이벤트event)
   - [일반 이벤트](#41-일반-이벤트)
   - [반복 일정](#42-반복-일정)
   - [배경 이벤트 (display)](#43-배경-이벤트-display) ⭐
5. [리소스(Resource)](#5-리소스resource)
6. [옵션(Options)](#6-옵션options)
7. [설정 패널 (⚙ 아이콘)](#7-설정-패널--아이콘)
8. [툴바와 뷰 전환](#8-툴바와-뷰-전환)
9. [다국어(Localization)](#9-다국어localization)
10. [테마 / 스타일 커스터마이징](#10-테마--스타일-커스터마이징)
11. [상호작용(드래그·리사이즈·선택)](#11-상호작용드래그리사이즈선택)
12. [프로젝트 구조](#12-프로젝트-구조)
13. [알아둘 점 / 제약](#13-알아둘-점--제약)

---

## 1. 설치 및 사용 (소비 프로젝트)

어떤 TypeScript/React(>=18) 프로젝트에서든 패키지로 설치해 사용합니다.

```bash
npm install ophis-calendar
# peer: react, react-dom (>=18) 가 프로젝트에 이미 있어야 함
```

```tsx
import { OcCalendar } from 'ophis-calendar';
import type { CalendarEvent } from 'ophis-calendar';
import 'ophis-calendar/style.css'; // ⚠️ 스타일 1회 import 필수 (앱 진입점에서 한 번)

const events: CalendarEvent[] = [
  { id: 'e1', title: '팀 미팅', start: new Date(2026, 5, 19, 10, 0), end: new Date(2026, 5, 19, 11, 0), color: '#3b82f6' },
];

export function App() {
  return <OcCalendar initialEvents={events} initialView="dayGridMonth" locale="ko" />;
}
```

- **CSS는 자동 주입되지 않습니다.** 앱 어딘가에서 `import 'ophis-calendar/style.css'`를 한 번 해주세요(보통 진입점).
- ESM·CJS 듀얼 패키지 + 타입 정의(`.d.ts`) 포함이라 Vite/Next/webpack 등 어디서든 동작합니다.
- 로컬 미설치 상태로 빠르게 한 프로젝트에 넣으려면 `src/oc/`, `src/core/dateUtils.ts`, `src/types/calendar.ts`를 복사해 넣고 `OcCalendar`를 import해도 됩니다.

### 이 저장소에서 개발/빌드

```bash
npm install      # 의존성 설치
npm run dev      # 데모 플레이그라운드 (http://localhost:5173)
npm run build    # 라이브러리 빌드 → dist/ (JS + d.ts + style.css)
npm run lint     # ESLint
```

---

## 2. 기본 사용법

`OcCalendar` 컴포넌트 하나만 렌더하면 됩니다. 데모 데이터는 포함돼 있지 않으므로(빈 캘린더로 시작), `initialEvents` / `initialResources`로 데이터를 주입합니다.

```tsx
import { OcCalendar } from 'ophis-calendar';
import type { CalendarEvent, CalendarResource } from 'ophis-calendar';
import 'ophis-calendar/style.css';

const events: CalendarEvent[] = [
  { id: 'e1', title: '팀 미팅', start: new Date(2026, 5, 19, 10, 0), end: new Date(2026, 5, 19, 11, 0), color: '#3b82f6' },
];

function App() {
  return (
    <OcCalendar
      initialEvents={events}
      initialView="dayGridMonth"
      locale="ko"
    />
  );
}
```

### `OcCalendar` props

| Prop | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `initialDate` | `Date` | 오늘 | 처음 표시할 날짜 |
| `initialView` | `CalendarViewType` | `'dayGridMonth'` | 처음 표시할 뷰 |
| `initialEvents` | `CalendarEvent[]` | `[]` | 초기 이벤트 |
| `eventSources` | `OcEventSource[]` | — | 추가 이벤트 소스(배열 / 함수 / JSON URL). `initialEvents`와 병합 |
| `initialResources` | `CalendarResource[]` | `[]` | 리소스(타임라인·리소스뷰에서 사용) |
| `locale` | `string` | `'ko'` | `'ko'` 또는 `'en'` |
| `options` | `Partial<OcOptions>` | — | 동작/레이아웃 옵션 ([6장](#6-옵션options)) |

> **이벤트 상태는 컴포넌트 내부에서 관리**됩니다. 등록/수정/삭제는 셀 클릭으로 열리는 다이얼로그로 처리되며, 외부에서 동적으로 주입하려면 `eventSources`(함수/URL)를 사용하세요.

### `eventSources` 예시

```tsx
<OcCalendar
  eventSources={[
    staticArray,                                   // CalendarEvent[]
    () => fetch('/api/events').then(r => r.json()), // 함수(동기/비동기)
    '/feed/events.json',                            // JSON 피드 URL
  ]}
/>
```

---

## 3. 뷰(View) 종류

`initialView` 또는 툴바 드롭다운으로 전환합니다.

| `CalendarViewType` | 라벨(ko) | 설명 |
|---|---|---|
| `dayGridMonth` | 월 | 월 단위 그리드 (멀티데이 막대, "+N 더보기" 팝오버) |
| `timeGridWeek` | 주 | 주 단위 세로 시간축 |
| `timeGridDay` | 일 | 하루 세로 시간축 |
| `multiMonthYear` | 연 | 연 단위 미니 달력 12개(이벤트 막대 + "+N" 오버플로) |
| `listWeek` / `listMonth` | 목록 | 일정 리스트 |
| `resourceTimelineDay` / `resourceTimelineWeek` | 타임라인 | 가로 시간축 + 리소스 행(계층/가상화 지원) |
| `resourceTimeGridDay` / `resourceTimeGridWeek` | 리소스(시간) | 세로 시간축 + 리소스 컬럼 |

> 리소스 계열 뷰(`resource*`)는 `initialResources`가 있어야 의미가 있습니다.

---

## 4. 이벤트(Event)

### `CalendarEvent` 전체 필드

```ts
interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;        // Date 또는 ISO 문자열
  end?: Date | string;         // 생략 시 1시간
  allDay?: boolean;
  resourceId?: string;         // 연결 리소스(리소스 뷰)
  resourceIds?: string[];
  groupId?: string;
  color?: string;              // 배경/막대 색
  textColor?: string;
  display?: 'auto' | 'block' | 'list-item' | 'background' | 'inverse-background';
  editable?: boolean;
  startEditable?: boolean;
  durationEditable?: boolean;
  resourceEditable?: boolean;
  extendedProps?: Record<string, any>;

  // 반복 일정 (둘 중 한 방식)
  daysOfWeek?: number[];       // 0=일 … 6=토
  startTime?: string;          // 'HH:mm'
  endTime?: string;            // 'HH:mm'
  startRecur?: Date | string;  // 반복 시작 경계
  endRecur?: Date | string;    // 반복 종료 경계
  rrule?: string;              // RRULE 표준 반복 문자열
  duration?: number;           // rrule 인스턴스 길이(분, 기본 60)
  exdates?: string[];          // 반복 제외일('YYYY-MM-DD') — 단일 인스턴스 편집 시 자동 추가
}
```

### 4.1 일반 이벤트

```ts
{ id: 'e1', title: '미팅', start: new Date(2026,5,19,10,0), end: new Date(2026,5,19,11,0), color: '#3b82f6' }
```

- `end`를 생략하면 1시간으로 처리됩니다.
- `allDay: true`면 종일 행/멀티데이 막대로 렌더됩니다. 시간 이벤트가 **자정을 넘겨도**(예: 22:00–03:00) 시간 그리드의 시간축에 표시됩니다(종일 행으로 가지 않음).
- 편집 제어: 이벤트별 `editable: false`면 드래그·리사이즈 불가, `startEditable: false`면 이동만 금지, `durationEditable: false`면 길이 조절만 금지. (전역은 `options.editable`)

### 4.2 반복 일정

표시 범위에 맞춰 인스턴스가 자동 전개됩니다(`expandEvents`). 다이얼로그로 인스턴스를 편집하면 원본(master)을 수정합니다. **인스턴스를 드래그/리사이즈하면 그 한 번만 분리됩니다** — 원본에 해당 날짜가 `exdates`(제외일)로 추가되고, 옮긴 일정은 독립 이벤트로 생성됩니다(단일 occurrence만 편집). 나머지 반복은 그대로 유지됩니다.

**(A) 요일 기반 (`daysOfWeek`)**

```ts
{
  id: 'scrum', title: '데일리 스크럼',
  start: new Date(2026,5,19,8,0),  // dtstart(시각 기준)
  daysOfWeek: [1,2,3,4,5],          // 월~금
  startTime: '08:00', endTime: '08:15',
  startRecur: new Date(2026,5,1),   // (선택) 반복 시작
  endRecur:   new Date(2026,6,1),   // (선택) 반복 종료
}
```

**(B) RRULE 표준 문자열 (`rrule`)**

```ts
{
  id: 'biweekly', title: '격주 미팅',
  start: new Date(2026,5,19,9,0),
  rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR',
  duration: 60,   // 분
}
```

> 잘못된 RRULE 문자열은 조용히 무시됩니다(크래시 없음).

### 4.3 배경 이벤트 (`display`) ⭐

`display` 필드로 이벤트가 **막대**로 그려질지 **셀/시간대 배경 음영**으로 그려질지 결정합니다. 휴무·행사·점검·업무시간 같은 "구간"을 시각적으로 표현할 때 사용합니다.

| `display` 값 | 동작 |
|---|---|
| `'auto'` (기본) | 표준 막대 이벤트 (`auto`는 저장 시 생략됨) |
| `'block'` | 막대 |
| `'list-item'` | 목록형(점) |
| **`'background'`** | 이벤트가 **덮는** 날/시간대를 색으로 음영 |
| **`'inverse-background'`** | 이벤트가 **덮지 않는** 날/시간대를 음영 (예: 업무시간만 비우고 나머지 음영) |

**예시 1 — 며칠간 행사 음영(전 리소스 적용)**

```ts
{
  id: 'bg1', title: '워크숍 기간',
  start: new Date(2026,5,21), end: new Date(2026,5,24), // end는 exclusive 성격: 23일까지면 24일
  display: 'background',
  color: '#8fdf82',
}
```

**예시 2 — 특정 리소스의 점검 시간대만 음영**

```ts
{
  id: 'bg2', title: '서버 점검',
  start: new Date(2026,5,19,13,0), end: new Date(2026,5,19,17,0),
  display: 'background', resourceId: 'server_a', color: '#fca5a5',
}
```

**예시 3 — 업무시간(9–18시)만 남기고 나머지 음영(inverse)**

```ts
{
  id: 'ibg1', title: '업무시간',
  start: new Date(2026,5,19,9,0), end: new Date(2026,5,19,18,0),
  display: 'inverse-background', resourceId: 'dev_a', color: '#cbd5e1',
}
```

**적용 범위**

- 배경 이벤트에 `resourceId`가 **있으면** 해당 리소스의 행/열에만, **없으면** 모든 리소스에 적용됩니다.
- 4개 뷰 계열 모두에서 `background` / `inverse-background`가 동작합니다(월/주 그리드, 시간 그리드, 리소스 타임그리드, 리소스 타임라인). 연(multiMonth) 뷰는 배경 이벤트를 표시하지 않습니다.

**UI로 만들기**: 빈 셀을 클릭해 일정 등록 다이얼로그를 열고, **"표시 방식"** 드롭다운에서 선택하면 됩니다. 기존 이벤트를 수정해도 `display`가 보존됩니다.

> ⚠️ **배경 이벤트는 클릭으로 편집/삭제할 수 없습니다.** 음영 레이어는 `pointer-events: none`이라 클릭이 통과합니다(클릭 이벤트가 발생하지 않음). 한번 배경 이벤트로 만들면 UI에서 다시 열 수 없으므로, 되돌리려면 `initialEvents` 데이터에서 직접 수정하세요. (목록 뷰 편집 등 보완책은 [13장](#13-알아둘-점--제약) 참고)

---

## 5. 리소스(Resource)

리소스 계열 뷰(타임라인 / 리소스 시간그리드)에서 행·열로 쓰입니다. `parentId`로 계층(부모-자식)을 구성할 수 있습니다.

```ts
interface CalendarResource {
  id: string;
  title: string;
  parentId?: string;                  // 계층 구성
  extendedProps?: Record<string, any>; // 예: { subtitle: '4층 회의실' }
}
```

```ts
const resources: CalendarResource[] = [
  { id: 'rooms', title: '회의실 전체' },
  { id: 'room_a', title: '회의실 A', parentId: 'rooms', extendedProps: { subtitle: '4층, 빔프로젝터' } },
  { id: 'room_b', title: '회의실 B', parentId: 'rooms' },
  { id: 'server_a', title: '클라우드 인스턴스 α' },
];
```

- 타임라인 뷰에서 부모 행은 ▼/▶ 토글로 접고 펼 수 있습니다.
- `extendedProps.subtitle`은 리소스명 아래 보조 텍스트로 표시됩니다.
- `resourceId`가 없는 이벤트는 리소스 타임라인에 표시되지 않습니다(배경 이벤트 제외).

---

## 6. 옵션(Options)

`options` prop으로 전달합니다. 런타임에는 ⚙ 설정 패널로도 조정됩니다.

```tsx
<OcCalendar
  initialEvents={events}
  options={{
    firstDay: 1,                // 월요일 시작
    slotMinTime: 8,
    slotMaxTime: 20,
    businessHours: { daysOfWeek: [1,2,3,4,5], startTime: '09:00', endTime: '18:00' },
    eventConstraint: 'businessHours',
  }}
/>
```

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `firstDay` | `number` | `0` | 주 시작 요일 (0=일 … 6=토) |
| `weekends` | `boolean` | `true` | 주말 표시 |
| `weekNumbers` | `boolean` | `false` | 주차 번호 표시 |
| `slotMinTime` | `number` | `0` | 시간 그리드 시작 시각(시) |
| `slotMaxTime` | `number` | `24` | 시간 그리드 끝 시각(시) |
| `slotDuration` | `number` | `60` | 슬롯 길이/스냅 단위(분): 5·10·15·30·60 |
| `scrollTime` | `number` | `7` | 초기 스크롤 시각(시) |
| `aspectRatio` | `number` | `1.35` | 가로:세로 비율 (높이 = 너비 / 비율) |
| `eventOverlap` | `boolean` | `true` | 드래그/리사이즈 시 이벤트 겹침 허용 |
| `businessHours` | `BusinessHours \| false` | `false` | 업무시간 음영 (비업무 요일/시간 회색 처리) |
| `eventConstraint` | `false \| 'businessHours'` | `false` | `'businessHours'`면 업무시간 밖으로 이동 금지 |
| `headerViews` | `CalendarViewType[]` | 7개 전부 | 툴바 뷰 드롭다운에 노출할 뷰 목록(순서대로) |
| `editable` | `boolean` | `true` | 드래그/리사이즈 전역 허용. 이벤트별 `editable`/`startEditable`/`durationEditable`이 우선 |
| `dayMaxEvents` | `number \| true` | `true` | 월 셀당 최대 이벤트 줄 수. `true`=셀 높이 기반 자동, 숫자=고정(초과분은 "+N 더보기") |
| `eventTimeFormat` | `(date) => string` | 컴팩트 am/pm | 이벤트 시각 라벨 포매터 |
| `slotLabelFormat` | `(hour, minute?) => string` | 컴팩트 am/pm | 시간축 슬롯 라벨 포매터 |

```ts
interface BusinessHours {
  daysOfWeek: number[];  // 0=일 … 6=토
  startTime: string;     // 'HH:mm'
  endTime: string;       // 'HH:mm'
}
```

---

## 7. 설정 패널 (⚙ 아이콘)

툴바 우측 ⚙ 아이콘을 누르면 런타임 설정 패널이 열립니다. 다음을 즉시 조정할 수 있습니다.

- **일반**: 언어(ko/en), 주 시작 요일, 주말 표시, 주차 번호, 가로:세로 비율
- **헤더 뷰 버튼**: 드롭다운에 노출할 뷰 on/off (`headerViews`)
- **시간 그리드**: 시작/끝 시각, 슬롯·스냅(분), 초기 스크롤 시각
- **상호작용**: 이벤트 겹침 허용, 업무시간 밖 이동 금지
- **업무시간(음영)**: 표시 on/off, 업무 요일, 시작/종료 시각

---

## 8. 툴바와 뷰 전환

- **왼쪽**: 이전(←) / 다음(→) / 오늘 버튼
- **가운데**: 현재 기간 제목
- **오른쪽**: **뷰 선택 드롭다운** + ⚙ 설정

> 뷰 전환은 버튼 그룹이 아니라 **단일 드롭다운**(`<select>`)으로 제공됩니다. 뷰 개수가 늘어도 폭이 고정되어 툴바가 깨지지 않으며, 모바일·키보드·접근성에 유리합니다. 노출 목록과 순서는 `headerViews` 옵션으로 제어합니다.

---

## 9. 다국어(Localization)

`locale` prop 또는 설정 패널에서 `'ko'` / `'en'`을 선택합니다. 라벨은 `src/oc/core/locales.ts`의 `LOCALES`에 정의돼 있습니다.

새 언어를 추가하려면 `LOCALES`에 동일한 `LocaleSettings` 키를 가진 항목을 추가하면 됩니다(없는 코드는 `ko`로 폴백).

```ts
// src/oc/core/locales.ts
export const LOCALES: Record<string, LocaleSettings> = {
  ko: { today: '오늘', month: '월', /* … */ display: '표시 방식', /* … */ },
  en: { today: 'Today', month: 'Month', /* … */ display: 'Display', /* … */ },
  // ja: { … }  ← 추가 가능
};
```

---

## 10. 테마 / 스타일 커스터마이징

스타일은 CSS 변수(`--oc-*`) 기반이며 `src/oc/styles/tokens.css`에 정의돼 있습니다. 루트 `.oc` 또는 상위에서 변수를 덮어쓰면 테마가 바뀝니다.

자주 쓰는 변수:

```css
.oc {
  --oc-event-bg-color: #3788d8;       /* 기본 이벤트 색 */
  --oc-border-color: #ddd;
  --oc-today-bg-color: ...;           /* 오늘 셀 배경 */
  --oc-now-indicator-color: ...;      /* 현재시각 표시선 */
  --oc-bg-event-color: ...;           /* 배경 이벤트 기본색 */
  --oc-bg-event-opacity: 0.3;         /* 배경 이벤트 투명도 */
  --oc-non-business-color: ...;       /* 비업무시간 음영색 */
}
```

> 배경 이벤트가 너무 옅거나 진하면 `--oc-bg-event-opacity`로 조정하세요. 개별 이벤트 색은 `color` 필드로 지정합니다.

---

## 11. 상호작용(드래그·리사이즈·선택)

- **이벤트 드래그**: 시간 그리드/타임라인에서 이동(시간·리소스 변경). 15분 스냅.
- **리사이즈**: 이벤트 양끝 핸들로 길이 조정.
- **빈 영역 클릭/드래그**: 일정 등록 다이얼로그 열기(범위 선택 지원).
- **제약**:
  - `eventOverlap: false` → 겹치는 위치로 드롭/리사이즈 차단(원위치 복귀).
  - `eventConstraint: 'businessHours'` → 업무시간 밖으로 이동 차단.
- 반복 일정 인스턴스를 드래그/편집하면 원본(master)이 수정됩니다.

---

## 12. 프로젝트 구조

```
src/
├─ index.ts                   # 라이브러리 공개 진입점(barrel) — 외부 import는 여기서
├─ App.tsx                    # 데모 플레이그라운드 진입점 (빈 캘린더, 빌드에는 미포함)
├─ types/calendar.ts          # CalendarEvent / CalendarResource / CalendarViewType
├─ core/dateUtils.ts          # 날짜 유틸 + 이벤트 전개(expandEvents, rrule/daysOfWeek)
└─ oc/
   ├─ components/
   │  ├─ OcCalendar.tsx        # 루트: 뷰 라우팅 + 다이얼로그 + 드래그/제약 처리
   │  └─ OcToolbar.tsx         # 툴바(네비 + 뷰 드롭다운 + 설정)
   ├─ core/
   │  ├─ store.tsx             # 상태(reducer) + Context (OcProvider/useOc)
   │  ├─ options.ts            # OcOptions + 기본값 + businessHours 판정
   │  ├─ dateProfile.ts        # 뷰별 렌더 범위/네비게이션
   │  ├─ daygridSeg.ts         # 멀티데이 세그먼트 + isBackgroundEvent
   │  └─ locales.ts            # 다국어 라벨
   ├─ views/                   # daygrid / timegrid / list / multimonth /
   │                           #   timeline / resourcetimegrid
   ├─ dialog/OcEventDialog.tsx # 일정 등록/수정(표시 방식 드롭다운 포함)
   ├─ settings/OcSettingsPanel.tsx
   └─ styles/                  # tokens.css(변수) + oc.css
```

---

## 13. 알아둘 점 / 제약

- **배경 이벤트는 클릭 불가**: `pointer-events: none`이라 일단 만들면 UI에서 다시 열 수 없습니다. 되돌리려면 데이터에서 직접 수정하세요.
- **이벤트는 내부 상태**: 외부에서 실시간으로 추가하려면 `eventSources`(함수/URL)를 쓰세요. props의 `initialEvents`는 초기값입니다.
- **요일 반복(`daysOfWeek`)의 전개량**: 연 뷰처럼 범위가 넓으면 인스턴스가 많이 생성됩니다(매 평일 등). 정상 동작이지만 대량 데이터 시 고려하세요.
- **다국어/타임존**: 로케일은 `ko`/`en` 2종, 시간은 브라우저 로컬 타임존 기준입니다(타임존 변환 미지원).
- **외부 캘린더 라이브러리 비의존**: 별도 캘린더 패키지에 의존하지 않고, 모든 로직을 `src/oc/`에 자체 구현했습니다.
- **알려진 린트 경고**: 기존 코드에 `react-hooks/exhaustive-deps`, `no-explicit-any`(extendedProps) 등 경고가 일부 있으나 빌드/타입체크에는 영향이 없습니다.
```
