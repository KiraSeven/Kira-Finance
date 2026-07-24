/**
 * journal.js
 * -----------------------------------------------------------------------
 * Page module Jurnal Umum: gabungan seluruh transaksi (pemasukan =
 * debit kas, pengeluaran = kredit kas) dalam satu tabel kronologis,
 * dengan filter rentang tanggal. Read-only — editing tetap lewat halaman
 * Pemasukan/Pengeluaran masing-masing agar sumber kebenaran tetap satu.
 * -----------------------------------------------------------------------
 */

import { listIncome } from '../services/income.service.js';
import { listExpense } from '../services/expense.service.js';
import { listAccounts } from '../services/account.service.js';
import { createDataTable } from '../components/datatable.js';
import { formatCurrency, formatDate, todayInputValue } from './utils.js';
import { exportToExcel } from './excel-export.js';
import { toastSuccess, toastError } from '../components/toast.js';

export async function render(container) {
  const firstOfMonth = todayInputValue().slice(0, 8) + '01';

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Jurnal Umum</h1>
        <p>Seluruh transaksi pemasukan & pengeluaran dalam satu catatan kronologis.</p>
      </div>
      <div class="page-header__actions">
        <input type="date" class="input" data-from value="${firstOfMonth}" />
        <span class="text-muted">s/d</span>
        <input type="date" class="input" data-to value="${todayInputValue()}" />
        <button type="button" class="btn btn--secondary" data-export-btn>⭳ Export Excel</button>
      </div>
    </div>
    <div class="card" data-table-slot></div>
  `;

  const accounts = await listAccounts();
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '-';
  let table = null;
  let currentRows = [];
  let currentRange = { from: '', to: '' };

  async function refresh() {
    const from = container.querySelector('[data-from]').value;
    const to = container.querySelector('[data-to]').value;
    currentRange = { from, to };

    const [incomes, expenses] = await Promise.all([
      listIncome({ from, to }),
      listExpense({ from, to }),
    ]);

    const rows = [
      ...incomes.map((t) => ({ ...t, kind: 'Pemasukan' })),
      ...expenses.map((t) => ({ ...t, kind: 'Pengeluaran' })),
    ].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
    currentRows = rows;

    const columns = [
      { key: 'date', label: 'Tanggal', render: (r) => formatDate(r.date) },
      { key: 'docNumber', label: 'No. Dokumen' },
      { key: 'kind', label: 'Jenis', render: (r) => `<span class="badge badge--${r.kind === 'Pemasukan' ? 'income' : 'expense'}">${r.kind}</span>` },
      { key: 'category', label: 'Kategori' },
      { key: 'accountId', label: 'Akun', render: (r) => accountName(r.accountId) },
      { key: 'description', label: 'Keterangan' },
      {
        key: 'debit', label: 'Debit', align: 'right',
        render: (r) => (r.kind === 'Pemasukan' ? `<span class="num text-income">${formatCurrency(r.amount)}</span>` : '-'),
      },
      {
        key: 'credit', label: 'Kredit', align: 'right',
        render: (r) => (r.kind === 'Pengeluaran' ? `<span class="num text-expense">${formatCurrency(r.amount)}</span>` : '-'),
      },
    ];

    if (table) {
      table.refresh(rows);
    } else {
      table = createDataTable({
        columns, rows,
        searchKeys: ['docNumber', 'category', 'description'],
        pageSize: 15,
        emptyMessage: 'Tidak ada transaksi pada rentang tanggal ini.',
      });
      container.querySelector('[data-table-slot]').appendChild(table.el);
    }
  }

  container.querySelector('[data-from]').addEventListener('change', refresh);
  container.querySelector('[data-to]').addEventListener('change', refresh);

  container.querySelector('[data-export-btn]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Menyiapkan file...';
    try {
      await exportJournalToExcel(currentRows, currentRange, accountName);
      toastSuccess('Export berhasil', 'File Excel jurnal umum sudah diunduh.');
    } catch (err) {
      toastError('Export gagal', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '⭳ Export Excel';
    }
  });

  await refresh();
}

async function exportJournalToExcel(rows, { from, to }, accountName) {
  const today = todayInputValue();

  await exportToExcel({
    filename: `jurnal-umum-${today}`,
    sheets: [{
      name: 'Jurnal Umum',
      title: 'Kira Finance — Jurnal Umum',
      subtitle: `Periode ${formatDate(from)} s/d ${formatDate(to)} · Diunduh ${formatDate(new Date().toISOString())} · Total ${rows.length} transaksi`,
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
      rows,
      totals: ['debit', 'credit'],
    }],
  });
}
