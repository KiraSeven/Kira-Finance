/**
 * sidebar.js
 * -----------------------------------------------------------------------
 * Sidebar navigasi utama, dibangun dari NAV_GROUPS (config.js) dan
 * difilter sesuai role user yang sedang login (ROUTE_PERMISSIONS).
 * -----------------------------------------------------------------------
 */

import { NAV_GROUPS, APP_NAME } from '../js/config.js';
import { getCurrentSession, canAccessRoute, logout } from '../js/auth.js';
import { getInitials } from '../js/utils.js';
import { ROLE_LABELS } from '../js/config.js';

const ICONS = {
  grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  'arrow-down-circle': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12l4 4 4-4"/></svg>',
  'arrow-up-circle': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16V8M8 12l4-4 4 4"/></svg>',
  book: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>',
  target: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  wallet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
  'bar-chart': '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M8 17V10M13 17V6M18 17v-4"/></svg>',
  file: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
  shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
  database: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>',
  'log-out': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
};

/**
 * @param {{ currentPath: string, onNavigate: (path: string) => void }} options
 */
export function renderSidebar({ currentPath, onNavigate }) {
  const session = getCurrentSession();
  const el = document.createElement('aside');
  el.className = 'sidebar';

  const nav = document.createElement('nav');
  nav.className = 'sidebar__nav';

  NAV_GROUPS.forEach((group) => {
    const visibleItems = group.items.filter((item) => canAccessRoute(item.path));
    if (visibleItems.length === 0) return;

    const groupLabel = document.createElement('div');
    groupLabel.className = 'sidebar__group-label';
    groupLabel.textContent = group.label;
    nav.appendChild(groupLabel);

    visibleItems.forEach((item) => {
      const link = document.createElement('a');
      link.href = `#${item.path}`;
      link.className = `sidebar__link${currentPath === item.path ? ' sidebar__link--active' : ''}`;
      link.innerHTML = `
        <span class="sidebar__link-icon">${ICONS[item.icon] || ''}</span>
        <span class="sidebar__link-label">${item.label}</span>
      `;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        onNavigate(item.path);
      });
      nav.appendChild(link);
    });
  });

  el.innerHTML = `
    <div class="sidebar__brand">
      <img class="sidebar__brand-mark sidebar__brand-mark--img" src="icons/logo.png" alt="${APP_NAME}" />
      <span class="sidebar__brand-name">${APP_NAME}</span>
    </div>
  `;
  el.appendChild(nav);

  const footer = document.createElement('div');
  footer.className = 'sidebar__footer';
  footer.innerHTML = `
    <div class="sidebar__user">
      <span class="avatar">${getInitials(session?.name)}</span>
      <div class="sidebar__user-meta">
        <span class="sidebar__user-name">${session?.name || ''}</span>
        <span class="sidebar__user-role">${ROLE_LABELS[session?.role] || ''}</span>
      </div>
      <button type="button" class="icon-btn" data-logout-btn aria-label="Keluar" style="margin-left:auto;">
        ${ICONS['log-out']}
      </button>
    </div>
  `;
  footer.querySelector('[data-logout-btn]').addEventListener('click', async () => {
    await logout();
    window.location.hash = '/login';
  });
  el.appendChild(footer);

  return el;
}
