/**
 * toast.js
 * -----------------------------------------------------------------------
 * Komponen notifikasi sementara (toast) yang di-mount ke #toast-root.
 * Dipanggil dari mana saja: import { showToast } from '.../components/toast.js'
 * -----------------------------------------------------------------------
 */

import { elementFromHtml, escapeHtml } from '../js/utils.js';

const ICONS = {
  success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
  error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
};

function getRoot() {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.getElementById('toast-root').appendChild(stack);
  }
  return stack;
}

/**
 * @param {{ type?: 'success'|'error'|'warning'|'info', title: string, message?: string, duration?: number }} options
 */
export function showToast({ type = 'info', title, message = '', duration = 4000 }) {
  const stack = getRoot();
  const toast = elementFromHtml(`
    <div class="toast toast--${type}" role="status">
      <span class="toast__icon">${ICONS[type] || ICONS.info}</span>
      <div>
        <div class="toast__title">${escapeHtml(title)}</div>
        ${message ? `<div class="toast__message">${escapeHtml(message)}</div>` : ''}
      </div>
    </div>
  `);

  stack.appendChild(toast);

  const remove = () => {
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 160);
  };

  const timer = setTimeout(remove, duration);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });

  return remove;
}

export const toastSuccess = (title, message) => showToast({ type: 'success', title, message });
export const toastError = (title, message) => showToast({ type: 'error', title, message });
export const toastWarning = (title, message) => showToast({ type: 'warning', title, message });
export const toastInfo = (title, message) => showToast({ type: 'info', title, message });
