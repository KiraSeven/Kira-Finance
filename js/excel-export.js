/**
 * excel-export.js
 * -----------------------------------------------------------------------
 * Utility reusable untuk export data tabel ke file Excel (.xlsx) yang rapi:
 * header bold dengan fill warna brand, border tipis di semua sel, format
 * angka Rupiah asli (bukan teks), kolom tanggal jadi Date asli (bisa
 * di-sort/filter di Excel), lebar kolom otomatis, baris zebra, dan baris
 * total di bagian bawah untuk kolom numerik.
 *
 * Dipakai oleh halaman mana pun yang punya tabel transaksi/laporan —
 * cukup kirim { filename, sheets }, tidak perlu tahu detail styling.
 *
 * Library: ExcelJS (di-load on-demand dari esm.sh, tanpa build step,
 * konsisten dengan arsitektur vanilla ES module project ini).
 * -----------------------------------------------------------------------
 */

import { downloadFile } from './utils.js';
import { APP_NAME } from './config.js';

const EXCELJS_CDN = 'https://esm.sh/exceljs@4.4.0';

// Warna brand (senada design token di variables.css) untuk header sheet.
const HEADER_FILL = 'FF2563EB';   // biru -> selaras --color-accent-gradient
const HEADER_TEXT = 'FFFFFFFF';
const ZEBRA_FILL = 'FF0D1526';    // senada --color-surface
const BORDER_COLOR = 'FF3A4A63';
const TITLE_TEXT = 'FF22D3EE';    // cyan -> selaras --color-accent

let exceljsPromise = null;
function loadExcelJs() {
  if (!exceljsPromise) {
    exceljsPromise = import(/* @vite-ignore */ EXCELJS_CDN).then((mod) => mod.default ?? mod);
  }
  return exceljsPromise;
}

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
};

/**
 * @typedef {{
 *   header: string,
 *   key: string,
 *   width?: number,
 *   type?: 'text'|'number'|'currency'|'date',
 *   align?: 'left'|'center'|'right',
 *   getValue?: (row: object) => any,
 * }} ExcelColumn
 *
 * @typedef {{
 *   name: string,                 // nama sheet (maks 31 char, tanpa karakter aneh)
 *   title?: string,               // judul besar di baris paling atas
 *   subtitle?: string,            // sub-judul (mis. rentang tanggal)
 *   columns: ExcelColumn[],
 *   rows: object[],
 *   totals?: string[],            // key kolom yang mau dijumlah di baris akhir
 * }} ExcelSheetDef
 */

/** @param {{ filename: string, sheets: ExcelSheetDef[] }} options */
export async function exportToExcel({ filename, sheets }) {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = APP_NAME;
  workbook.created = new Date();

  sheets.forEach((sheetDef) => buildSheet(workbook, sheetDef));

  const buffer = await workbook.xlsx.writeBuffer();
  downloadFile(
    filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
    buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

function buildSheet(workbook, { name, title, subtitle, columns, rows, totals = [] }) {
  const sheet = workbook.addWorksheet(safeSheetName(name), {
    views: [{ showGridLines: false }],
  });

  const colCount = columns.length;
  let cursorRow = 1;

  // --- Judul & sub-judul (merged row, di atas tabel) ---
  if (title) {
    sheet.mergeCells(cursorRow, 1, cursorRow, colCount);
    const cell = sheet.getCell(cursorRow, 1);
    cell.value = title;
    cell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: TITLE_TEXT } };
    cell.alignment = { vertical: 'middle' };
    sheet.getRow(cursorRow).height = 24;
    cursorRow += 1;
  }
  if (subtitle) {
    sheet.mergeCells(cursorRow, 1, cursorRow, colCount);
    const cell = sheet.getCell(cursorRow, 1);
    cell.value = subtitle;
    cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
    cursorRow += 1;
  }
  if (title || subtitle) cursorRow += 1; // baris kosong pemisah

  // --- Header kolom ---
  const headerRowIndex = cursorRow;
  const headerRow = sheet.getRow(headerRowIndex);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: col.align || 'left', wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;
  cursorRow += 1;

  // --- Baris data ---
  const dataStartRow = cursorRow;
  rows.forEach((row, rowIdx) => {
    const excelRow = sheet.getRow(cursorRow);
    columns.forEach((col, i) => {
      const rawValue = col.getValue ? col.getValue(row) : row[col.key];
      const cell = excelRow.getCell(i + 1);
      applyValueAndFormat(cell, rawValue, col.type);
      cell.alignment = { vertical: 'middle', horizontal: col.align || (col.type === 'currency' || col.type === 'number' ? 'right' : 'left') };
      cell.border = THIN_BORDER;
      if (rowIdx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
      }
    });
    cursorRow += 1;
  });

  // --- Baris total (opsional) ---
  if (totals.length && rows.length) {
    const totalRow = sheet.getRow(cursorRow);
    columns.forEach((col, i) => {
      const cell = totalRow.getCell(i + 1);
      cell.border = { ...THIN_BORDER, top: { style: 'double', color: { argb: BORDER_COLOR } } };
      cell.font = { bold: true };
      if (i === 0) {
        cell.value = 'TOTAL';
        cell.alignment = { horizontal: 'left' };
      } else if (totals.includes(col.key)) {
        const sum = rows.reduce((acc, r) => acc + (Number(col.getValue ? col.getValue(r) : r[col.key]) || 0), 0);
        applyValueAndFormat(cell, sum, col.type);
        cell.alignment = { horizontal: 'right' };
      }
    });
    cursorRow += 1;
  }

  if (rows.length === 0) {
    sheet.mergeCells(cursorRow, 1, cursorRow, colCount);
    const cell = sheet.getCell(cursorRow, 1);
    cell.value = 'Tidak ada data untuk ditampilkan.';
    cell.font = { italic: true, color: { argb: 'FF94A3B8' } };
    cell.alignment = { horizontal: 'center' };
  }

  // --- Lebar kolom otomatis ---
  columns.forEach((col, i) => {
    const headerLen = String(col.header || '').length;
    const maxContentLen = rows.reduce((max, row) => {
      const v = col.getValue ? col.getValue(row) : row[col.key];
      return Math.max(max, String(formatForWidth(v, col.type)).length);
    }, 0);
    sheet.getColumn(i + 1).width = col.width || Math.min(Math.max(headerLen, maxContentLen) + 4, 42);
  });

  // --- Freeze header row biar tetap kelihatan saat scroll ---
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex, showGridLines: false }];

  // Auto-filter dropdown di header
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: dataStartRow + rows.length - 1, column: colCount },
    };
  }
}

function applyValueAndFormat(cell, rawValue, type) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    cell.value = '-';
    return;
  }
  switch (type) {
    case 'currency':
      cell.value = Number(rawValue) || 0;
      cell.numFmt = '"Rp" #,##0;[Red]-"Rp" #,##0';
      break;
    case 'number':
      cell.value = Number(rawValue) || 0;
      cell.numFmt = '#,##0';
      break;
    case 'date': {
      const d = rawValue instanceof Date ? rawValue : new Date(rawValue);
      if (Number.isNaN(d.getTime())) {
        cell.value = String(rawValue);
      } else {
        cell.value = d;
        cell.numFmt = 'dd/mm/yyyy';
      }
      break;
    }
    default:
      cell.value = String(rawValue);
  }
}

function formatForWidth(value, type) {
  if (type === 'currency') return `Rp ${Number(value) || 0}`;
  return value ?? '';
}

/** Nama sheet Excel maksimal 31 karakter & tidak boleh ada : \ / ? * [ ] */
function safeSheetName(name) {
  return String(name).replace(/[:\\/?*[\]]/g, '-').slice(0, 31);
}
