/**
 * users.js
 * -----------------------------------------------------------------------
 * Page module Pengguna: CRUD akun pengguna & role. Hanya bisa diakses
 * role admin (dijaga ROUTE_PERMISSIONS di config.js + guard di router.js).
 * -----------------------------------------------------------------------
 */

import { listUsers, createUser, updateUser, sendPasswordReset } from '../services/auth.service.js';
import { createTable } from '../components/table.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { createForm } from '../components/form.js';
import { toastSuccess, toastError } from '../components/toast.js';
import { formatDate, required } from './utils.js';
import { ROLES, ROLE_LABELS } from './config.js';
import { getCurrentSession } from './auth.js';

const ROLE_OPTIONS = Object.values(ROLES).map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header__text">
        <h1 class="text-2xl">Pengguna</h1>
        <p>Kelola akun staf yang dapat mengakses sistem keuangan sekolah ini.</p>
      </div>
      <div class="page-header__actions">
        <button type="button" class="btn btn--primary" data-add-btn>+ Tambah Pengguna</button>
      </div>
    </div>
    <div class="card" data-table-slot></div>
  `;

  const session = getCurrentSession();

  async function refresh() {
    const users = await listUsers();
    const slot = container.querySelector('[data-table-slot]');
    slot.innerHTML = '';
    slot.appendChild(createTable({
      columns: [
        { key: 'name', label: 'Nama' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', render: (r) => `<span class="badge badge--info">${ROLE_LABELS[r.role] || r.role}</span>` },
        { key: 'active', label: 'Status', render: (r) => `<span class="badge badge--${r.active ? 'income' : 'neutral'}">${r.active ? 'Aktif' : 'Nonaktif'}</span>` },
        { key: 'createdAt', label: 'Dibuat', render: (r) => formatDate(r.createdAt) },
      ],
      rows: users,
      onRowClick: (row) => openFormModal(row),
      emptyMessage: 'Belum ada pengguna lain selain Anda.',
    }));
  }

  function openFormModal(existing) {
    const isSelf = existing?.id === session?.userId;
    const { formEl, validate } = createForm([
      { name: 'name', label: 'Nama Lengkap', value: existing?.name, validate: required },
      { name: 'email', label: 'Email', type: 'email', value: existing?.email, half: true, validate: required, disabled: Boolean(existing) },
      { name: 'role', label: 'Role', type: 'select', value: existing?.role || ROLES.STAFF, half: true, options: ROLE_OPTIONS },
      ...(existing ? [] : [{
        name: 'password', label: 'Kata Sandi', type: 'password',
        placeholder: 'Minimal 6 karakter', validate: required,
      }]),
    ], {
      onSubmit: async (values) => {
        try {
          if (existing) {
            const { email, password, ...patch } = values;
            await updateUser(existing.id, patch);
            toastSuccess('Pengguna diperbarui');
          } else {
            await createUser(values);
            toastSuccess('Pengguna ditambahkan');
          }
          closeModal();
          refresh();
        } catch (err) {
          toastError('Gagal menyimpan', err.message);
        }
      },
    });

    openModal({
      title: existing ? `Edit Pengguna · ${existing.name}` : 'Tambah Pengguna',
      body: formEl,
      footerButtons: [
        { label: 'Batal', variant: 'secondary', onClick: (close) => close() },
        ...(existing ? [{
          label: 'Kirim Link Reset Kata Sandi',
          variant: 'secondary',
          onClick: async () => {
            try {
              await sendPasswordReset(existing.email);
              toastSuccess('Email reset kata sandi terkirim', `Tautan dikirim ke ${existing.email}.`);
            } catch (err) {
              toastError('Gagal mengirim email reset', err.message);
            }
          },
        }] : []),
        ...(existing && !isSelf ? [{
          label: existing.active ? 'Nonaktifkan' : 'Aktifkan',
          variant: 'danger',
          onClick: (close) => confirmModal({
            title: existing.active ? 'Nonaktifkan pengguna?' : 'Aktifkan pengguna?',
            message: `${existing.name} ${existing.active ? 'tidak akan bisa login setelah dinonaktifkan.' : 'akan bisa login kembali.'}`,
            danger: existing.active,
            onConfirm: async () => {
              await updateUser(existing.id, { active: !existing.active });
              toastSuccess('Status pengguna diperbarui');
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
