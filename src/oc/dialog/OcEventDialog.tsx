/* src/oc/dialog/OcEventDialog.tsx */

import { useEffect, useState } from 'react';
import type { CalendarEvent, CalendarResource } from '../../types/calendar';
import { useOc } from '../core/store';
import { getLocale } from '../core/locales';

const COLORS = ['#3788d8', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#6366f1'];

type DisplayMode = NonNullable<CalendarEvent['display']>;
const DISPLAY_MODES: DisplayMode[] = ['auto', 'block', 'list-item', 'background', 'inverse-background'];
const DISPLAY_LABEL_KEYS: Record<DisplayMode, 'displayAuto' | 'displayBlock' | 'displayListItem' | 'displayBackground' | 'displayInverseBackground'> = {
  auto: 'displayAuto',
  block: 'displayBlock',
  'list-item': 'displayListItem',
  background: 'displayBackground',
  'inverse-background': 'displayInverseBackground'
};

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface OcEventDialogProps {
  open: boolean;
  event: CalendarEvent | null; // null = 신규
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultResourceId?: string;
  resources: CalendarResource[];
  onSave: (evt: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function OcEventDialog({
  open,
  event,
  defaultStart,
  defaultEnd,
  defaultResourceId,
  resources,
  onSave,
  onDelete,
  onClose
}: OcEventDialogProps) {
  const { state } = useOc();
  const t = getLocale(state.locale);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState(COLORS[0]);
  const [resourceId, setResourceId] = useState('');
  const [display, setDisplay] = useState<DisplayMode>('auto');

  useEffect(() => {
    if (!open) return;
    if (event) {
      const s = new Date(event.start);
      const e = event.end ? new Date(event.end) : new Date(s.getTime() + 60 * 60000);
      setTitle(event.title);
      setStart(toLocalInput(s));
      setEnd(toLocalInput(e));
      setAllDay(!!event.allDay);
      setColor(event.color || COLORS[0]);
      setResourceId(event.resourceId || '');
      setDisplay(event.display || 'auto');
    } else {
      const s = defaultStart || new Date();
      const e = defaultEnd || new Date(s.getTime() + 60 * 60000);
      setTitle('');
      setStart(toLocalInput(s));
      setEnd(toLocalInput(e));
      setAllDay(false);
      setColor(COLORS[0]);
      setResourceId(defaultResourceId || '');
      setDisplay('auto');
    }
  }, [open, event, defaultStart, defaultEnd, defaultResourceId]);

  // Escape key handler using window listener (works regardless of focus)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    const base: CalendarEvent = {
      id: event?.id || `evt_${Date.now()}`,
      title: title.trim(),
      start: new Date(start),
      end: new Date(end),
      allDay,
      color,
      resourceId: resourceId || undefined,
      // 'auto'는 기본값이므로 저장하지 않음
      ...(display !== 'auto' ? { display } : {}),
      // 마스터 식별자/반복 규칙 보존 (반복 인스턴스 편집 시)
      ...(event?.daysOfWeek ? { daysOfWeek: event.daysOfWeek, startTime: event.startTime, endTime: event.endTime } : {})
    };
    onSave(base);
  };

  return (
    <div className="oc-dialog-backdrop" onClick={onClose}>
      <div className="oc-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="oc-dialog-header">{event ? t.dialogEdit : t.dialogCreate}</div>
        <div className="oc-dialog-body">
          <label className="oc-field">
            <span>{t.title}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder={t.title} />
          </label>
          <label className="oc-field">
            <span>{t.start}</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="oc-field">
            <span>{t.end}</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <label className="oc-field oc-field-row">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>{t.allDay}</span>
          </label>
          {resources.length > 0 && (
            <label className="oc-field">
              <span>{t.resource}</span>
              <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
                <option value="">{t.none}</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="oc-field">
            <span>{t.color}</span>
            <div className="oc-color-swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`oc-swatch${color === c ? ' active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </label>
          <label className="oc-field">
            <span>{t.display}</span>
            <select value={display} onChange={(e) => setDisplay(e.target.value as DisplayMode)}>
              {DISPLAY_MODES.map((m) => (
                <option key={m} value={m}>
                  {t[DISPLAY_LABEL_KEYS[m]]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="oc-dialog-footer">
          {event && (
            <button className="oc-button oc-dialog-delete" onClick={() => onDelete(event.id)}>
              {t.delete}
            </button>
          )}
          <div className="oc-dialog-footer-right">
            <button className="oc-button oc-dialog-cancel" onClick={onClose}>
              {t.cancel}
            </button>
            <button className="oc-button oc-button-primary" onClick={handleSave}>
              {t.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
