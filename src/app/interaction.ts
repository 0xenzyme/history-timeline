/**
 * 交互：命中测试、悬停、canvas / ribbon 指针处理、拖拽与惯性、滚轮缩放、键盘。
 * 视图控制只改 runtime 的 domain / scrollY，导航交给 app 的 hooks。
 */

import type { EventRecord } from '../types';
import { AXIS_H, BAR_H, PAD_X, barTop } from './layout';
import { SKINS } from './skins';
import { FONT_SANS, clamp } from './util';
import {
  chipMatchEvent,
  draw,
  entryRect,
  fullSpan,
  hdrH,
  labelPlacements,
  maxScroll,
  ribbonXAt,
  xOf,
  yearAt,
} from './render';
import { eventTooltip, hideCard, personTooltip } from './view';
import { ctx, dom, getHooks, layouts, motion, state, W, type Selection } from './runtime';
import { topicForDynasty } from './model';

// ---------- 命中测试 ----------

export function hitTest(px: number, py: number): Selection | null {
  if (state.line === 'people' && state.stripOpen && py > AXIS_H + 4 && py < hdrH()) {
    let best: EventRecord | null = null;
    let bestDistance = 14;
    for (const event of state.library.events) {
      // 绘制按 chipMatchEvent 过滤，命中测试必须用同一口径，否则筛选掉的事件点不中却仍能命中。
      if (!chipMatchEvent(event)) continue;
      const x = xOf(event.year);
      const x1 = event.kind === 'span' && event.endYear !== undefined ? xOf(event.endYear) : x;
      const inside =
        event.kind === 'span' && event.endYear !== undefined ? px >= x - 2 && px <= x1 + 2 : Math.abs(px - x) < 9;
      if (!inside) continue;
      const distance = Math.abs(px - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = event;
      }
    }
    return best ? { kind: 'event', id: best.id } : null;
  }
  if (py < hdrH()) return null;
  const contentY = py - hdrH() + state.scrollY;
  for (const lane of layouts) {
    if (contentY < lane.y || contentY > lane.y + lane.height) continue;
    const placements = labelPlacements(ctx, lane);
    for (const item of lane.items) {
      const yTop = barTop(lane, item.row);
      if (contentY < yTop - 1 || contentY > yTop + BAR_H + 1) continue;
      const rect = entryRect(item);
      ctx.font = `11px ${FONT_SANS}`;
      const labelWidth = ctx.measureText(rect.label).width;
      const placement = placements.get(item.id) ?? 'none';
      let x0 = rect.x0 - 2;
      let x1 = rect.x1 + 2;
      if (placement === 'right') x1 += 5 + labelWidth + 2;
      else if (placement === 'left') x0 -= 5 + labelWidth + 2;
      if (px >= x0 && px <= x1) return { kind: item.kind, id: item.id };
    }
  }
  return null;
}

// ---------- 悬浮提示 ----------

export function hover(event: PointerEvent): void {
  const tooltip = document.getElementById('tooltip');
  if (!tooltip) return;
  const rect = dom.canvas.getBoundingClientRect();
  const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
  dom.canvas.style.cursor = hit ? 'pointer' : 'grab';
  if (!hit) {
    tooltip.hidden = true;
    return;
  }
  const text = hit.kind === 'person' ? personTooltip(hit.id) : eventTooltip(hit.id);
  tooltip.textContent = text;
  tooltip.hidden = false;
  tooltip.style.left = `${event.clientX + 12}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

// ---------- 画布指针 ----------

export function canvasPointer(): void {
  dom.canvas.addEventListener('pointerdown', (event) => {
    motion.dragging = true;
    motion.inertia = 0;
    motion.drag = {
      x: event.clientX,
      y: event.clientY,
      domain: [state.domain[0], state.domain[1]],
      scrollY: state.scrollY,
      moved: false,
      lastX: event.clientX,
      lastT: performance.now(),
    };
    dom.canvas.setPointerCapture(event.pointerId);
  });
  dom.canvas.addEventListener('pointermove', (event) => {
    const drag = motion.drag;
    if (!drag) {
      hover(event);
      return;
    }
    if (SKINS[state.skin].inertia) {
      const now = performance.now();
      const dt = Math.max(1, now - drag.lastT);
      motion.inertia = motion.inertia * 0.7 + ((event.clientX - drag.lastX) / dt) * 0.3;
      drag.lastT = now;
      drag.lastX = event.clientX;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const yearsPerPx = (drag.domain[1] - drag.domain[0]) / (W - PAD_X * 2);
    const shift = dx * yearsPerPx;
    const span = drag.domain[1] - drag.domain[0];
    const full = fullSpan();
    let d0 = drag.domain[0] - shift;
    let d1 = drag.domain[1] - shift;
    if (d0 < full[0]) {
      d0 = full[0];
      d1 = d0 + span;
    }
    if (d1 > full[1]) {
      d1 = full[1];
      d0 = d1 - span;
    }
    state.domain = [d0, d1];
    state.scrollY = clamp(drag.scrollY - dy, 0, maxScroll());
    draw();
  });
  dom.canvas.addEventListener('pointerup', (event) => {
    motion.dragging = false;
    const moved = motion.drag?.moved ?? false;
    motion.drag = null;
    if (moved) {
      return;
    }
    motion.inertia = 0;
    const rect = dom.canvas.getBoundingClientRect();
    const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    if (hit) void getHooks().selectAndReveal(hit);
    else hideCard();
  });
  dom.canvas.addEventListener('pointerleave', () => {
    document.getElementById('tooltip')?.setAttribute('hidden', '');
  });
  dom.canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      if (event.shiftKey) {
        state.scrollY = clamp(state.scrollY + event.deltaY, 0, maxScroll());
        draw();
        return;
      }
      const rect = dom.canvas.getBoundingClientRect();
      zoomAt(event.clientX - rect.left, Math.exp(event.deltaY * 0.0012));
    },
    { passive: false },
  );
}

// ---------- 底部朝代带指针 ----------

export function ribbonPointer(): void {
  let mode: 'pan' | 'left' | 'right' | null = null;
  let start = { x: 0, domain: [0, 0] as [number, number] };
  const edge = (clientX: number): 'pan' | 'left' | 'right' | null => {
    const rect = dom.ribbon.getBoundingClientRect();
    const [g0, g1] = fullSpan();
    const toPx = (year: number): number => rect.left + ((year - g0) / (g1 - g0)) * rect.width;
    const x0 = toPx(state.domain[0]);
    const x1 = toPx(state.domain[1]);
    if (Math.abs(clientX - x0) <= 6) return 'left';
    if (Math.abs(clientX - x1) <= 6) return 'right';
    if (clientX > x0 && clientX < x1) return 'pan';
    return null;
  };
  dom.ribbon.addEventListener('pointerdown', (event) => {
    mode = edge(event.clientX);
    start = { x: event.clientX, domain: [state.domain[0], state.domain[1]] };
    dom.ribbon.setPointerCapture(event.pointerId);
  });
  dom.ribbon.addEventListener('pointermove', (event) => {
    dom.ribbon.style.cursor = mode === 'left' || mode === 'right' ? 'ew-resize' : 'pointer';
    if (!mode) return;
    const rect = dom.ribbon.getBoundingClientRect();
    const yearsPerPx = (fullSpan()[1] - fullSpan()[0]) / Math.max(1, rect.width);
    const delta = (event.clientX - start.x) * yearsPerPx;
    if (mode === 'pan') {
      const span = start.domain[1] - start.domain[0];
      let d0 = start.domain[0] + delta;
      let d1 = start.domain[1] + delta;
      if (d0 < fullSpan()[0]) {
        d0 = fullSpan()[0];
        d1 = d0 + span;
      }
      if (d1 > fullSpan()[1]) {
        d1 = fullSpan()[1];
        d0 = d1 - span;
      }
      state.domain = [Math.round(d0), Math.round(d1)];
    } else if (mode === 'left') {
      state.domain = [Math.round(clamp(start.domain[0] + delta, fullSpan()[0], start.domain[1] - 10)), start.domain[1]];
    } else {
      state.domain = [start.domain[0], Math.round(clamp(start.domain[1] + delta, start.domain[0] + 10, fullSpan()[1]))];
    }
    draw();
  });
  dom.ribbon.addEventListener('pointerup', (event) => {
    const wasMode = mode;
    mode = null;
    if (wasMode) {
      return;
    }
    const year = ribbonXAt(event.clientX);
    centerDomain(year, state.domain[1] - state.domain[0]);
    const dynasty = state.library.dynasties.find((item) => year >= item.from && year <= item.to);
    const target = dynasty ? topicForDynasty(state.library, dynasty.id) : null;
    if (target && target.id !== state.topicId) void getHooks().setTopic(target.id);
    draw();
  });
  dom.ribbon.addEventListener('pointerleave', () => {
    if (!mode) dom.ribbon.style.cursor = 'pointer';
  });
}

// ---------- 视图控制 ----------

export function centerDomain(center: number, span: number): void {
  const full = fullSpan();
  const half = span / 2;
  let d0 = center - half;
  let d1 = center + half;
  if (d0 < full[0]) {
    d1 += full[0] - d0;
    d0 = full[0];
  }
  if (d1 > full[1]) {
    d0 -= d1 - full[1];
    d1 = full[1];
  }
  state.domain = [Math.round(d0), Math.round(d1)];
}

export function zoomAt(px: number, factor: number): void {
  const full = fullSpan();
  const anchor = yearAt(px);
  const [d0, d1] = state.domain;
  const span = clamp((d1 - d0) * factor, 4, full[1] - full[0]);
  const ratio = (anchor - d0) / (d1 - d0);
  let nd0 = anchor - span * ratio;
  let nd1 = anchor + span * (1 - ratio);
  if (nd0 < full[0]) {
    nd1 += full[0] - nd0;
    nd0 = full[0];
  }
  if (nd1 > full[1]) {
    nd0 -= nd1 - full[1];
    nd1 = full[1];
  }
  state.domain = [Math.round(nd0), Math.round(nd1)];
  draw();
}

export function zoomBy(factor: number): void {
  if (state.line === 'people' && !state.topic) return;
  zoomAt(W / 2, factor);
}

export function panByFraction(fraction: number): void {
  const span = state.domain[1] - state.domain[0];
  const shift = span * fraction;
  const full = fullSpan();
  let d0 = state.domain[0] + shift;
  let d1 = state.domain[1] + shift;
  if (d0 < full[0]) {
    d0 = full[0];
    d1 = d0 + span;
  }
  if (d1 > full[1]) {
    d1 = full[1];
    d0 = d1 - span;
  }
  state.domain = [Math.round(d0), Math.round(d1)];
  draw();
}

// ---------- 键盘 ----------

export function isTyping(): boolean {
  const active = document.activeElement;
  return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
}

export function keyboardEvents(): void {
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      dom.lanePanel.classList.remove('open');
      dom.exportMenu.hidden = true;
      if (dom.card.classList.contains('show')) hideCard();
    }
    if ((event.key === '+' || event.key === '=') && !isTyping()) zoomBy(0.75);
    if (event.key === '-' && !isTyping()) zoomBy(1.333);
    if (event.key === 'ArrowLeft' && !isTyping()) panByFraction(-0.1);
    if (event.key === 'ArrowRight' && !isTyping()) panByFraction(0.1);
  });
}
