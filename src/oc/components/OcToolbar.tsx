/* src/oc/components/OcToolbar.tsx
 * 헤더 툴바 — 좌(네비)/중앙(제목)/우(뷰 드롭다운·설정) 구조.
 */

import { useOc } from '../core/store';
import type { CalendarViewType } from '../../types/calendar';
import { getLocale } from '../core/locales';

interface ViewButton {
  view: CalendarViewType;
  labelKey: 'month' | 'week' | 'day' | 'year' | 'list' | 'timeline' | 'resourceTimeGrid';
}

const VIEW_BUTTONS: ViewButton[] = [
  { view: 'dayGridMonth', labelKey: 'month' },
  { view: 'timeGridWeek', labelKey: 'week' },
  { view: 'timeGridDay', labelKey: 'day' },
  { view: 'multiMonthYear', labelKey: 'year' },
  { view: 'listWeek', labelKey: 'list' },
  { view: 'resourceTimelineDay', labelKey: 'timeline' },
  { view: 'resourceTimeGridDay', labelKey: 'resourceTimeGrid' }
];

export function OcToolbar({ title, onOpenSettings }: { title: string; onOpenSettings?: () => void }) {
  const { state, dispatch, options } = useOc();
  const t = getLocale(state.locale);
  // 설정에서 켠 뷰 버튼만, headerViews 순서대로 표시
  const visibleButtons = options.headerViews
    .map((v) => VIEW_BUTTONS.find((b) => b.view === v))
    .filter((b): b is ViewButton => !!b);

  return (
    <div className="oc-toolbar oc-header-toolbar">
      {/* Left chunk: navigation */}
      <div className="oc-toolbar-chunk">
        <div className="oc-button-group">
          <button
            type="button"
            className="oc-button oc-button-primary oc-icon-button"
            aria-label={t.prev}
            onClick={() => dispatch({ type: 'PREV' })}
          >
            &larr;
          </button>
          <button
            type="button"
            className="oc-button oc-button-primary oc-icon-button"
            aria-label={t.next}
            onClick={() => dispatch({ type: 'NEXT' })}
          >
            &rarr;
          </button>
        </div>
        <button
          type="button"
          className="oc-button oc-button-primary"
          onClick={() => dispatch({ type: 'TODAY' })}
        >
          {t.today}
        </button>
      </div>

      {/* Center chunk: title */}
      <div className="oc-toolbar-chunk">
        <h2 className="oc-toolbar-title">{title}</h2>
      </div>

      {/* Right chunk: view switcher (dropdown) + settings */}
      <div className="oc-toolbar-chunk">
        <select
          className="oc-view-select"
          aria-label={t.view}
          value={state.currentView}
          onChange={(e) => dispatch({ type: 'SET_VIEW', payload: e.target.value as CalendarViewType })}
        >
          {visibleButtons.map((b) => (
            <option key={b.view} value={b.view}>
              {t[b.labelKey]}
            </option>
          ))}
        </select>
        {onOpenSettings && (
          <button
            type="button"
            className="oc-button oc-button-primary oc-icon-button"
            aria-label="설정"
            onClick={onOpenSettings}
          >
            ⚙
          </button>
        )}
      </div>
    </div>
  );
}
