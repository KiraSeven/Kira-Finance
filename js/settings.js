/**
 * settings.js
 * -----------------------------------------------------------------------
 * Page module Pengaturan: profil sekolah (nama, alamat, NPSN) dan
 * preferensi aplikasi dasar. Disimpan sebagai satu object di
 * STORAGE_KEYS.SETTINGS lewat storage.getValue/setValue.
 * -----------------------------------------------------------------------
 */

import * as storage from './storage.js';
import { STORAGE_KEYS } from './config.js';
import { createForm } from '../components/form.js';
import { toastSuccess } from '../components/toast.js';
import { required } from './utils.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Pengaturan</h1>
        <p>Profil sekolah yang tampil pada laporan & dokumen resmi.</p>
      </div>
    </div>
    <div class="card" style="max-width:640px;" data-form-slot></div>
  `;

  const settings = await storage.getValue(STORAGE_KEYS.SETTINGS, {
    schoolName: '', npsn: '', address: '', headmasterName: '', treasurerName: '',
  });

  const { formEl, validate, getValues } = createForm([
    { name: 'schoolName', label: 'Nama Sekolah', value: settings.schoolName, validate: required },
    { name: 'npsn', label: 'NPSN', value: settings.npsn, half: true },
    { name: 'address', label: 'Alamat Sekolah', type: 'textarea', value: settings.address },
    { name: 'headmasterName', label: 'Nama Kepala Sekolah', value: settings.headmasterName, half: true },
    { name: 'treasurerName', label: 'Nama Bendahara', value: settings.treasurerName, half: true },
  ]);

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn--primary';
  saveBtn.textContent = 'Simpan Pengaturan';
  saveBtn.addEventListener('click', async () => {
    if (!validate()) return;
    await storage.setValue(STORAGE_KEYS.SETTINGS, getValues());
    toastSuccess('Pengaturan disimpan');
  });
  actions.appendChild(saveBtn);
  formEl.appendChild(actions);

  container.querySelector('[data-form-slot]').appendChild(formEl);
}
