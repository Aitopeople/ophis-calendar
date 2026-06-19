/* src/oc/settings/OcSettingsPanel.tsx
 * 설정 패널 — OcOptions를 런타임으로 조정. (docs/oc-options.md 스펙 기반)
 */

import { useOc } from '../core/store';
import { HEADER_VIEW_OPTIONS, type BusinessHours } from '../core/options';
import { getLocale } from '../core/locales';
import type { CalendarViewType } from '../../types/calendar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const DEFAULT_BH: BusinessHours = { daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '18:00' };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="oc-settings-row">
      <span className="oc-settings-label">{label}</span>
      <span className="oc-settings-control">{children}</span>
    </label>
  );
}

export function OcSettingsPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch, options, setOption } = useOc();

  const bh = options.businessHours || DEFAULT_BH;
  const t = getLocale(state.locale) as unknown as Record<string, string>;

  const toggleHeaderView = (v: CalendarViewType) => {
    const has = options.headerViews.includes(v);
    const next = has ? options.headerViews.filter((x) => x !== v) : [...options.headerViews, v];
    // 표준 순서 유지
    setOption(
      'headerViews',
      HEADER_VIEW_OPTIONS.map((o) => o.view).filter((x) => next.includes(x))
    );
  };

  return (
    <div className="oc-view oc-settings-view">
      <div className="oc-settings-inner">
        <div className="oc-settings-header">
          <span>설정</span>
          <button className="oc-button oc-button-primary" onClick={onClose}>
            완료
          </button>
        </div>

        <div className="oc-settings-body">
          <div className="oc-settings-group-title">일반</div>
          <Row label="언어 / Language">
            <select value={state.locale} onChange={(e) => dispatch({ type: 'SET_LOCALE', payload: e.target.value })}>
              <option value="ko">한국어 (ko)</option>
              <option value="en">English (en)</option>
            </select>
          </Row>
          <Row label="주 시작 요일">
            <select value={options.firstDay} onChange={(e) => setOption('firstDay', Number(e.target.value))}>
              {WEEKDAYS.map((w, i) => (
                <option key={i} value={i}>
                  {w}요일
                </option>
              ))}
            </select>
          </Row>
          <Row label="주말 표시">
            <input type="checkbox" checked={options.weekends} onChange={(e) => setOption('weekends', e.target.checked)} />
          </Row>
          <Row label="주차 번호">
            <input
              type="checkbox"
              checked={options.weekNumbers}
              onChange={(e) => setOption('weekNumbers', e.target.checked)}
            />
          </Row>
          <Row label={`가로:세로 비율 (${options.aspectRatio.toFixed(2)})`}>
            <input
              type="range"
              min={0.6}
              max={2.5}
              step={0.05}
              value={options.aspectRatio}
              onChange={(e) => setOption('aspectRatio', Number(e.target.value))}
            />
          </Row>
          <Row label="월 셀당 최대 이벤트 (0=자동)">
            <input
              type="number"
              min={0}
              max={20}
              value={options.dayMaxEvents === true ? 0 : options.dayMaxEvents}
              onChange={(e) => {
                const n = Number(e.target.value);
                setOption('dayMaxEvents', n <= 0 ? true : n);
              }}
            />
          </Row>

          <div className="oc-settings-group-title">헤더 뷰 버튼</div>
          {HEADER_VIEW_OPTIONS.map((o) => (
            <Row key={o.view} label={t[o.labelKey] || o.view}>
              <input
                type="checkbox"
                checked={options.headerViews.includes(o.view)}
                onChange={() => toggleHeaderView(o.view)}
              />
            </Row>
          ))}

          <div className="oc-settings-group-title">시간 그리드</div>
          <Row label="시작 시각">
            <input
              type="number"
              min={0}
              max={23}
              value={options.slotMinTime}
              onChange={(e) => setOption('slotMinTime', Number(e.target.value))}
            />
          </Row>
          <Row label="끝 시각">
            <input
              type="number"
              min={1}
              max={24}
              value={options.slotMaxTime}
              onChange={(e) => setOption('slotMaxTime', Number(e.target.value))}
            />
          </Row>
          <Row label="슬롯/스냅(분)">
            <select value={options.slotDuration} onChange={(e) => setOption('slotDuration', Number(e.target.value))}>
              {[5, 10, 15, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m}분
                </option>
              ))}
            </select>
          </Row>
          <Row label="초기 스크롤 시각">
            <input
              type="number"
              min={0}
              max={23}
              value={options.scrollTime}
              onChange={(e) => setOption('scrollTime', Number(e.target.value))}
            />
          </Row>

          <div className="oc-settings-group-title">상호작용</div>
          <Row label="이벤트 편집 허용(드래그/리사이즈)">
            <input
              type="checkbox"
              checked={options.editable}
              onChange={(e) => setOption('editable', e.target.checked)}
            />
          </Row>
          <Row label="이벤트 겹침 허용">
            <input
              type="checkbox"
              checked={options.eventOverlap}
              onChange={(e) => setOption('eventOverlap', e.target.checked)}
            />
          </Row>
          <Row label="업무시간 밖 이동 금지">
            <input
              type="checkbox"
              checked={options.eventConstraint === 'businessHours'}
              onChange={(e) => setOption('eventConstraint', e.target.checked ? 'businessHours' : false)}
            />
          </Row>

          <div className="oc-settings-group-title">업무시간(음영)</div>
          <Row label="업무시간 표시">
            <input
              type="checkbox"
              checked={!!options.businessHours}
              onChange={(e) => setOption('businessHours', e.target.checked ? DEFAULT_BH : false)}
            />
          </Row>
          {options.businessHours && (
            <>
              <Row label="업무 요일">
                <span className="oc-settings-days">
                  {WEEKDAYS.map((w, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`oc-settings-day${bh.daysOfWeek.includes(i) ? ' active' : ''}`}
                      onClick={() => {
                        const days = bh.daysOfWeek.includes(i)
                          ? bh.daysOfWeek.filter((d) => d !== i)
                          : [...bh.daysOfWeek, i].sort();
                        setOption('businessHours', { ...bh, daysOfWeek: days });
                      }}
                    >
                      {w}
                    </button>
                  ))}
                </span>
              </Row>
              <Row label="업무 시작">
                <input
                  type="time"
                  value={bh.startTime}
                  onChange={(e) => setOption('businessHours', { ...bh, startTime: e.target.value })}
                />
              </Row>
              <Row label="업무 종료">
                <input
                  type="time"
                  value={bh.endTime}
                  onChange={(e) => setOption('businessHours', { ...bh, endTime: e.target.value })}
                />
              </Row>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
