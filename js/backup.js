/**
 * backup.js
 * -----------------------------------------------------------------------
 * Page module Backup & Restore: ekspor seluruh data aplikasi (daftar
 * koleksi eksplisit di BACKUP_COLLECTION_KEYS) ke file .json, dan impor
 * kembali dari file backup. Lewat storage.exportSnapshot / restoreSnapshot
 * — tidak menyentuh Firebase secara langsung dari sini.
 * -----------------------------------------------------------------------
 */

import * as storage from './storage.js';
import { STORAGE_KEYS, APP_NAME } from './config.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { confirmModal } from '../components/modal.js';
import { withLoader } from '../components/loader.js';
import { downloadFile, readFileAsText, formatDate, formatDateTime, todayInputValue } from './utils.js';
import { exportToExcel } from './excel-export.js';
import { listIncome } from '../services/income.service.js';
import { listExpense } from '../services/expense.service.js';
import { listAccounts, getAllBalances } from '../services/account.service.js';
import { listBudgets } from '../services/budget.service.js';

// Daftar koleksi yang benar-benar ada sebagai node RTDB & diizinkan rules
// (SESSION sengaja tidak diikutkan — itu bukan node DB, cuma sesi Firebase
// Auth SDK di client).
const BACKUP_COLLECTION_KEYS = [
  STORAGE_KEYS.USERS,
  STORAGE_KEYS.ACCOUNTS,
  STORAGE_KEYS.INCOME,
  STORAGE_KEYS.EXPENSE,
  STORAGE_KEYS.BUDGET,
  STORAGE_KEYS.JOURNAL,
  STORAGE_KEYS.DOCUMENTS,
  STORAGE_KEYS.SETTINGS,
  STORAGE_KEYS.LICENSE,
  STORAGE_KEYS.SEQUENCE,
];

// Disimpan sebagai child di bawah kira-finance:meta (bukan kira-finance:
// settings) supaya tidak ikut TERHAPUS tiap kali halaman Pengaturan
// menyimpan — settings.js menulis ulang SELURUH node settings tiap simpan
// (storage.setValue), yang akan menimpa child lain di dalamnya.
const LAST_BACKUP_KEY = `${STORAGE_KEYS.META}/last-backup-at`;

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Backup &amp; Restore</h1>
        <p>Amankan seluruh data keuangan sekolah, atau pulihkan dari file backup.</p>
      </div>
    </div>
    <div class="grid grid-cols-2" style="gap: var(--space-6);">
      <div class="card">
        <h3 class="text-lg">Ekspor Data</h3>
        <p class="text-secondary" style="margin: var(--space-2) 0 var(--space-4);">
          Mengunduh seluruh data ${APP_NAME} (akun, transaksi, anggaran, jurnal, pengguna,
          pengaturan) sebagai satu file <span class="mono">.json</span>. Simpan file ini di
          tempat aman — file ini bisa memulihkan seluruh data aplikasi.
        </p>
        <p class="text-tertiary" data-last-backup style="margin-bottom: var(--space-4);"></p>
        <button type="button" class="btn btn--primary" data-export-btn>Unduh Backup</button>
      </div>
      <div class="card">
        <h3 class="text-lg">Impor / Pulihkan Data</h3>
        <p class="text-secondary" style="margin: var(--space-2) 0 var(--space-4);">
          Memulihkan data dari file backup <span class="mono">.json</span>. Tindakan ini akan
          <strong>menimpa</strong> data yang ada saat ini di aplikasi — pastikan sudah
          mengekspor data terkini terlebih dahulu bila perlu.
        </p>
        <input type="file" accept="application/json" class="input" data-restore-input />
        <div class="form-actions">
          <button type="button" class="btn btn--danger" data-restore-btn disabled>Pulihkan Data</button>
        </div>
      </div>
      <div class="card" style="grid-column: 1 / -1;">
        <h3 class="text-lg">Export Semua ke Excel</h3>
        <p class="text-secondary" style="margin: var(--space-2) 0 var(--space-4);">
          Mengunduh satu file <span class="mono">.xlsx</span> berisi seluruh data dalam bentuk
          laporan siap-baca: Pemasukan, Pengeluaran, Jurnal Umum, Akun Kas &amp; Bank, Anggaran
          (RAB), dan Dokumen &amp; Bukti — masing-masing di sheet terpisah, lengkap
          dengan border, header, dan total. Berbeda dari Backup <span class="mono">.json</span>
          di atas: file ini untuk dibaca &amp; dilaporkan, bukan untuk memulihkan sistem.
        </p>
        <button type="button" class="btn btn--secondary" data-export-excel-btn>⭳ Unduh Semua (Excel)</button>
      </div>
    </div>
  `;

  await refreshLastBackupLabel(container);
  bindExport(container);
  bindRestore(container);
  bindExportExcel(container);
}

async function refreshLastBackupLabel(container) {
  const label = container.querySelector('[data-last-backup]');
  const lastAt = await storage.getValue(LAST_BACKUP_KEY, null);
  label.textContent = lastAt
    ? `Backup terakhir diunduh: ${formatDateTime(lastAt)}`
    : 'Belum pernah melakukan backup.';
}

function bindExport(container) {
  container.querySelector('[data-export-btn]').addEventListener('click', async () => {
    await withLoader(async () => {
      const snapshot = await storage.exportSnapshot(BACKUP_COLLECTION_KEYS);
      const filename = `kira-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadFile(filename, JSON.stringify(snapshot, null, 2));
      await storage.setValue(LAST_BACKUP_KEY, new Date().toISOString());
    });
    toastSuccess('Backup berhasil diunduh');
    await refreshLastBackupLabel(container);
  });
}

function bindExportExcel(container) {
  container.querySelector('[data-export-excel-btn]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Menyiapkan file...';
    try {
      await exportAllToExcel();
      toastSuccess('Export berhasil', 'File Excel seluruh laporan sudah diunduh.');
    } catch (err) {
      toastError('Export gagal', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '⭳ Unduh Semua (Excel)';
    }
  });
}

async function exportAllToExcel() {
  const [incomes, expenses, accounts, budgets, documents] = await Promise.all([
    listIncome(),
    listExpense(),
    getAllBalances(),
    listBudgets(),
    storage.getAll(STORAGE_KEYS.DOCUMENTS),
  ]);

  const accountList = await listAccounts();
  const accountName = (id) => accountList.find((a) => a.id === id)?.name || '-';
  const today = todayInputValue();
  const generatedNote = `Diunduh ${formatDate(new Date().toISOString())} · ${APP_NAME}`;

  const journalRows = [
    ...incomes.map((t) => ({ ...t, kind: 'Pemasukan' })),
    ...expenses.map((t) => ({ ...t, kind: 'Pengeluaran' })),
  ].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));

  await exportToExcel({
    filename: `kira-finance-laporan-lengkap-${today}`,
    sheets: [
      {
        name: 'Pemasukan',
        title: 'Kira Finance — Pemasukan',
        subtitle: `${generatedNote} · Total ${incomes.length} transaksi`,
        columns: [
          { header: 'Tanggal', key: 'date', type: 'date', width: 14 },
          { header: 'No. Dokumen', key: 'docNumber', type: 'text', width: 16 },
          { header: 'Kategori', key: 'category', type: 'text', width: 18 },
          { header: 'Dari (Pembayar)', key: 'payer', type: 'text', width: 24, getValue: (r) => r.payer || '-' },
          { header: 'Akun Tujuan', key: 'accountId', type: 'text', width: 20, getValue: (r) => accountName(r.accountId) },
          { header: 'Keterangan', key: 'description', type: 'text', width: 30, getValue: (r) => r.description || '-' },
          { header: 'Status', key: 'status', type: 'text', width: 12, getValue: (r) => (r.status === 'void' ? 'Void' : 'Posted') },
          { header: 'Jumlah', key: 'amount', type: 'currency', width: 18 },
        ],
        rows: incomes,
        totals: ['amount'],
      },
      {
        name: 'Pengeluaran',
        title: 'Kira Finance — Pengeluaran',
        subtitle: `${generatedNote} · Total ${expenses.length} transaksi`,
        columns: [
          { header: 'Tanggal', key: 'date', type: 'date', width: 14 },
          { header: 'No. Dokumen', key: 'docNumber', type: 'text', width: 16 },
          { header: 'Kategori', key: 'category', type: 'text', width: 18 },
          { header: 'Akun Sumber', key: 'accountId', type: 'text', width: 20, getValue: (r) => accountName(r.accountId) },
          { header: 'Keterangan', key: 'description', type: 'text', width: 30, getValue: (r) => r.description || '-' },
          { header: 'Status', key: 'status', type: 'text', width: 12, getValue: (r) => (r.status === 'void' ? 'Void' : 'Posted') },
          { header: 'Jumlah', key: 'amount', type: 'currency', width: 18 },
        ],
        rows: expenses,
        totals: ['amount'],
      },
      {
        name: 'Jurnal Umum',
        title: 'Kira Finance — Jurnal Umum',
        subtitle: `${generatedNote} · Total ${journalRows.length} transaksi`,
        columns: [
          { header: 'Tanggal', key: 'date', type: 'date', width: 14 },
          { header: 'No. Dokumen', key: 'docNumber', type: 'text', width: 16 },
          { header: 'Jenis', key: 'kind', type: 'text', width: 14 },
          { header: 'Kategori', key: 'category', type: 'text', width: 18 },
          { header: 'Akun', key: 'accountId', type: 'text', width: 20, getValue: (r) => accountName(r.accountId) },
          { header: 'Keterangan', key: 'description', type: 'text', width: 32, getValue: (r) => r.description || '-' },
          { header: 'Debit', key: 'debit', type: 'currency', width: 18, getValue: (r) => (r.kind === 'Pemasukan' ? r.amount : 0) },
          { header: 'Kredit', key: 'credit', type: 'currency', width: 18, getValue: (r) => (r.kind === 'Pengeluaran' ? r.amount : 0) },
        ],
        rows: journalRows,
        totals: ['debit', 'credit'],
      },
      {
        name: 'Akun Kas & Bank',
        title: 'Kira Finance — Akun Kas & Bank',
        subtitle: `${generatedNote} · Total ${accounts.length} akun`,
        columns: [
          { header: 'Nama Akun', key: 'name', type: 'text', width: 24 },
          { header: 'Tipe', key: 'type', type: 'text', width: 14, getValue: (r) => (r.type === 'bank' ? 'Bank' : 'Kas') },
          { header: 'Saldo Awal', key: 'openingBalance', type: 'currency', width: 18 },
          { header: 'Saldo Saat Ini', key: 'balance', type: 'currency', width: 18 },
        ],
        rows: accounts,
        totals: ['openingBalance', 'balance'],
      },
      {
        name: 'Anggaran (RAB)',
        title: 'Kira Finance — Anggaran (RAB)',
        subtitle: `${generatedNote} · Total ${budgets.length} baris anggaran`,
        columns: [
          { header: 'Periode', key: 'period', type: 'text', width: 12 },
          { header: 'Kategori', key: 'category', type: 'text', width: 20 },
          { header: 'Rencana Anggaran', key: 'plannedAmount', type: 'currency', width: 20 },
          { header: 'Catatan', key: 'notes', type: 'text', width: 30, getValue: (r) => r.notes || '-' },
        ],
        rows: budgets,
        totals: ['plannedAmount'],
      },
      {
        name: 'Dokumen & Bukti',
        title: 'Kira Finance — Dokumen & Bukti',
        subtitle: `${generatedNote} · Total ${documents.length} dokumen (metadata saja, file tidak disertakan)`,
        columns: [
          { header: 'Nama Dokumen', key: 'name', type: 'text', width: 26 },
          { header: 'Kategori', key: 'category', type: 'text', width: 18 },
          { header: 'Tanggal Dokumen', key: 'date', type: 'date', width: 16 },
          { header: 'Nama File', key: 'fileName', type: 'text', width: 26 },
          { header: 'Diunggah', key: 'createdAt', type: 'date', width: 14 },
        ],
        rows: documents,
      },
    ],
  });
}

function bindRestore(container) {
  const fileInput = container.querySelector('[data-restore-input]');
  const restoreBtn = container.querySelector('[data-restore-btn]');
  let selectedFile = null;

  fileInput.addEventListener('change', () => {
    selectedFile = fileInput.files?.[0] || null;
    restoreBtn.disabled = !selectedFile;
  });

  restoreBtn.addEventListener('click', () => {
    if (!selectedFile) return;
    confirmModal({
      title: 'Pulihkan Data?',
      message: 'Data saat ini akan ditimpa oleh isi file backup. Lanjutkan?',
      confirmLabel: 'Ya, Pulihkan',
      onConfirm: async () => {
        try {
          await withLoader(async () => {
            const text = await readFileAsText(selectedFile);
            const snapshot = JSON.parse(text);
            await storage.restoreSnapshot(snapshot);
          });
          toastSuccess('Data berhasil dipulihkan', 'Muat ulang halaman untuk melihat perubahan.');
          setTimeout(() => window.location.reload(), 1200);
        } catch (error) {
          toastError('Gagal memulihkan data', 'Pastikan file backup valid dan tidak rusak.');
        }
      },
    });
  });
}
