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

  // ── Service worker: офлайн и автообновление ──
  // Новая версия скачивается в фоне и включается сама. Перезагрузка — сразу,
  // а если открыта тренировка — когда приложение свернут (ввод не прервётся).
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

    const onWorkout = () => /^#\/workout\//.test(location.hash);
    let pendingReload = false;
    const reloadNow = () => {
      try {
        sessionStorage.setItem('just-updated', '1');
      } catch (e) {
        /* не критично */
      }
      location.reload();
    };
    const reloadWhenSafe = () => {
      if (!onWorkout() || document.visibilityState === 'hidden') return reloadNow();
      pendingReload = true;
    };
    document.addEventListener('visibilitychange', () => {
      if (pendingReload && document.visibilityState === 'hidden') reloadNow();
    });
    window.addEventListener('hashchange', () => {
      if (pendingReload && !onWorkout()) reloadNow();
    });

    window.addEventListener('load', async () => {
      try {
        let hadController = !!navigator.serviceWorker.controller;
        const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Первое подключение после установки — страница уже свежая, перезагружать нечего
          if (!hadController) {
            hadController = true;
            return;
          }
          if (reloaded) return;
          reloaded = true;
          reloadWhenSafe();
        });
        // Совместимость с версией, которая ждала кнопку «Обновить»
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        // Проверяем обновления при каждом открытии приложения и раз в 30 минут
        const check = () => reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
        setInterval(check, 30 * 60 * 1000);
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
      // Просим систему не удалять данные приложения при нехватке места
      GN.requestPersistentStorage();
      startApp(services);
      try {
        if (sessionStorage.getItem('just-updated')) {
          sessionStorage.removeItem('just-updated');
          setTimeout(() => GN.ui.toast('Приложение обновлено'), 600);
        }
      } catch (e) {
        /* не критично */
      }
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
