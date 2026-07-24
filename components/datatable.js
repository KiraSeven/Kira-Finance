/**
 * datatable.js
 * -----------------------------------------------------------------------
 * Tabel data lengkap dengan search lokal, pagination, dan optional toolbar
 * slot (mis. filter dropdown, tombol export). Membungkus table.js untuk
 * rendering baris — jangan duplikasi markup <table> di sini.
 * -----------------------------------------------------------------------
 */

import { createTable } from './table.js';
import { debounce, escapeHtml } from '../js/utils.js';

/**
 * @param {{
 *   columns: object[],
 *   rows: object[],
 *   searchKeys?: string[],
 *   pageSize?: number,
 *   onRowClick?: (row: object) => void,
 *   toolbarExtra?: HTMLElement,
 *   emptyMessage?: string,
 * }} options
 */
export function createDataTable({ columns, rows, searchKeys = [], pageSize = 10, onRowClick, toolbarExtra, emptyMessage }) {
  const container = document.createElement('div');
  let currentPage = 1;
  let query = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'datatable__toolbar';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = 'Cari data...';
  searchInput.className = 'input datatable__search';

  const toolbarRight = document.createElement('div');
  toolbarRight.className = 'row';
  if (toolbarExtra) toolbarRight.appendChild(toolbarExtra);

  toolbar.appendChild(searchInput);
  toolbar.appendChild(toolbarRight);

  const tableSlot = document.createElement('div');
  const footer = document.createElement('div');
  footer.className = 'datatable__footer';

  container.appendChild(toolbar);
  container.appendChild(tableSlot);
  container.appendChild(footer);

  function getFiltered() {
    if (!query) return rows;
    const q = query.toLowerCase();
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key);
    return rows.filter((row) => keys.some((key) => String(row[key] ?? '').toLowerCase().includes(q)));
  }

  function render() {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    tableSlot.innerHTML = '';
    tableSlot.appendChild(createTable({ columns, rows: pageRows, onRowClick, emptyMessage }));

    footer.innerHTML = '';
    const info = document.createElement('span');
    info.textContent = filtered.length === 0
      ? 'Menampilkan 0 data'
      : `Menampilkan ${start + 1}–${Math.min(start + pageSize, filtered.length)} dari ${filtered.length} data`;
    footer.appendChild(info);

    if (totalPages > 1) {
      const pagination = document.createElement('div');
      pagination.className = 'pagination';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'pagination__btn';
      prevBtn.innerHTML = '&larr;';
      prevBtn.disabled = currentPage === 1;
      prevBtn.addEventListener('click', () => { currentPage -= 1; render(); });
      pagination.appendChild(prevBtn);

      for (let p = 1; p <= totalPages; p += 1) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination__btn${p === currentPage ? ' pagination__btn--active' : ''}`;
        pageBtn.textContent = String(p);
        pageBtn.addEventListener('click', () => { currentPage = p; render(); });
        pagination.appendChild(pageBtn);
      }

      const nextBtn = document.createElement('button');
      nextBtn.className = 'pagination__btn';
      nextBtn.innerHTML = '&rarr;';
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.addEventListener('click', () => { currentPage += 1; render(); });
      pagination.appendChild(nextBtn);

      footer.appendChild(pagination);
    }
  }

  searchInput.addEventListener('input', debounce((e) => {
    query = e.target.value.trim();
    currentPage = 1;
    render();
  }, 250));

  render();

  return {
    el: container,
    refresh: (newRows) => { rows = newRows; currentPage = 1; render(); },
  };
}
