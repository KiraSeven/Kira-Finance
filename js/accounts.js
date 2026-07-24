/**
 * accounts.js
 * -----------------------------------------------------------------------
 * Page module Akun Kas & Bank: daftar akun beserta saldo berjalan
 * (dihitung otomatis dari transaksi income/expense oleh account.service.js).
 * -----------------------------------------------------------------------
 */

import { getAllBalances, createAccount, updateAccount, deleteAccount } from '../services/account.service.js';
import { createMetricCard } from '../components/card.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { createForm } from '../components/form.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { formatCurrency, required } from './utils.js';

const ACCOUNT_TYPES = [
  { value: 'kas', label: 'Kas Tunai' },
  { value: 'bank', label: 'Rekening Bank' },
];

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Akun Kas & Bank</h1>
        <p>Kelola akun penyimpanan dana sekolah beserta saldo berjalannya.</p>
      </div>
      <div class="page-header__actions">
        <button type="button" class="btn btn--primary" data-add-btn>+ Tambah Akun</button>
      </div>
    </div>
    <div class="section grid grid-cols-3" data-cards></div>
    <div class="section card">
      <h3 class="text-lg" style="margin-bottom:var(--space-4);">Semua Akun</h3>
      <div data-table-slot></div>
    </div>
  `;

  async function refresh() {
    const accounts = await getAllBalances();

    const cardsEl = container.querySelector('[data-cards]');
    cardsEl.innerHTML = '';
    accounts.forEach((acc) => {
      cardsEl.appendChild(createMetricCard({
        label: `${acc.name} · ${acc.type === 'bank' ? 'Bank' : 'Kas'}`,
        value: formatCurrency(acc.balance),
      }));
    });

    container.querySelector('[data-table-slot]').innerHTML = '';
    container.querySelector('[data-table-slot]').appendChild(createTable({
      columns: [
        { key: 'name', label: 'Nama Akun' },
        { key: 'type', label: 'Jenis', render: (r) => (r.type === 'bank' ? 'Rekening Bank' : 'Kas Tunai') },
        { key: 'openingBalance', label: 'Saldo Awal', align: 'right', render: (r) => `<span class="num">${formatCurrency(r.openingBalance)}</span>` },
        { key: 'balance', label: 'Saldo Berjalan', align: 'right', render: (r) => `<span class="num text-accent">${formatCurrency(r.balance)}</span>` },
        {
          key: 'actions', label: '', align: 'right',
          render: () => `<button class="btn btn--ghost btn--sm" data-edit-row>Kelola</button>`,
        },
      ],
      rows: accounts,
      onRowClick: (row) => openFormModal(row),
      emptyMessage: 'Belum ada akun kas/bank. Tambahkan akun pertama untuk mulai mencatat transaksi.',
    }));
  }

  function openFormModal(existing) {
    const { formEl, validate } = createForm([
      { name: 'name', label: 'Nama Akun', value: existing?.name, placeholder: 'Kas Bendahara / BRI 1234567890', validate: required },
      {
        name: 'type', label: 'Jenis Akun', type: 'select',
        value: existing?.type || 'kas', options: ACCOUNT_TYPES, half: true,
      },
      {
        name: 'openingBalance', label: 'Saldo Awal (Rp)', type: 'number',
        value: existing?.openingBalance ?? 0, half: true,
        hint: existing ? 'Mengubah saldo awal akan mengubah saldo berjalan akun ini.' : undefined,
      },
    ], {
      onSubmit: async (values) => {
        try {
          const payload = { ...values, openingBalance: Number(values.openingBalance) || 0 };
          if (existing) {
            await updateAccount(existing.id, payload);
            toastSuccess('Akun diperbarui');
          } else {
            await createAccount(payload);
            toastSuccess('Akun ditambahkan');
          }
          closeModal();
          refresh();
        } catch (err) {
          toastError('Gagal menyimpan', err.message);
        }
      },
    });

    openModal({
      title: existing ? `Kelola Akun · ${existing.name}` : 'Tambah Akun',
      body: formEl,
      footerButtons: [
        { label: 'Batal', variant: 'secondary', onClick: (close) => close() },
        ...(existing ? [{
          label: 'Hapus Akun', variant: 'danger',
          onClick: (close) => confirmModal({
            title: 'Hapus akun ini?',
            message: `Akun "${existing.name}" akan dihapus. Transaksi yang sudah tercatat pada akun ini tidak akan ikut terhapus.`,
            onConfirm: async () => {
              await deleteAccount(existing.id);
              toastSuccess('Akun dihapus');
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

  await refresh();
}
