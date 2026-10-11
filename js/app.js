/*
 * Точка входа: открывает базу, заполняет программу, запускает роутер и service worker.
 * Маршруты в hash (#/program) — работают и на любом статическом хостинге, и при открытии файла с диска.
 */
(function (GN) {
  'use strict';

  const ROUTES = [
    { re: /^\/$/, screen: 'today', tab: '/' },
    { re: /^\/program$/, screen: 'program', tab: '/program' },
    { re: /^\/program\/edit$/, screen: 'programEdit', tab: '/program' },
    { re: /^\/program\/([A-Z]{1,2})$/, screen: 'template', tab: '/program', keys: ['code'] },
    { re: /^\/workout\/([^/]+)$/, screen: 'workout', tab: '/', keys: ['id'] },
    { re: /^\/history$/, screen: 'history', tab: '/history' },
    { re: /^\/progress$/, screen: 'progress', tab: '/progress' },
    { re: /^\/settings$/, screen: 'settings', tab: '/program' },
  ];

  function parseRoute() {
    const path = decodeURIComponent((location.hash || '#/').slice(1)) || '/';
    for (const r of ROUTES) {
      const m = path.match(r.re);
      if (m) {
        const params = {};
        (r.keys || []).forEach((k, i) => (params[k] = m[i + 1]));
        return { ...r, params, path };
      }
    }
    return null;
  }

  function startApp(services) {
    const root = document.getElementById('app');
    let current = null; // экземпляр текущего экрана
    let renderToken = 0;

    const go = (path) => {
      if (location.hash === `#${path}`) refresh();
      else location.hash = path;
    };

    async function refresh() {
      if (!current) return;
      const token = ++renderToken;
      const instance = current;
      try {
        const html = await instance.render();
        if (token !== renderToken || instance !== current) return; // пришёл более новый рендер
        const y = window.scrollY;
        root.innerHTML = html;
        window.scrollTo(0, y);
        if (instance.mount) instance.mount(root);
      } catch (e) {
        console.error(e);
        root.innerHTML = `<div class="empty"><p>Что-то пошло не так.</p><p class="small">${GN.ui.esc(e.message || e)}</p></div>`;
      }
    }

    async function navigate() {
      const route = parseRoute();
      if (!route) return go('/');
      GN.ui.closeSheet();
      if (current && current.unmount) current.unmount();
      const ctx = { params: route.params, services, go, refresh: () => refresh() };
      current = GN.screens[route.screen](ctx);
      document.body.classList.toggle('full', !!current.full);
      document.querySelectorAll('.nav a').forEach((a) => {
        if (a.getAttribute('href') === `#${route.tab}`) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      window.scrollTo(0, 0);
      await refresh();
    }

    // Делегирование событий: экраны описывают actions по data-action
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !current || !current.actions || el.closest('#sheet-root')) return;
      const fn = current.actions[el.dataset.action];
      if (!fn || el.disabled) return;
      e.preventDefault();
      try {
        await fn(el, e);
      } catch (err) {
        console.error(err);
        GN.ui.toast(err.message || 'Ошибка');
      }
    });
    root.addEventListener('input', (e) => current && current.onInput && current.onInput(e));
    root.addEventListener('focusout', (e) => current && current.onFocusOut && current.onFocusOut(e));
    root.addEventListener('keydown', (e) => current && current.onKeyDown && current.onKeyDown(e));

    window.addEventListener('hashchange', navigate);
    // Вернулись в приложение (или наступила полночь) — обновить «Сегодня»
    let lastDay = GN.toISODate(new Date());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      const day = GN.toISODate(new Date());
      if (day !== lastDay) {
        lastDay = day;
        refresh();
      }
    });

    navigate();
  }

  // ── Service worker: офлайн. Новая версия применяется только по кнопке «Обновить». ──
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        const offer = (worker) => {
          const banner = document.getElementById('update-banner');
          banner.hidden = false;
          banner.querySelector('[data-update]').onclick = () => worker.postMessage('SKIP_WAITING');
          banner.querySelector('[data-later]').onclick = () => (banner.hidden = true);
        };
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
          });
        });
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloaded) return;
          reloaded = true;
          location.reload();
        });
      } catch (e) {
        console.warn('Service worker не зарегистрирован', e);
      }
    });
  }

  async function boot() {
    GN.installAudioUnlock();
    registerServiceWorker();
    try {
      const db = await GN.openDatabase();
      const services = GN.createServices(GN.createRepositories(db));
      await services.ensureSeeded();
      GN.services = services; // для отладки в консоли
      startApp(services);
    } catch (e) {
      console.error(e);
      document.getElementById('app').innerHTML = `<div class="empty">
        <h1 class="title" style="color:var(--text)">Хранилище недоступно</h1>
        <p style="margin-top:8px">Не удалось открыть локальную базу данных. Проверьте, что браузер не в режиме «Частный доступ», и откройте приложение снова.</p>
      </div>`;
    }
  }

  boot();
})((globalThis.GN = globalThis.GN || {}));
