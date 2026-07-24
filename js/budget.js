/**
 * budget.js
 * -----------------------------------------------------------------------
 * Page module Anggaran (RAB): kelola rencana anggaran per kategori untuk
 * periode bulanan tertentu, dan bandingkan dengan realisasi pengeluaran.
 * -----------------------------------------------------------------------
 */

import { getBudgetRealization, createBudget, updateBudget, deleteBudget } from '../services/budget.service.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { createForm } from '../components/form.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { formatCurrency, required, positiveNumber } from './utils.js';
import { DEFAULT_EXPENSE_CATEGORIES } from './config.js';

export async function render(container) {
  const now = new Date();
  let period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Anggaran (RAB)</h1>
        <p>Rencanakan anggaran per kategori tiap bulan dan pantau realisasinya.</p>
      </div>
      <div class="page-header__actions">
        <input type="month" class="input" data-period-input value="${period}" />
        <button type="button" class="btn btn--primary" data-add-btn>+ Tambah Anggaran</button>
      </div>
    </div>
    <div class="card" data-table-slot></div>
  `;

  async function refresh() {
    const data = await getBudgetRealization(period);
    const slot = container.querySelector('[data-table-slot]');
    slot.innerHTML = '';
    slot.appendChild(createTable({
      columns: [
        { key: 'category', label: 'Kategori' },
        { key: 'plannedAmount', label: 'Rencana', align: 'right', render: (r) => `<span class="num">${formatCurrency(r.plannedAmount)}</span>` },
        { key: 'realized', label: 'Realisasi', align: 'right', render: (r) => `<span class="num ${r.isOverBudget ? 'text-expense' : ''}">${formatCurrency(r.realized)}</span>` },
        { key: 'remaining', label: 'Sisa', align: 'right', render: (r) => `<span class="num ${r.remaining < 0 ? 'text-expense' : 'text-income'}">${formatCurrency(r.remaining)}</span>` },
        {
          key: 'percent', label: 'Serapan',
          render: (r) => `
            <div class="row" style="min-width:140px;">
              <div style="flex:1;height:6px;border-radius:99px;background:var(--color-surface-raised);overflow:hidden;">
                <div style="height:100%;width:${Math.min(r.percent, 100)}%;background:${r.isOverBudget ? 'var(--color-expense)' : 'var(--color-accent)'};"></div>
              </div>
              <span class="text-xs num" style="width:44px;">${r.percent.toFixed(0)}%</span>
            </div>
          `,
        },
      ],
      rows: data,
      onRowClick: (row) => openFormModal(row),
      emptyMessage: 'Belum ada rencana anggaran untuk periode ini.',
    }));
  }

  function openFormModal(existing) {
    const { formEl, validate } = createForm([
      {
        name: 'category', label: 'Kategori', type: 'select',
        value: existing?.category || DEFAULT_EXPENSE_CATEGORIES[0],
        options: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
        validate: required,
      },
      { name: 'plannedAmount', label: 'Jumlah Rencana (Rp)', type: 'number', value: existing?.plannedAmount, validate: positiveNumber },
      { name: 'notes', label: 'Catatan', type: 'textarea', value: existing?.notes },
    ], {
      onSubmit: async (values) => {
        try {
          const payload = { ...values, plannedAmount: Number(values.plannedAmount), period };
          if (existing) {
            await updateBudget(existing.id, payload);
            toastSuccess('Anggaran diperbarui');
          } else {
            await createBudget(payload);
            toastSuccess('Anggaran ditambahkan');
          }
          closeModal();
          refresh();
        } catch (err) {
          toastError('Gagal menyimpan', err.message);
        }
      },
    });

    openModal({
      title: existing ? `Edit Anggaran · ${existing.category}` : 'Tambah Anggaran',
      body: formEl,
      footerButtons: [
        { label: 'Batal', variant: 'secondary', onClick: (close) => close() },
        ...(existing ? [{
          label: 'Hapus', variant: 'danger',
          onClick: (close) => confirmModal({
            title: 'Hapus anggaran ini?',
            message: `Rencana anggaran untuk "${existing.category}" akan dihapus.`,
            onConfirm: async () => {
              await deleteBudget(existing.id);
              toastSuccess('Anggaran dihapus');
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

  container.querySelector('[data-period-input]').addEventListener('change', (e) => {
    period = e.target.value;
    refresh();
  });
  container.querySelector('[data-add-btn]').addEventListener('click', () => openFormModal(null));

  await refresh();
}
