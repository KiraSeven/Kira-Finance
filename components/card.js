/**
 * card.js
 * -----------------------------------------------------------------------
 * Komponen card generik + metric card (dipakai ringkasan dashboard).
 * -----------------------------------------------------------------------
 */

import { escapeHtml } from '../js/utils.js';

/** Card kosong generik — panggil lalu isi manual dengan .appendChild() */
export function createCard({ raised = false, interactive = false, className = '' } = {}) {
  const el = document.createElement('div');
  el.className = [
    'card',
    raised && 'card--raised',
    interactive && 'card--interactive',
    className,
  ].filter(Boolean).join(' ');
  return el;
}

const TREND_ICON = {
  up: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 9l-6-6-6 6M12 3v18"/></svg>',
  down: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 15l6 6 6-6M12 21V3"/></svg>',
  flat: '',
};

/**
 * @param {{ label: string, value: string, deltaText?: string, trend?: 'up'|'down'|'flat', icon?: string }} props
 */
export function createMetricCard({ label, value, deltaText, trend = 'flat', icon }) {
  const card = createCard({ raised: false });
  card.classList.add('metric-card');
  card.innerHTML = `
    <div class="row-between">
      <span class="metric-card__label">${escapeHtml(label)}</span>
      ${icon ? `<span class="metric-card__icon">${icon}</span>` : ''}
    </div>
    <span class="metric-card__value num">${escapeHtml(value)}</span>
    ${deltaText ? `
      <span class="metric-card__delta metric-card__delta--${trend}">
        ${TREND_ICON[trend]}
        ${escapeHtml(deltaText)}
      </span>
    ` : ''}
  `;
  return card;
}

/** Card kosong berisi ajakan aksi (dipakai saat list data kosong) */
export function createEmptyState({ icon, title, message, actionLabel, onAction }) {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    ${icon ? `<div class="empty-state__icon">${icon}</div>` : ''}
    <div>
      <strong>${escapeHtml(title)}</strong>
      <p class="text-muted" style="margin-top:4px;">${escapeHtml(message || '')}</p>
    </div>
  `;
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.className = 'btn btn--primary btn--sm';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => onAction?.());
    el.appendChild(btn);
  }
  return el;
}
