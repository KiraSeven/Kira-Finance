/**
 * reports.js
 * -----------------------------------------------------------------------
 * Page module Laporan Keuangan: tab Surplus-Defisit (laba/rugi sederhana),
 * Arus Kas bulanan, dan Posisi Kas per akun. Data seluruhnya dari
 * report.service.js — halaman ini murni presentasi.
 * -----------------------------------------------------------------------
 */

import { getIncomeStatement, getMonthlyCashFlow, getCashPosition } from '../services/report.service.js';
import { listIncome } from '../services/income.service.js';
import { listExpense } from '../services/expense.service.js';
import { listAccounts } from '../services/account.service.js';
import { getBudgetRealization } from '../services/budget.service.js';
import { createDonutChart, createBarChart } from '../components/chart.js';
import { createTable } from '../components/table.js';
import { formatCurrency, todayInputValue, downloadFile, formatDate } from './utils.js';
import { exportToExcel } from './excel-export.js';
import { toastSuccess, toastError } from '../components/toast.js';
import * as storage from './storage.js';
import { STORAGE_KEYS, TRANSACTION_STATUS } from './config.js';

const TABS = [
  { key: 'surplus', label: 'Surplus / Defisit' },
  { key: 'cashflow', label: 'Arus Kas' },
  { key: 'position', label: 'Posisi Kas' },
];

export async function render(container) {
  let activeTab = 'surplus';
  const firstOfMonth = todayInputValue().slice(0, 8) + '01';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Laporan Keuangan</h1>
        <p>Ringkasan surplus-defisit, tren arus kas, dan posisi kas sekolah.</p>
      </div>
      <div class="page-header__actions">
        <input type="date" class="input" data-from value="${firstOfMonth}" />
        <span class="text-muted">s/d</span>
        <input type="date" class="input" data-to value="${todayInputValue()}" />
        <button type="button" class="btn btn--primary" data-export-excel-btn>⭳ Export Excel</button>
        <button type="button" class="btn btn--ghost" data-export-btn>Export JSON</button>
      </div>
    </div>
    <div class="tabs section" data-tabs></div>
    <div data-tab-content></div>
  `;

  const tabsEl = container.querySelector('[data-tabs]');
  TABS.forEach((tab) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tabs__item${tab.key === activeTab ? ' tabs__item--active' : ''}`;
    el.textContent = tab.label;
    el.dataset.tabKey = tab.key;
    el.addEventListener('click', () => {
      activeTab = tab.key;
      tabsEl.querySelectorAll('.tabs__item').forEach((n) => n.classList.remove('tabs__item--active'));
      el.classList.add('tabs__item--active');
      renderTab();
    });
    tabsEl.appendChild(el);
  });

  async function renderTab() {
    const content = container.querySelector('[data-tab-content]');
    content.innerHTML = '<p class="text-muted" style="padding:var(--space-8) 0;">Memuat laporan...</p>';

    const from = container.querySelector('[data-from]').value;
    const to = container.querySelector('[data-to]').value;

    if (activeTab === 'surplus') {
      const data = await getIncomeStatement({ from, to });
      content.innerHTML = `
        <div class="grid grid-cols-2">
          <div class="card">
            <h3 class="text-lg" style="margin-bottom:var(--space-4);">Pemasukan per Kategori</h3>
            <div data-income-donut></div>
          </div>
          <div class="card">
            <h3 class="text-lg" style="margin-bottom:var(--space-4);">Pengeluaran per Kategori</h3>
            <div data-expense-donut></div>
          </div>
        </div>
        <div class="card section">
          <div class="row-between">
            <span>Total Pemasukan</span>
            <span class="num text-income">${formatCurrency(data.totalIncome)}</span>
          </div>
          <hr class="divider" style="margin:var(--space-3) 0;" />
          <div class="row-between">
            <span>Total Pengeluaran</span>
            <span class="num text-expense">${formatCurrency(data.totalExpense)}</span>
          </div>
          <hr class="divider" style="margin:var(--space-3) 0;" />
          <div class="row-between">
            <strong>Surplus / Defisit</strong>
            <strong class="num ${data.surplus >= 0 ? 'text-income' : 'text-expense'}">${formatCurrency(data.surplus)}</strong>
          </div>
        </div>
      `;
      const incomeDonut = content.querySelector('[data-income-donut]');
      incomeDonut.innerHTML = data.incomeByCategory.length ? '' : '<p class="text-muted">Tidak ada data.</p>';
      if (data.incomeByCategory.length) incomeDonut.appendChild(createDonutChart(data.incomeByCategory));

      const expenseDonut = content.querySelector('[data-expense-donut]');
      expenseDonut.innerHTML = data.expenseByCategory.length ? '' : '<p class="text-muted">Tidak ada data.</p>';
      if (data.expenseByCategory.length) expenseDonut.appendChild(createDonutChart(data.expenseByCategory));
    }

    if (activeTab === 'cashflow') {
      const cashflow = await getMonthlyCashFlow(12);
      content.innerHTML = `<div class="card"><h3 class="text-lg" style="margin-bottom:var(--space-4);">Arus Kas 12 Bulan Terakhir</h3><div data-chart></div></div>`;
      content.querySelector('[data-chart]').appendChild(createBarChart(cashflow, { height: 320 }));
    }

    if (activeTab === 'position') {
      const positions = await getCashPosition();
      content.innerHTML = '<div class="card" data-table-slot></div>';
      content.querySelector('[data-table-slot]').appendChild(createTable({
        columns: [
          { key: 'name', label: 'Nama Akun' },
          { key: 'type', label: 'Jenis', render: (r) => (r.type === 'bank' ? 'Rekening Bank' : 'Kas Tunai') },
          { key: 'balance', label: 'Saldo', align: 'right', render: (r) => `<span class="num text-accent">${formatCurrency(r.balance)}</span>` },
        ],
        rows: positions,
        emptyMessage: 'Belum ada akun kas/bank.',
      }));
    }
  }

  container.querySelector('[data-from]').addEventListener('change', renderTab);
  container.querySelector('[data-to]').addEventListener('change', renderTab);
  container.querySelector('[data-export-btn]').addEventListener('click', async () => {
    const from = container.querySelector('[data-from]').value;
    const to = container.querySelector('[data-to]').value;
    const data = await getIncomeStatement({ from, to });
    downloadFile(`laporan-keuangan-${from}-${to}.json`, JSON.stringify(data, null, 2));
  });

  container.querySelector('[data-export-excel-btn]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const from = container.querySelector('[data-from]').value;
    const to = container.querySelector('[data-to]').value;
    btn.disabled = true;
    btn.textContent = 'Menyiapkan file...';
    try {
      await exportReportsToExcel({ from, to });
      toastSuccess('Export berhasil', 'File Excel laporan keuangan sudah diunduh.');
    } catch (err) {
      toastError('Export gagal', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '⭳ Export Excel';
    }
  });

  await renderTab();
}

const STATUS_LABEL = {
  [TRANSACTION_STATUS.DRAFT]: 'Draft',
  [TRANSACTION_STATUS.POSTED]: 'Posted',
  [TRANSACTION_STATUS.VOID]: 'Void',
};

/** Bangun 1 file Excel super-detail (9 sheet) berisi seluruh data aplikasi untuk rentang tanggal terpilih */
async function exportReportsToExcel({ from, to }) {
  const [statement, cashflow, positions, incomeRows, expenseRows, accounts, documents] = await Promise.all([
    getIncomeStatement({ from, to }),
    getMonthlyCashFlow(12),
    getCashPosition(),
    listIncome({ from, to }),
    listExpense({ from, to }),
    listAccounts(),
    storage.getAll(STORAGE_KEYS.DOCUMENTS),
  ]);

  // Periode anggaran dipakai bulan dari tanggal "to" (biasanya bulan berjalan)
  const budgetPeriod = (to || todayInputValue()).slice(0, 7);
  const budgetRealization = await getBudgetRealization(budgetPeriod);

  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '(Akun tidak diketahui)';
  const periodLabel = `Periode ${formatDate(from)} — ${formatDate(to)}`;

  await exportToExcel({
    filename: `laporan-keuangan-${from}-${to}`,
    sheets: [
      {
        name: 'Ringkasan',
        title: 'Kira Finance — Ringkasan Surplus / Defisit',
        subtitle: periodLabel,
        columns: [
          { header: 'Keterangan', key: 'label', type: 'text', width: 28 },
          { header: 'Jumlah', key: 'value', type: 'currency', width: 22 },
        ],
        rows: [
          { label: 'Total Pemasukan', value: statement.totalIncome },
          { label: 'Total Pengeluaran', value: statement.totalExpense },
          { label: 'Surplus / Defisit', value: statement.surplus },
        ],
      },
      {
        name: 'Detail Pemasukan',
        title: 'Detail Transaksi Pemasukan',
        subtitle: `${periodLabel} — tiap baris = satu transaksi`,
        columns: [
          { header: 'No. Dokumen', key: 'docNumber', type: 'text', width: 14 },
          { header: 'Tanggal', key: 'date', type: 'date', width: 13 },
          { header: 'Kategori', key: 'category', type: 'text', width: 16 },
          { header: 'Keterangan', key: 'description', type: 'text', width: 32 },
          { header: 'Dari / Pembayar', key: 'payer', type: 'text', width: 24 },
          { header: 'Akun Tujuan', key: 'accountId', type: 'text', width: 22, getValue: (r) => accountName(r.accountId) },
          { header: 'Jumlah', key: 'amount', type: 'currency', width: 18 },
          { header: 'Status', key: 'status', type: 'text', width: 12, getValue: (r) => STATUS_LABEL[r.status] || r.status },
        ],
        rows: incomeRows,
        totals: ['amount'],
      },
      {
        name: 'Pemasukan per Kategori',
        title: 'Rekap Pemasukan per Kategori',
        subtitle: periodLabel,
        columns: [
          { header: 'Kategori', key: 'category', type: 'text', width: 26 },
          { header: 'Total', key: 'total', type: 'currency', width: 22 },
        ],
        rows: statement.incomeByCategory,
        totals: ['total'],
      },
      {
        name: 'Detail Pengeluaran',
        title: 'Detail Transaksi Pengeluaran',
        subtitle: `${periodLabel} — tiap baris = satu transaksi`,
        columns: [
          { header: 'No. Dokumen', key: 'docNumber', type: 'text', width: 14 },
          { header: 'Tanggal', key: 'date', type: 'date', width: 13 },
          { header: 'Kategori', key: 'category', type: 'text', width: 18 },
          { header: 'Keterangan', key: 'description', type: 'text', width: 32 },
          { header: 'Kepada / Penerima', key: 'recipient', type: 'text', width: 24 },
          { header: 'Akun Sumber', key: 'accountId', type: 'text', width: 22, getValue: (r) => accountName(r.accountId) },
          { header: 'Jumlah', key: 'amount', type: 'currency', width: 18 },
          { header: 'Status', key: 'status', type: 'text', width: 12, getValue: (r) => STATUS_LABEL[r.status] || r.status },
        ],
        rows: expenseRows,
        totals: ['amount'],
      },
      {
        name: 'Pengeluaran per Kategori',
        title: 'Rekap Pengeluaran per Kategori',
        subtitle: periodLabel,
        columns: [
          { header: 'Kategori', key: 'category', type: 'text', width: 26 },
          { header: 'Total', key: 'total', type: 'currency', width: 22 },
        ],
        rows: statement.expenseByCategory,
        totals: ['total'],
      },
      {
        name: 'Anggaran vs Realisasi',
        title: 'Anggaran (RAB) vs Realisasi',
        subtitle: `Periode ${budgetPeriod}`,
        columns: [
          { header: 'Kategori', key: 'category', type: 'text', width: 22 },
          { header: 'Anggaran (Rencana)', key: 'plannedAmount', type: 'currency', width: 20 },
          { header: 'Realisasi', key: 'realized', type: 'currency', width: 20 },
          { header: 'Sisa', key: 'remaining', type: 'currency', width: 20 },
          { header: 'Terpakai (%)', key: 'percent', type: 'number', width: 14, getValue: (r) => Math.round(r.percent) },
          { header: 'Catatan', key: 'notes', type: 'text', width: 26 },
        ],
        rows: budgetRealization,
        totals: ['plannedAmount', 'realized', 'remaining'],
      },
      {
        name: 'Arus Kas Bulanan',
        title: 'Arus Kas 12 Bulan Terakhir',
        columns: [
          { header: 'Bulan', key: 'month', type: 'text', width: 16 },
          { header: 'Pemasukan', key: 'income', type: 'currency', width: 20 },
          { header: 'Pengeluaran', key: 'expense', type: 'currency', width: 20 },
          { header: 'Selisih', key: 'net', type: 'currency', width: 20, getValue: (r) => r.income - r.expense },
        ],
        rows: cashflow,
        totals: ['income', 'expense', 'net'],
      },
      {
        name: 'Posisi Kas',
        title: 'Posisi Kas per Akun',
        subtitle: `Per tanggal ${formatDate(new Date().toISOString())}`,
        columns: [
          { header: 'Nama Akun', key: 'name', type: 'text', width: 26 },
          { header: 'Jenis', key: 'type', type: 'text', width: 16, getValue: (r) => (r.type === 'bank' ? 'Rekening Bank' : 'Kas Tunai') },
          { header: 'Saldo', key: 'balance', type: 'currency', width: 20 },
        ],
        rows: positions,
        totals: ['balance'],
      },
      {
        name: 'Dokumen & Bukti',
        title: 'Daftar Dokumen & Bukti Transaksi',
        subtitle: 'Seluruh dokumen tersimpan (tidak difilter periode)',
        columns: [
          { header: 'Nama Dokumen', key: 'name', type: 'text', width: 28 },
          { header: 'Kategori', key: 'category', type: 'text', width: 18 },
          { header: 'Tanggal', key: 'date', type: 'date', width: 13 },
          { header: 'Nama File', key: 'fileName', type: 'text', width: 26 },
        ],
        rows: documents,
      },
    ],
  });
}
