/**
 * income.service.js
 * -----------------------------------------------------------------------
 * Business logic transaksi pemasukan (SPP, dana BOS, sumbangan, dst).
 * -----------------------------------------------------------------------
 */

import * as storage from '../js/storage.js';
import { STORAGE_KEYS, TRANSACTION_STATUS } from '../js/config.js';
import { makeDocNumber, sumBy } from '../js/utils.js';

export async function listIncome(filters = {}) {
  const items = await storage.getAll(STORAGE_KEYS.INCOME);
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

export async function getIncome(id) {
  return storage.getById(STORAGE_KEYS.INCOME, id);
}

export async function createIncome({ date, category, description, amount, accountId, payer }) {
  const existing = await storage.getAll(STORAGE_KEYS.INCOME);
  const docNumber = makeDocNumber('INC', existing.length + 1);

  return storage.create(STORAGE_KEYS.INCOME, {
    docNumber,
    date,
    category,
    description: description || '',
    payer: payer || '',
    amount: Number(amount) || 0,
    accountId,
    status: TRANSACTION_STATUS.POSTED,
  }, 'inc');
}

export async function updateIncome(id, patch) {
  return storage.update(STORAGE_KEYS.INCOME, id, patch);
}

export async function voidIncome(id) {
  return storage.update(STORAGE_KEYS.INCOME, id, { status: TRANSACTION_STATUS.VOID });
}

export async function deleteIncome(id) {
  return storage.remove(STORAGE_KEYS.INCOME, id);
}

export async function getTotalIncome(filters = {}) {
  const items = await listIncome({ ...filters, status: undefined });
  return sumBy(items.filter((i) => i.status !== TRANSACTION_STATUS.VOID), 'amount');
}

/** Total pemasukan per kategori — dipakai chart & laporan */
export async function getIncomeByCategory(filters = {}) {
  const items = await listIncome(filters);
  const map = new Map();
  items
    .filter((i) => i.status !== TRANSACTION_STATUS.VOID)
    .forEach((item) => {
      map.set(item.category, (map.get(item.category) || 0) + Number(item.amount));
    });
  return Array.from(map.entries()).map(([category, total]) => ({ category, total }));
}
