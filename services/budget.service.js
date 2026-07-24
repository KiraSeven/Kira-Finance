/**
 * budget.service.js
 * -----------------------------------------------------------------------
 * Business logic Rencana Anggaran Belanja (RAB): CRUD baris anggaran per
 * kategori/periode, dan perbandingan dengan realisasi pengeluaran aktual.
 * -----------------------------------------------------------------------
 */

import * as storage from '../js/storage.js';
import { STORAGE_KEYS } from '../js/config.js';
import { listExpense } from './expense.service.js';
import { clamp } from '../js/utils.js';

export async function listBudgets(period) {
  const items = await storage.getAll(STORAGE_KEYS.BUDGET, period ? (b) => b.period === period : undefined);
  return items.sort((a, b) => a.category.localeCompare(b.category));
}

export async function createBudget({ period, category, plannedAmount, notes }) {
  return storage.create(STORAGE_KEYS.BUDGET, {
    period,
    category,
    plannedAmount: Number(plannedAmount) || 0,
    notes: notes || '',
  }, 'bud');
}

export async function updateBudget(id, patch) {
  return storage.update(STORAGE_KEYS.BUDGET, id, patch);
}

export async function deleteBudget(id) {
  return storage.remove(STORAGE_KEYS.BUDGET, id);
}

/**
 * Gabungkan anggaran dengan realisasi pengeluaran per kategori pada
 * periode (format "YYYY-MM") yang sama, lengkap dengan persentase serapan.
 */
export async function getBudgetRealization(period) {
  const [budgets, expenses] = await Promise.all([
    listBudgets(period),
    listExpense({ from: `${period}-01`, to: `${period}-31` }),
  ]);

  const realizedMap = new Map();
  expenses.forEach((exp) => {
    realizedMap.set(exp.category, (realizedMap.get(exp.category) || 0) + Number(exp.amount));
  });

  return budgets.map((budget) => {
    const realized = realizedMap.get(budget.category) || 0;
    const percent = budget.plannedAmount > 0 ? clamp((realized / budget.plannedAmount) * 100, 0, 999) : 0;
    return {
      ...budget,
      realized,
      remaining: budget.plannedAmount - realized,
      percent,
      isOverBudget: realized > budget.plannedAmount,
    };
  });
}
