/**
 * table.js
 * -----------------------------------------------------------------------
 * Tabel HTML dasar tanpa search/pagination (dipakai untuk daftar pendek,
 * mis. rincian anggaran). Untuk tabel besar dengan search & pagination,
 * pakai components/datatable.js yang membungkus komponen ini.
 * -----------------------------------------------------------------------
 */

import { escapeHtml } from '../js/utils.js';
import { createEmptyState } from './card.js';

/**
 * @param {{
 *   columns: { key: string, label: string, align?: 'left'|'right'|'center', render?: (row: object) => string }[],
 *   rows: object[],
 *   onRowClick?: (row: object) => void,
 *   emptyMessage?: string,
 * }} options
 */
export function createTable({ columns, rows, onRowClick, emptyMessage = 'Belum ada data.' }) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  if (!rows || rows.length === 0) {
    wrap.appendChild(createEmptyState({
      title: 'Tidak ada data',
      message: emptyMessage,
    }));
    return wrap;
  }

  const table = document.createElement('table');
  table.className = `table${onRowClick ? ' table--clickable' : ''}`;

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${columns.map((col) => `
    <th style="${col.align ? `text-align:${col.align}` : ''}">${escapeHtml(col.label)}</th>
  `).join('')}</tr>`;

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = columns.map((col) => {
      const content = col.render ? col.render(row) : escapeHtml(row[col.key] ?? '-');
      return `<td style="${col.align ? `text-align:${col.align}` : ''}">${content}</td>`;
    }).join('');
    if (onRowClick) tr.addEventListener('click', () => onRowClick(row));
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}
