import type { EventLineView, Topic } from '../types';
import { EVENT_TYPE_ORDER, EVENT_TYPE_META } from '../timeline/layout';

export function renderLegend(topic: Topic): string {
  const lanes = topic.lanes
    .map(
      (lane) =>
        `<span class="legend-item"><i class="swatch" style="background:${lane.color}"></i>${lane.name}</span>`,
    )
    .join('');

  const relations = topic.relationTypes
    .map((type) => {
      const dash = type.dash ? ` stroke-dasharray="${type.dash}"` : '';
      return `<span class="legend-item"><svg class="legend-line" viewBox="0 0 26 10" width="26" height="10"><line x1="1" y1="5" x2="25" y2="5" stroke="${type.color}"${dash} stroke-width="1.6" /></svg>${type.name}</span>`;
    })
    .join('');

  const bars = [
    `<span class="legend-item"><svg class="legend-line" viewBox="0 0 34 10" width="34" height="10"><rect x="1" y="2.5" width="32" height="5" rx="1.5" fill="#5a5a5a" /></svg>确切</span>`,
    `<span class="legend-item"><svg class="legend-line" viewBox="0 0 34 10" width="34" height="10"><defs><linearGradient id="lg-a" x1="0" x2="1"><stop offset="0" stop-color="#5a5a5a" stop-opacity="0.3"/><stop offset="0.5" stop-color="#5a5a5a"/><stop offset="1" stop-color="#5a5a5a" stop-opacity="0.3"/></linearGradient></defs><rect x="1" y="2.5" width="32" height="5" rx="1.5" fill="url(#lg-a)" /></svg>约略</span>`,
    `<span class="legend-item"><svg class="legend-line" viewBox="0 0 34 10" width="34" height="10"><polygon points="17,1 22,5 17,9 12,5" fill="#5a5a5a" /><polyline points="8,2 4,5 8,8" fill="none" stroke="#5a5a5a" stroke-width="1.2" /></svg>一端不详</span>`,
  ].join('');

  return `
    <div class="legend-group"><span class="legend-title">泳道</span>${lanes}</div>
    <div class="legend-group"><span class="legend-title">关系</span>${relations}</div>
    <div class="legend-group"><span class="legend-title">年代</span>${bars}</div>
  `;
}

/** 事件线没有泳道与关系，图例换成类型色、重要度与影子条。 */
export function renderEventLegend(line: EventLineView): string {
  const present = EVENT_TYPE_ORDER.filter((type) => line.events.some((event) => event.type === type));
  const types = present
    .map(
      (type) =>
        `<span class="legend-item"><i class="swatch" style="background:${EVENT_TYPE_META[type].color}"></i>${EVENT_TYPE_META[type].name}</span>`,
    )
    .join('');

  const marks = [1, 2, 3]
    .map((level) => {
      const r = [3.4, 4.4, 5.6][level - 1];
      return `<span class="legend-item"><svg class="legend-line" viewBox="0 0 14 14" width="14" height="14"><polygon points="7,${7 - r} ${7 + r},7 7,${7 + r} ${7 - r},7" fill="#5a5a5a" /></svg>${level === 3 ? '改变格局' : level === 2 ? '重要' : '有记录'}</span>`;
    })
    .join('');

  const shadow =
    line.id === 'military'
      ? `<div class="legend-group"><span class="legend-title">背景</span><span class="legend-item"><svg class="legend-line" viewBox="0 0 34 10" width="34" height="10"><rect x="1" y="3" width="32" height="5" rx="1.5" fill="#5a5a5a" opacity="0.28" /></svg>参战人物生命条</span></div>`
      : '';

  return `
    <div class="legend-group"><span class="legend-title">类型</span>${types}</div>
    <div class="legend-group"><span class="legend-title">重要度</span>${marks}</div>
    ${shadow}
  `;
}
