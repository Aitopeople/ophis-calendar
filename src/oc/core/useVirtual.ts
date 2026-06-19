/* src/oc/core/useVirtual.ts
 * 고정 행 높이 기반 간단 가상화 — 스크롤 영역에 보이는 행만 렌더.
 */

import { useEffect, useState, type RefObject } from 'react';

export interface VirtualRange {
  start: number;
  end: number; // exclusive
  paddingTop: number;
  totalHeight: number;
}

export function useVirtual(
  scrollRef: RefObject<HTMLElement | null>,
  count: number,
  rowHeight: number,
  overscan = 8
): VirtualRange {
  const [range, setRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Math.min(count, 40)
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const recompute = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan);
      const visible = Math.ceil(el.clientHeight / rowHeight);
      const end = Math.min(count, start + visible + overscan * 2);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    recompute();
    el.addEventListener('scroll', recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', recompute);
      ro.disconnect();
    };
  }, [scrollRef, count, rowHeight, overscan]);

  return {
    start: range.start,
    end: range.end,
    paddingTop: range.start * rowHeight,
    totalHeight: count * rowHeight
  };
}
