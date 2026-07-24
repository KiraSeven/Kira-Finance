/**
 * expense.js
 * -----------------------------------------------------------------------
 * Page module Pengeluaran: daftar transaksi + form tambah/edit + void/hapus.
 * Struktur identik dengan income.js secara sengaja (konsistensi UX), tapi
 * terpisah karena domain data & validasi bisnisnya independen.
 * -----------------------------------------------------------------------
 */

import { listExpense, createExpense, updateExpense, voidExpense } from '../services/expense.service.js';
import { listAccounts } from '../services/account.service.js';
import { createDataTable } from '../components/datatable.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { createForm } from '../components/form.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { formatCurrency, formatDate, required, positiveNumber, todayInputValue } from './utils.js';
import { DEFAULT_EXPENSE_CATEGORIES } from './config.js';
import { exportToExcel } from './excel-export.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Pengeluaran</h1>
        <p>Catat seluruh pengeluaran sekolah: gaji, operasional, sarana, dan lainnya.</p>
      </div>
      <div class="page-header__actions">
        <button type="button" class="btn btn--secondary" data-export-btn>⭳ Export Excel</button>
        <button type="button" class="btn btn--primary" data-add-btn>+ Tambah Pengeluaran</button>
      </div>
    </div>
    <div data-table-slot></div>
  `;

  const accounts = await listAccounts();
  let table = null;

  async function refresh() {
    const items = await listExpense();
    if (table) {
      table.refresh(items);
    } else {
      table = createDataTable({
        columns: buildColumns(accounts),
        rows: items,
        searchKeys: ['docNumber', 'category', 'description', 'recipient'],
        emptyMessage: 'Belum ada pengeluaran tercatat. Tambahkan transaksi pertama.',
        onRowClick: (row) => openFormModal(row),
      });
      container.querySelector('[data-table-slot]').appendChild(table.el);
    }
  }

  function openFormModal(existing) {
    if (accounts.length === 0) {
      openModal({
        title: 'Belum ada akun kas/bank',
        body: '<p class="text-secondary">Tambahkan minimal satu akun kas/bank di menu Akun Kas & Bank sebelum mencatat pengeluaran.</p>',
        footerButtons: [{ label: 'Mengerti', variant: 'primary', onClick: (close) => close() }],
      });
      return;
    }

    const { formEl, validate } = createForm([
      { name: 'date', label: 'Tanggal', type: 'date', value: existing?.date || todayInputValue(), half: true, validate: required },
      {
        name: 'accountId', label: 'Akun Sumber', type: 'select', half: true,
        value: existing?.accountId || accounts[0]?.id,
        options: accounts.map((a) => ({ value: a.id, label: a.name })),
        validate: required,
      },
      {
        name: 'category', label: 'Kategori', type: 'select',
        value: existing?.category || DEFAULT_EXPENSE_CATEGORIES[0],
        options: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
        validate: required,
      },
      { name: 'recipient', label: 'Kepada (Penerima)', value: existing?.recipient, placeholder: 'Nama vendor / staf / pihak ketiga' },
      { name: 'amount', label: 'Jumlah (Rp)', type: 'number', value: existing?.amount, validate: positiveNumber },
      { name: 'description', label: 'Keterangan', type: 'textarea', value: existing?.description },
    ], {
      onSubmit: async (values) => {
        try {
          if (existing) {
            await updateExpense(existing.id, { ...values, amount: Number(values.amount) });
            toastSuccess('Pengeluaran diperbarui');
          } else {
            await createExpense(values);
            toastSuccess('Pengeluaran ditambahkan');
          }
          closeModal();
          refresh();
        } catch (err) {
          toastError('Gagal menyimpan', err.message);
        }
      },
    });

    openModal({
      title: existing ? `Edit Pengeluaran · ${existing.docNumber}` : 'Tambah Pengeluaran',
      body: formEl,
      footerButtons: [
        { label: 'Batal', variant: 'secondary', onClick: (close) => close() },
        ...(existing ? [{
          label: 'Void', variant: 'danger',
          onClick: (close) => confirmModal({
            title: 'Void transaksi?',
            message: `Transaksi ${existing.docNumber} akan ditandai void dan tidak dihitung dalam laporan.`,
            onConfirm: async () => {
              await voidExpense(existing.id);
              toastSuccess('Transaksi di-void');
              close();
              refresh();
            },
          }),
        }] : []),
        {
          label: existing ? 'Simpan Perubahan' : 'Simpan',
          variant: 'primary',
          onClick: () => { if (validate()) formEl.requestSubmit(); },
        },
      ],
    });
  }

  container.querySelector('[data-add-btn]').addEventListener('click', () => openFormModal(null));
  container.querySelector('[data-export-btn]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Menyiapkan file...';
    try {
      const items = await listExpense();
      await exportExpenseToExcel(items, accounts);
      toastSuccess('Export berhasil', 'File Excel pengeluaran sudah diunduh.');
    } catch (err) {
      toastError('Export gagal', err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '⭳ Export Excel';
    }
  });

  await refresh();
}

async function exportExpenseToExcel(items, accounts) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '-';
  const today = todayInputValue();
  await exportToExcel({
    filename: `pengeluaran-${today}`,
    sheets: [{
      name: 'Pengeluaran',
      title: 'Kira Finance — Daftar Pengeluaran',
      subtitle: `Diunduh ${formatDate(new Date().toISOString())} · Total ${items.length} transaksi`,
      columns: [
        { header: 'Tanggal', key: 'date', type: 'date', width: 14 },
        { header: 'No. Dokumen', key: 'docNumber', type: 'text', width: 16 },
        { header: 'Kategori', key: 'category', type: 'text', width: 18 },
        { header: 'Kepada (Penerima)', key: 'recipient', type: 'text', width: 24, getValue: (r) => r.recipient || '-' },
        { header: 'Akun Sumber', key: 'accountId', type: 'text', width: 20, getValue: (r) => accountName(r.accountId) },
        { header: 'Keterangan', key: 'description', type: 'text', width: 30, getValue: (r) => r.description || '-' },
        { header: 'Status', key: 'status', type: 'text', width: 12, getValue: (r) => (r.status === 'void' ? 'Void' : 'Posted') },
        { header: 'Jumlah', key: 'amount', type: 'currency', width: 18 },
      ],
      rows: items,
      totals: ['amount'],
    }],
  });
}

function buildColumns(accounts) {
  const accountName = (id) => accounts.find((a) => a.id === id)?.name || '-';
  return [
    { key: 'date', label: 'Tanggal', render: (r) => formatDate(r.date) },
    { key: 'docNumber', label: 'No. Dokumen' },
    { key: 'category', label: 'Kategori' },
    { key: 'recipient', label: 'Kepada' },
    { key: 'accountId', label: 'Akun', render: (r) => accountName(r.accountId) },
    {
      key: 'status', label: 'Status',
      render: (r) => `<span class="badge badge--${r.status === 'void' ? 'neutral' : 'expense'}"><span class="badge__dot"></span>${r.status === 'void' ? 'Void' : 'Posted'}</span>`,
    },
    { key: 'amount', label: 'Jumlah', align: 'right', render: (r) => `<span class="num text-expense">${formatCurrency(r.amount)}</span>` },
  ];
}
