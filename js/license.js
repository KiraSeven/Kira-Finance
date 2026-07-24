/**
 * license.js
 * -----------------------------------------------------------------------
 * Page module Lisensi: status aktivasi berjalan, form aktivasi lisensi
 * baru, dan generator kode lisensi demo (hanya untuk instalasi lokal /
 * testing — lihat catatan di services/license.service.js).
 * -----------------------------------------------------------------------
 */

import * as licenseService from '../services/license.service.js';
import { createForm } from '../components/form.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { required, formatDate } from './utils.js';

const STATUS_LABEL = {
  active: 'Aktif',
  'expiring-soon': 'Segera Berakhir',
  expired: 'Kedaluwarsa',
  inactive: 'Belum Diaktivasi',
};

const STATUS_BADGE_CLASS = {
  active: 'badge--income',
  'expiring-soon': 'badge--warning',
  expired: 'badge--expense',
  inactive: 'badge--neutral',
};

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Lisensi Aplikasi</h1>
        <p>Status aktivasi Kira Finance untuk instalasi sekolah ini.</p>
      </div>
    </div>
    <div class="grid grid-cols-2" style="gap: var(--space-6);">
      <div class="card" data-status-card></div>
      <div class="card" data-form-card>
        <h3 class="text-lg" style="margin-bottom: var(--space-2);">Aktivasi Lisensi</h3>
        <p class="text-secondary" style="margin-bottom: var(--space-4);">
          Isi nama sekolah &amp; tanggal kedaluwarsa, lalu klik <strong>"Buat Kode Otomatis"</strong>
          untuk mengisi Kode Lisensi — cara ini menjamin kode selalu cocok dengan data di
          atasnya (pengganti proses penerbitan lisensi server yang sesungguhnya).
        </p>
        <div data-form-slot></div>
      </div>
    </div>
  `;

  await renderStatusCard(container);
  await renderActivationForm(container);
}

async function renderStatusCard(container) {
  const statusCard = container.querySelector('[data-status-card]');
  const { status, daysLeft, license } = await licenseService.getLicenseStatus();

  statusCard.innerHTML = `
    <h3 class="text-lg" style="margin-bottom: var(--space-4);">Status Saat Ini</h3>
    <div class="stack" style="gap: var(--space-3);">
      <div class="row" style="justify-content: space-between;">
        <span class="text-secondary">Status</span>
        <span class="badge ${STATUS_BADGE_CLASS[status]}">${STATUS_LABEL[status]}</span>
      </div>
      <div class="row" style="justify-content: space-between;">
        <span class="text-secondary">Nama Sekolah</span>
        <span>${license?.schoolName || '—'}</span>
      </div>
      <div class="row" style="justify-content: space-between;">
        <span class="text-secondary">Berlaku Hingga</span>
        <span class="num">${license ? formatDate(license.expiryDate) : '—'}</span>
      </div>
      <div class="row" style="justify-content: space-between;">
        <span class="text-secondary">Sisa Hari</span>
        <span class="num ${daysLeft < 0 ? 'text-expense' : ''}">${license ? daysLeft : '—'}</span>
      </div>
      <div class="row" style="justify-content: space-between;">
        <span class="text-secondary">Kode Lisensi</span>
        <span class="num">${license?.licenseKey || '—'}</span>
      </div>
    </div>
    ${license ? `
      <div class="form-actions" style="margin-top: var(--space-6);">
        <button type="button" class="btn btn--danger" data-deactivate-btn>Nonaktifkan Lisensi</button>
      </div>
    ` : ''}
  `;

  statusCard.querySelector('[data-deactivate-btn]')?.addEventListener('click', async () => {
    await licenseService.deactivateLicense();
    toastSuccess('Lisensi dinonaktifkan');
    render(container);
  });
}

async function renderActivationForm(container) {
  const slot = container.querySelector('[data-form-slot]');
  const { formEl, validate, getValues } = createForm([
    { name: 'schoolName', label: 'Nama Sekolah', validate: required },
    { name: 'expiryDate', label: 'Tanggal Kedaluwarsa', type: 'date', validate: required },
    { name: 'licenseKey', label: 'Kode Lisensi', placeholder: 'KIRA-XXXXXXXX', validate: required },
  ]);

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const generateBtn = document.createElement('button');
  generateBtn.type = 'button';
  generateBtn.className = 'btn btn--secondary';
  generateBtn.textContent = 'Buat Kode Otomatis';
  generateBtn.addEventListener('click', () => {
    const { schoolName, expiryDate } = getValues();
    if (!schoolName.trim() || !expiryDate) {
      toastError('Lengkapi dulu', 'Isi Nama Sekolah dan Tanggal Kedaluwarsa sebelum membuat kode.');
      return;
    }
    const licenseKeyInput = formEl.querySelector('[name="licenseKey"]');
    licenseKeyInput.value = licenseService.generateLicenseKey(schoolName, expiryDate);
  });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn--primary';
  submitBtn.textContent = 'Aktivasi';
  submitBtn.addEventListener('click', async () => {
    if (!validate()) return;
    try {
      await licenseService.activateLicense(getValues());
      toastSuccess('Lisensi berhasil diaktivasi');
      render(container);
    } catch (error) {
      toastError('Aktivasi gagal', error.message);
    }
  });

  actions.appendChild(generateBtn);
  actions.appendChild(submitBtn);
  formEl.appendChild(actions);
  slot.appendChild(formEl);
}
