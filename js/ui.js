/*
 * UI-примитивы: функции, которые возвращают HTML-строки (иконки, кнопки, заголовки),
 * плюс нижний лист (sheet) и всплывающее сообщение (toast).
 */
(function (GN) {
  'use strict';

  /** Экранирование всего, что пришло из данных пользователя. */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const PATHS = {
    today: 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    program: 'M4 7h16M4 7v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7M4 7V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1M8 2v4M16 2v4M8 12h2M14 12h2M8 16h2',
    history: 'M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 7v5l3 2',
    progress: 'M4 19h16M5 15l4-4 3 3 6-7M14 7h4v4',
    check: 'M5 12.5 10 17l9-10',
    chevronLeft: 'M15 5l-7 7 7 7',
    chevronRight: 'M9 5l7 7-7 7',
    chevronDown: 'M5 9l7 7 7-7',
    chevronUp: 'M5 15l7-7 7 7',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    close: 'M6 6l12 12M18 6 6 18',
    settings:
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-1.7-1L15 3.6h-4l-.4 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.5 7.5 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5Z',
    edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
    trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
    share: 'M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
    play: 'M8 5v14l11-7L8 5Z',
  };

  function icon(name, size = 24, opts = {}) {
    const label = opts.label ? ` role="img" aria-label="${esc(opts.label)}"` : ' aria-hidden="true"';
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${opts.stroke || 1.8}" stroke-linecap="round" stroke-linejoin="round"${label}><path d="${PATHS[name]}"/></svg>`;
  }

  /** attrs — строка вида 'data-action="x" disabled' */
  function button(text, { variant = 'primary', size = '', block = false, icon: ic = '', attrs = '' } = {}) {
    const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block'].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" ${attrs}>${ic ? icon(ic, size === 'lg' ? 22 : 20) : ''}${text}</button>`;
  }

  function iconButton(name, label, attrs = '') {
    return `<button type="button" class="icon-btn" aria-label="${esc(label)}" title="${esc(label)}" ${attrs}>${icon(name)}</button>`;
  }

  function screenHeader({ title, eyebrow = '', leading = '', action = '' }) {
    return `<header class="screen-header">
      ${leading ? `<div class="leading">${leading}</div>` : ''}
      <div class="titles">
        ${eyebrow ? `<p class="eyebrow-line">${eyebrow}</p>` : ''}
        <h1>${title}</h1>
      </div>
      ${action ? `<div class="action">${action}</div>` : ''}
    </header>`;
  }

  function progressBar(value, label) {
    const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
    return `<div class="progress" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div style="width:${pct}%"></div></div>`;
  }

  // ── Иллюстрации упражнений ──
  // Спокойные геометрические знаки мышечных групп вместо фотографий.
  const GLYPHS = {
    chest: '<path d="M160 52c-26-18-70-16-86 8-12 18-6 46 22 54 26 7 52-4 64-22"/><path d="M160 52c26-18 70-16 86 8 12 18 6 46-22 54-26 7-52-4-64-22"/>',
    back: '<path d="M100 40h120l-30 110h-60Z"/><path d="M160 40v110"/>',
    shoulders: '<path d="M86 128a40 40 0 0 1 80 0"/><path d="M154 128a40 40 0 0 1 80 0"/>',
    legs: '<rect x="118" y="30" width="34" height="124" rx="17"/><rect x="168" y="30" width="34" height="124" rx="17"/>',
    hamstrings:
      '<rect x="118" y="30" width="34" height="124" rx="17"/><rect x="168" y="30" width="34" height="124" rx="17"/><path d="M118 70l34 40M168 70l34 40"/>',
    glutes: '<circle cx="134" cy="92" r="36"/><circle cx="186" cy="92" r="36"/>',
    calves: '<path d="M128 34c-14 40-14 70 0 116h18c6-46 6-76 0-116Z"/><path d="M174 34c-6 40-6 70 0 116h18c14-46 14-76 0-116Z"/>',
    arms: '<path d="M96 140V92a24 24 0 0 1 24-24h52"/><path d="M172 68a26 26 0 1 1 0 52h-40"/>',
    core:
      '<rect x="126" y="34" width="30" height="34" rx="10"/><rect x="164" y="34" width="30" height="34" rx="10"/><rect x="126" y="76" width="30" height="34" rx="10"/><rect x="164" y="76" width="30" height="34" rx="10"/><rect x="126" y="118" width="30" height="34" rx="10"/><rect x="164" y="118" width="30" height="34" rx="10"/>',
  };

  let glyphSeq = 0;
  function glyph(key) {
    const id = `grid${++glyphSeq}`;
    return `<svg class="glyph" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><path class="grid" d="M16 0H0v16"/></pattern></defs>
      <rect width="320" height="180" fill="url(#${id})"/>
      <g class="shape">${GLYPHS[key] || GLYPHS.core}</g></svg>`;
  }

  /** Пользовательские фото (kind: custom) подгружаются после рендера — см. hydrateImages в app.js. */
  function exerciseImage(image, { compact = false, extra = '' } = {}) {
    const cls = compact ? 'ex-image compact' : 'ex-image';
    if (image && image.kind === 'custom') {
      return `<div class="${cls}" data-image-asset="${esc(image.assetId)}">${glyph('core')}${extra}</div>`;
    }
    return `<div class="${cls}">${glyph(image && image.key)}${extra}</div>`;
  }

  function stepper({ label, value, min, max, action, attrs = '', format = String }) {
    return `<div class="stepper" role="group" aria-label="${esc(label)}">
      <span class="l">${esc(label)}</span>
      <div class="ctl">
        <button type="button" data-action="${action}" data-delta="-1" ${attrs} aria-label="${esc(label)}: уменьшить" ${value <= min ? 'disabled' : ''}>${icon('minus', 20)}</button>
        <output aria-live="polite">${esc(format(value))}</output>
        <button type="button" data-action="${action}" data-delta="1" ${attrs} aria-label="${esc(label)}: увеличить" ${value >= max ? 'disabled' : ''}>${icon('plus', 20)}</button>
      </div>
    </div>`;
  }

  // ── Нижний лист ──
  let closeCurrentSheet = null;

  /**
   * openSheet({ title, description, body, actions: { name: fn } })
   * Кнопки внутри body вызывают actions по атрибуту data-sheet-action.
   */
  function openSheet({ title, description = '', body = '', actions = {} }) {
    if (closeCurrentSheet) closeCurrentSheet();
    const host = document.getElementById('sheet-root');
    const prevFocus = document.activeElement;
    host.innerHTML = `<div class="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
        <div class="grabber" aria-hidden="true"></div>
        <h2 id="sheet-title">${esc(title)}</h2>
        ${description ? `<p class="desc">${esc(description)}</p>` : ''}
        <div class="body">${body}</div>
      </div></div>`;
    const backdrop = host.firstElementChild;
    const panel = backdrop.firstElementChild;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const close = () => {
      host.innerHTML = '';
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      closeCurrentSheet = null;
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
    const onKey = (e) => e.key === 'Escape' && close();

    backdrop.addEventListener('click', async (e) => {
      if (e.target === backdrop) return close();
      const el = e.target.closest('[data-sheet-action]');
      if (!el) return;
      const name = el.dataset.sheetAction;
      if (name === 'close') return close();
      const fn = actions[name];
      if (fn) await fn(el, close, panel);
    });
    backdrop.addEventListener('submit', (e) => {
      e.preventDefault();
      const fn = actions.submit;
      if (fn) fn(e.target, close, panel);
    });
    document.addEventListener('keydown', onKey);
    panel.focus();
    closeCurrentSheet = close;
    return close;
  }

  function closeSheet() {
    if (closeCurrentSheet) closeCurrentSheet();
  }

  let toastTimer = null;
  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  }

  // ── Форма выбора даты старта ──
  function startCycleForm(today, submitLabel = 'Начать цикл') {
    const todayIso = GN.toISODate(today);
    const monday = today.getDay() === 1 ? today : GN.nextMonday(today);
    const options = [...new Set([todayIso, GN.toISODate(GN.addDays(today, 1)), GN.toISODate(monday)])].sort();
    const selected = GN.toISODate(monday);
    return `<form class="start-form" data-form="start-cycle">
      <div class="chips" role="group" aria-label="Быстрый выбор даты">
        ${options
          .map(
            (d) =>
              `<button type="button" class="chip" data-chip-date="${d}" aria-pressed="${d === selected}">${d === todayIso ? 'Сегодня' : esc(GN.formatWeekdayDate(d))}</button>`,
          )
          .join('')}
      </div>
      <label class="field-label">Дата начала
        <input class="date-input" type="date" name="startDate" value="${selected}" required>
      </label>
      <p class="muted small">День старта — тренировка A, дальше по расписанию: через день B, ещё через день C.</p>
      <button type="submit" class="btn btn-primary btn-lg btn-block">${esc(submitLabel)}</button>
    </form>`;
  }

  /** Подключить поведение формы старта (чипы ↔ поле даты) внутри root. */
  function bindStartCycleForm(root, onSubmit) {
    root.querySelectorAll('form[data-form="start-cycle"]').forEach((form) => {
      const input = form.elements.startDate;
      const sync = () => form.querySelectorAll('[data-chip-date]').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.chipDate === input.value)));
      form.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-chip-date]');
        if (!chip) return;
        input.value = chip.dataset.chipDate;
        sync();
      });
      input.addEventListener('change', sync);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!input.value) return;
        const btn = form.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
          await onSubmit(input.value);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  GN.ui = {
    esc, icon, button, iconButton, screenHeader, progressBar, glyph, exerciseImage, stepper,
    openSheet, closeSheet, toast, startCycleForm, bindStartCycleForm,
  };
})((globalThis.GN = globalThis.GN || {}));
