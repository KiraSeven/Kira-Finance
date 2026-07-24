/**
 * modal.js
 * -----------------------------------------------------------------------
 * Modal dialog generik: open/close, dukung form embed & tombol footer
 * custom. Hanya satu modal aktif dalam satu waktu (di-mount ke #modal-root).
 * -----------------------------------------------------------------------
 */

import { escapeHtml } from '../js/utils.js';

let activeBackdrop = null;
let escListener = null;

/**
 * @param {{
 *   title: string,
 *   body: HTMLElement | string,
 *   footerButtons?: { label: string, variant?: string, onClick?: (close: Function) => void, type?: string }[],
 *   size?: 'sm' | 'md' | 'lg',
 *   onClose?: () => void,
 * }} options
 */
export function openModal({ title, body, footerButtons = [], size = 'md', onClose }) {
  closeModal();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = `modal ${size === 'lg' ? 'modal--lg' : size === 'sm' ? 'modal--sm' : ''}`;

  modal.innerHTML = `
    <div class="modal__header">
      <h3 class="modal__title">${escapeHtml(title)}</h3>
      <button type="button" class="icon-btn" data-modal-close aria-label="Tutup">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal__body"></div>
    <div class="modal__footer"></div>
  `;

  const bodyEl = modal.querySelector('.modal__body');
  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  }

  const footerEl = modal.querySelector('.modal__footer');
  if (footerButtons.length === 0) {
    footerEl.remove();
  } else {
    footerButtons.forEach((btn) => {
      const buttonEl = document.createElement('button');
      buttonEl.type = btn.type || 'button';
      buttonEl.className = `btn btn--${btn.variant || 'secondary'}`;
      buttonEl.textContent = btn.label;
      buttonEl.addEventListener('click', () => btn.onClick?.(closeModal));
      footerEl.appendChild(buttonEl);
    });
  }

  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);
  activeBackdrop = backdrop;

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  modal.querySelector('[data-modal-close]').addEventListener('click', () => closeModal());

  escListener = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', escListener);

  if (onClose) backdrop.dataset.hasOnClose = 'true';
  backdrop.__onClose = onClose;

  return { close: closeModal, modalEl: modal };
}

export function closeModal() {
  if (!activeBackdrop) return;
  activeBackdrop.__onClose?.();
  activeBackdrop.remove();
  activeBackdrop = null;
  if (escListener) {
    document.removeEventListener('keydown', escListener);
    escListener = null;
  }
}

/** Modal konfirmasi cepat (hapus data, void transaksi, dsb) */
export function confirmModal({ title = 'Konfirmasi', message, confirmLabel = 'Ya, lanjutkan', danger = true, onConfirm }) {
  openModal({
    title,
    body: `<p class="text-secondary">${escapeHtml(message)}</p>`,
    footerButtons: [
      { label: 'Batal', variant: 'secondary', onClick: (close) => close() },
      {
        label: confirmLabel,
        variant: danger ? 'danger' : 'primary',
        onClick: (close) => { onConfirm?.(); close(); },
      },
    ],
    size: 'sm',
  });
}
