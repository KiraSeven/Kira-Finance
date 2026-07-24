/**
 * form.js
 * -----------------------------------------------------------------------
 * Form builder deklaratif: definisikan array field, dapat elemen <form>
 * siap pakai + fungsi getValues()/validate(). Dipakai di semua modal
 * create/edit (income, expense, accounts, budget, users, dst) supaya
 * markup form tidak diulang-ulang di tiap page module.
 * -----------------------------------------------------------------------
 */

import { escapeHtml } from '../js/utils.js';

/**
 * @typedef {{
 *   name: string, label: string, type?: 'text'|'number'|'date'|'select'|'textarea'|'email'|'password',
 *   options?: {value:string,label:string}[], value?: any, placeholder?: string,
 *   validate?: (value: any) => string | null, half?: boolean, hint?: string,
 * }} FieldDef
 */

/** @param {FieldDef[]} fields */
export function createForm(fields, { onSubmit } = {}) {
  const form = document.createElement('form');
  form.className = 'stack';
  form.noValidate = true;

  const grid = document.createElement('div');
  grid.className = 'form-grid';
  form.appendChild(grid);

  fields.forEach((field) => {
    const fieldEl = document.createElement('div');
    fieldEl.className = 'field';
    fieldEl.style.gridColumn = field.half ? 'span 1' : '1 / -1';

    const label = document.createElement('label');
    label.className = 'field__label';
    label.textContent = field.label;
    label.htmlFor = `field-${field.name}`;
    fieldEl.appendChild(label);

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'select';
      input.innerHTML = (field.options || []).map((opt) => `
        <option value="${escapeHtml(opt.value)}" ${opt.value === field.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>
      `).join('');
    } else if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'textarea';
      input.value = field.value ?? '';
    } else {
      input = document.createElement('input');
      input.className = 'input';
      input.type = field.type || 'text';
      if (field.value !== undefined && field.value !== null) input.value = field.value;
    }

    input.id = `field-${field.name}`;
    input.name = field.name;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.disabled) input.disabled = true;
    fieldEl.appendChild(input);

    if (field.hint) {
      const hint = document.createElement('span');
      hint.className = 'field__hint';
      hint.textContent = field.hint;
      fieldEl.appendChild(hint);
    }

    const errorEl = document.createElement('span');
    errorEl.className = 'field__error';
    errorEl.style.display = 'none';
    fieldEl.appendChild(errorEl);

    fieldEl.dataset.fieldName = field.name;
    grid.appendChild(fieldEl);
  });

  function getValues() {
    const values = {};
    fields.forEach((field) => {
      const input = form.querySelector(`[name="${field.name}"]`);
      values[field.name] = input.value;
    });
    return values;
  }

  function validate() {
    const values = getValues();
    let isValid = true;
    fields.forEach((field) => {
      const fieldEl = grid.querySelector(`[data-field-name="${field.name}"]`);
      const errorEl = fieldEl.querySelector('.field__error');
      const input = fieldEl.querySelector('.input, .select, .textarea');
      const error = field.validate ? field.validate(values[field.name]) : null;

      if (error) {
        isValid = false;
        errorEl.textContent = error;
        errorEl.style.display = 'block';
        input.classList.add('input--error');
      } else {
        errorEl.style.display = 'none';
        input.classList.remove('input--error');
      }
    });
    return isValid;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (validate()) onSubmit?.(getValues());
  });

  return { formEl: form, getValues, validate };
}
