/**
 * expense.service.js
 * -----------------------------------------------------------------------
 * Business logic transaksi pengeluaran (gaji, operasional, sarana, dst).
 * -----------------------------------------------------------------------
 */

import * as storage from '../js/storage.js';
import { STORAGE_KEYS, TRANSACTION_STATUS } from '../js/config.js';
import { makeDocNumber, sumBy } from '../js/utils.js';

export async function listExpense(filters = {}) {
  const items = await storage.getAll(STORAGE_KEYS.EXPENSE);
  return items
    .filter((item) => {
      if (filters.accountId && item.accountId !== filters.accountId) return false;
      if (filters.category && item.category !== filters.category) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.from && item.date < filters.from) return false;
      if (filters.to && item.date > filters.to) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getExpense(id) {
  return storage.getById(STORAGE_KEYS.EXPENSE, id);
}

export async function createExpense({ date, category, description, amount, accountId, recipient }) {
  const existing = await storage.getAll(STORAGE_KEYS.EXPENSE);
  const docNumber = makeDocNumber('EXP', existing.length + 1);

  return storage.create(STORAGE_KEYS.EXPENSE, {
    docNumber,
    date,
    category,
    description: description || '',
    recipient: recipient || '',
    amount: Number(amount) || 0,
    accountId,
    status: TRANSACTION_STATUS.POSTED,
  }, 'exp');
}

export async function updateExpense(id, patch) {
  return storage.update(STORAGE_KEYS.EXPENSE, id, patch);
}

export async function voidExpense(id) {
  return storage.update(STORAGE_KEYS.EXPENSE, id, { status: TRANSACTION_STATUS.VOID });
}

export async function deleteExpense(id) {
  return storage.remove(STORAGE_KEYS.EXPENSE, id);
}

export async function getTotalExpense(filters = {}) {
  const items = await listExpense({ ...filters, status: undefined });
  return sumBy(items.filter((i) => i.status !== TRANSACTION_STATUS.VOID), 'amount');
}

export async function getExpenseByCategory(filters = {}) {
  const items = await listExpense(filters);
  const map = new Map();
  items
    .filter((i) => i.status !== TRANSACTION_STATUS.VOID)
    .forEach((item) => {
      map.set(item.category, (map.get(item.category) || 0) + Number(item.amount));
    });
  return Array.from(map.entries()).map(([category, total]) => ({ category, total }));
}
