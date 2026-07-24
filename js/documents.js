/**
 * documents.js
 * -----------------------------------------------------------------------
 * Page module Dokumen & Bukti: unggah bukti transaksi (kuitansi, nota,
 * invoice) dan simpan sebagai base64 di Realtime Database.
 *
 * Kenapa base64 di RTDB (bukan Firebase Storage)? Storage butuh plan
 * Blaze (kartu kredit ter-link) — kalau project masih di plan Spark
 * (gratis) yang gratis penuh, opsi itu tidak tersedia. Supaya tetap gratis
 * 100% tanpa upgrade billing, file gambar DIKOMPRES dulu (resize + turunkan
 * kualitas JPEG) sebelum disimpan, dan ada batas ukuran maksimum per file
 * supaya node database tidak bengkak. Kalau nanti project di-upgrade ke
 * Blaze, gampang dipindah ke Firebase Storage lagi — tinggal ganti fungsi
 * uploadDocumentFile() di bawah.
 * -----------------------------------------------------------------------
 */

import * as storage from './storage.js';
import { STORAGE_KEYS } from './config.js';
import { createDataTable } from '../components/datatable.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { formatDate, formatDateTime, required, readFileAsDataUrl, compressImageToDataUrl } from './utils.js';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB — batas file ASLI sebelum dikompres
const MAX_OTHER_SIZE = 2 * 1024 * 1024; // 2MB — batas file non-gambar (PDF dll, tidak dikompres)

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Dokumen & Bukti</h1>
        <p>Simpan kuitansi, nota, dan bukti transaksi lain sebagai arsip digital.</p>
      </div>
      <div class="page-header__actions">
        <button type="button" class="btn btn--primary" data-add-btn>+ Unggah Dokumen</button>
      </div>
    </div>
    <div data-table-slot></div>
  `;

  let table = null;

  async function refresh() {
    const docs = await storage.getAll(STORAGE_KEYS.DOCUMENTS);
    docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const columns = [
      { key: 'name', label: 'Nama Dokumen' },
      { key: 'category', label: 'Kategori' },
      { key: 'date', label: 'Tanggal Dokumen', render: (r) => formatDate(r.date) },
      { key: 'createdAt', label: 'Diunggah', render: (r) => formatDateTime(r.createdAt) },
    ];

    if (table) {
      table.refresh(docs);
    } else {
      table = createDataTable({
        columns, rows: docs,
        searchKeys: ['name', 'category'],
        emptyMessage: 'Belum ada dokumen diunggah.',
        onRowClick: (row) => openDetail(row),
      });
      container.querySelector('[data-table-slot]').appendChild(table.el);
    }
  }

  function openDetail(doc) {
    const isImage = doc.fileType?.startsWith('image/');
    openModal({
      title: doc.name,
      body: `
        <div class="stack">
          <p class="text-secondary">Kategori: <strong>${doc.category}</strong> · Tanggal: <strong>${formatDate(doc.date)}</strong></p>
          ${isImage
            ? `<img src="${doc.fileData}" style="max-width:100%;border-radius:var(--radius-md);border:1px solid var(--color-border);" />`
            : `<p class="text-muted">Pratinjau tidak tersedia untuk tipe file ini. Unduh untuk melihat isi dokumen.</p>`}
        </div>
      `,
      footerButtons: [
        { label: 'Tutup', variant: 'secondary', onClick: (close) => close() },
        {
          label: 'Unduh', variant: 'secondary',
          onClick: () => {
            const a = document.createElement('a');
            a.href = doc.fileData;
            a.download = doc.fileName || doc.name;
            a.click();
          },
        },
        {
          label: 'Hapus', variant: 'danger',
          onClick: (close) => confirmModal({
            title: 'Hapus dokumen ini?',
            message: `"${doc.name}" akan dihapus permanen dari arsip.`,
            onConfirm: async () => {
              try {
                await storage.remove(STORAGE_KEYS.DOCUMENTS, doc.id);
                toastSuccess('Dokumen dihapus');
                close();
                refresh();
              } catch (err) {
                toastError('Gagal menghapus dokumen', err.message);
              }
            },
          }),
        },
      ],
    });
  }

  function openUploadModal() {
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.innerHTML = `
      <div class="field">
        <label class="field__label">Nama Dokumen</label>
        <input class="input" name="name" placeholder="Kuitansi pembelian ATK" />
        <span class="field__error" style="display:none;"></span>
      </div>
      <div class="field">
        <label class="field__label">Kategori</label>
        <input class="input" name="category" placeholder="Operasional / SPP / Lainnya" />
      </div>
      <div class="field">
        <label class="field__label">Tanggal Dokumen</label>
        <input class="input" type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" />
      </div>
      <div class="field">
        <label class="field__label">File</label>
        <input class="input" type="file" name="file" accept="image/*,application/pdf" />
        <span class="field__hint">Gambar maks. 8MB (otomatis dikompres). PDF maks. 2MB.</span>
      </div>
    `;

    const submit = async () => {
      const name = wrap.querySelector('[name="name"]').value.trim();
      const category = wrap.querySelector('[name="category"]').value.trim() || 'Lainnya';
      const date = wrap.querySelector('[name="date"]').value;
      const fileInput = wrap.querySelector('[name="file"]');
      const file = fileInput.files[0];

      const nameError = required(name);
      const errorEl = wrap.querySelector('.field__error');
      if (nameError) {
        errorEl.textContent = nameError;
        errorEl.style.display = 'block';
        return;
      }
      if (!file) {
        toastError('Pilih file terlebih dahulu');
        return;
      }

      const isImage = file.type.startsWith('image/');
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_OTHER_SIZE;
      if (file.size > maxSize) {
        toastError('File terlalu besar', `Maksimal ${Math.round(maxSize / 1024 / 1024)}MB untuk tipe file ini.`);
        return;
      }

      try {
        const fileData = isImage ? await compressImageToDataUrl(file) : await readFileAsDataUrl(file);
        await storage.create(STORAGE_KEYS.DOCUMENTS, {
          name, category, date, fileName: file.name, fileType: isImage ? 'image/jpeg' : file.type, fileData,
        }, 'doc');
        toastSuccess('Dokumen diunggah');
        closeModal();
        refresh();
      } catch (err) {
        toastError('Gagal mengunggah dokumen', err.message);
      }
    };

    openModal({
      title: 'Unggah Dokumen',
      body: wrap,
      footerButtons: [
        { label: 'Batal', variant: 'secondary', onClick: (close) => close() },
        { label: 'Unggah', variant: 'primary', onClick: submit },
      ],
    });
  }

  container.querySelector('[data-add-btn]').addEventListener('click', openUploadModal);

  await refresh();
}
