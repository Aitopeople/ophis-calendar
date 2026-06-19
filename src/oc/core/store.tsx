/* src/oc/core/store.tsx
 * 상태(reducer) + Context (OcProvider/useOc).
 */

import React, { createContext, useContext, useReducer, useMemo, useEffect, useState, useCallback } from 'react';
import { startOfDay } from '../../core/dateUtils';
import { navigateDate } from './dateProfile';
import type { CalendarEvent, CalendarResource, CalendarViewType } from '../../types/calendar';
import { resolveOptions, type OcOptions } from './options';

export interface OcState {
  currentDate: Date;
  currentView: CalendarViewType;
  events: CalendarEvent[];
  resources: CalendarResource[];
  locale: string;
}

export type OcAction =
  | { type: 'SET_DATE'; payload: Date }
  | { type: 'SET_VIEW'; payload: CalendarViewType }
  | { type: 'PREV' }
  | { type: 'NEXT' }
  | { type: 'TODAY' }
  | { type: 'ADD_EVENT'; payload: CalendarEvent }
  | { type: 'UPDATE_EVENT'; payload: CalendarEvent }
  | { type: 'DELETE_EVENT'; payload: string }
  | { type: 'SET_EVENTS'; payload: CalendarEvent[] }
  | { type: 'SET_LOCALE'; payload: string };

function reducer(state: OcState, action: OcAction): OcState {
  switch (action.type) {
    case 'SET_DATE':
      return { ...state, currentDate: action.payload };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'PREV':
      return { ...state, currentDate: navigateDate(state.currentView, state.currentDate, -1) };
    case 'NEXT':
      return { ...state, currentDate: navigateDate(state.currentView, state.currentDate, 1) };
    case 'TODAY':
      return { ...state, currentDate: startOfDay(new Date()) };
    case 'ADD_EVENT':
      // 동일 id 중복 추가 방지 (드롭 핸들러 재호출 등에 대한 방어)
      if (state.events.some((e) => e.id === action.payload.id)) return state;
      return { ...state, events: [...state.events, action.payload] };
    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map((e) => (e.id === action.payload.id ? action.payload : e))
      };
    case 'DELETE_EVENT':
      return { ...state, events: state.events.filter((e) => e.id !== action.payload) };
    case 'SET_EVENTS':
      return { ...state, events: action.payload };
    case 'SET_LOCALE':
      return { ...state, locale: action.payload };
    default:
      return state;
  }
}

interface OcStore {
  state: OcState;
  dispatch: React.Dispatch<OcAction>;
  options: OcOptions;
  setOption: <K extends keyof OcOptions>(key: K, value: OcOptions[K]) => void;
}

const OcContext = createContext<OcStore | null>(null);

/** 이벤트 소스: 배열 / 함수(동기·비동기) / JSON 피드 URL */
export type OcEventSource =
  | CalendarEvent[]
  | (() => CalendarEvent[] | Promise<CalendarEvent[]>)
  | string;

export interface OcProviderProps {
  initialDate?: Date;
  initialView?: CalendarViewType;
  initialEvents?: CalendarEvent[];
  /** 추가 이벤트 소스(배열/함수/URL) — initialEvents와 병합 */
  eventSources?: OcEventSource[];
  initialResources?: CalendarResource[];
  locale?: string;
  options?: Partial<OcOptions>;
  children: React.ReactNode;
}

export function OcProvider({
  initialDate,
  initialView = 'dayGridMonth',
  initialEvents = [],
  eventSources,
  initialResources = [],
  locale = 'ko',
  options,
  children
}: OcProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    currentDate: initialDate ? startOfDay(initialDate) : startOfDay(new Date()),
    currentView: initialView,
    events: initialEvents,
    resources: initialResources,
    locale
  }));

  // Sync locale prop changes into the store
  useEffect(() => {
    if (locale && state.locale !== locale) {
      dispatch({ type: 'SET_LOCALE', payload: locale });
    }
  }, [locale]);

  // 이벤트 소스 해석(배열/함수/URL) → initialEvents와 병합
  useEffect(() => {
    if (!eventSources || eventSources.length === 0) return;
    let cancelled = false;
    (async () => {
      const merged: CalendarEvent[] = [...initialEvents];
      for (const src of eventSources) {
        try {
          if (Array.isArray(src)) merged.push(...src);
          else if (typeof src === 'function') merged.push(...(await src()));
          else if (typeof src === 'string') {
            const res = await fetch(src);
            const json = (await res.json()) as CalendarEvent[];
            merged.push(...json);
          }
        } catch {
          // 개별 소스 실패는 무시
        }
      }
      if (!cancelled) dispatch({ type: 'SET_EVENTS', payload: merged });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSources]);

  // 옵션은 상태로 보관 → 설정 패널에서 런타임 변경 가능
  const [optionsState, setOptionsState] = useState<OcOptions>(() => resolveOptions(options));
  const setOption = useCallback(<K extends keyof OcOptions>(key: K, value: OcOptions[K]) => {
    setOptionsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, options: optionsState, setOption }),
    [state, optionsState, setOption]
  );
  return <OcContext.Provider value={value}>{children}</OcContext.Provider>;
}

export function useOc(): OcStore {
  const ctx = useContext(OcContext);
  if (!ctx) throw new Error('useOc must be used within <OcProvider>');
  return ctx;
}
