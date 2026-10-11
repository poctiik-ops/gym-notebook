/*
 * Хранилище: IndexedDB без библиотек.
 *
 * Слои:
 *   openDatabase()        — схема и миграции;
 *   createRepositories()  — чтение/запись таблиц (единственное место, где есть IndexedDB);
 *   createServices()      — сценарии приложения (начать тренировку, отметить подход…).
 * Экраны вызывают только сервисы. Облачная синхронизация позже встанет между сервисами и репозиториями.
 */
(function (GN) {
  'use strict';

  const DB_NAME = 'gym-notebook';
  const DB_VERSION = 1;
  const STORES = ['exercises', 'images', 'templates', 'schemes', 'cycles', 'sessions', 'meta'];

  const req = (r) =>
    new Promise((resolve, reject) => {
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });

  const done = (tx) =>
    new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Транзакция прервана'));
    });

  function openDatabase(name = DB_NAME, factory = globalThis.indexedDB) {
    if (!factory) return Promise.reject(new Error('IndexedDB недоступна'));
    const open = factory.open(name, DB_VERSION);
    open.onupgradeneeded = (event) => {
      const db = open.result;
      // Миграции: новые версии добавляют блоки `if (event.oldVersion < N)`.
      if (event.oldVersion < 1) {
        db.createObjectStore('exercises', { keyPath: 'id' });
        db.createObjectStore('images', { keyPath: 'id' });
        db.createObjectStore('templates', { keyPath: 'id' }).createIndex('code', 'code', { unique: true });
        db.createObjectStore('schemes', { keyPath: 'id' });
        db.createObjectStore('cycles', { keyPath: 'id' }).createIndex('status', 'status');
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('status', 'status');
        sessions.createIndex('plannedDate', 'plannedDate');
        sessions.createIndex('cycleId', 'cycleId');
        sessions.createIndex('exerciseIds', 'exerciseIds', { multiEntry: true });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    return req(open);
  }

  const alive = (x) => x && !x.deletedAt;
  const byFinishedDesc = (a, b) => String(b.finishedAt || '').localeCompare(String(a.finishedAt || ''));

  function createRepositories(db) {
    const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);
    const get = (name, key) => req(store(name).get(key));
    const all = (name) => req(store(name).getAll());
    const byIndex = (name, index, value) => req(store(name).index(index).getAll(value));

    async function putMany(name, items) {
      const tx = db.transaction(name, 'readwrite');
      items.forEach((it) => tx.objectStore(name).put(it));
      await done(tx);
    }

    /** Несколько таблиц одной транзакцией — всё или ничего. */
    async function writeBatch(ops) {
      const names = [...new Set(ops.map((o) => o.store))];
      const tx = db.transaction(names, 'readwrite');
      ops.forEach((o) => (o.clear ? tx.objectStore(o.store).clear() : tx.objectStore(o.store).put(o.value)));
      await done(tx);
    }

    return {
      exercises: {
        list: async () => (await all('exercises')).filter(alive).sort((a, b) => a.name.localeCompare(b.name, 'ru')),
        get: (id) => get('exercises', id),
      },
      images: {
        get: (id) => get('images', id),
        put: (a) => putMany('images', [a]),
      },
      templates: {
        list: async () =>
          (await all('templates')).filter(alive).sort((a, b) => GN.TEMPLATE_CODES.indexOf(a.code) - GN.TEMPLATE_CODES.indexOf(b.code)),
        getByCode: async (code) => (await byIndex('templates', 'code', code))[0],
        putMany: (items) => putMany('templates', items),
      },
      schemes: {
        get: (id) => get('schemes', id),
      },
      cycles: {
        getActive: async () => (await byIndex('cycles', 'status', 'active')).filter(alive)[0],
        get: (id) => get('cycles', id),
        put: (c) => putMany('cycles', [c]),
      },
      sessions: {
        get: (id) => get('sessions', id),
        put: (s) => putMany('sessions', [s]),
        getInProgress: async () => (await byIndex('sessions', 'status', 'in_progress')).filter(alive)[0],
        listCompleted: async () => (await byIndex('sessions', 'status', 'completed')).filter(alive).sort(byFinishedDesc),
        listCompletedWithExercise: async (exerciseId) =>
          (await byIndex('sessions', 'exerciseIds', exerciseId)).filter((s) => alive(s) && s.status === 'completed').sort(byFinishedDesc),
        listByPlannedDate: async (date) => (await byIndex('sessions', 'plannedDate', date)).filter(alive),
        listByCycle: async (cycleId) => (await byIndex('sessions', 'cycleId', cycleId)).filter(alive),
      },
      meta: {
        get: async (key) => {
          const r = await get('meta', key);
          return r ? r.value : undefined;
        },
        set: (key, value) => putMany('meta', [{ key, value }]),
      },
      writeBatch,
      clearAll: () => writeBatch(STORES.map((s) => ({ store: s, clear: true }))),
    };
  }

  const systemClock = {
    now: () => new Date(),
    uuid: () =>
      globalThis.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
  };

  class ValidationError extends Error {
    constructor(errors) {
      super(errors.join('\n'));
      this.errors = errors;
    }
  }

  function createServices(repos, clock = systemClock) {
    // Записи тренировки идут строго по очереди: быстрый ввод не перезапишет более новое состояние старым.
    let queue = Promise.resolve();
    const enqueue = (fn) => {
      const run = queue.then(fn, fn);
      queue = run.catch(() => undefined);
      return run;
    };

    async function ensureSeeded() {
      const version = await repos.meta.get('seedVersion');
      if (version && version >= GN.SEED_VERSION) return false;
      const seed = GN.buildSeed(clock.now());
      await repos.writeBatch([
        ...seed.exercises.map((value) => ({ store: 'exercises', value })),
        ...seed.templates.map((value) => ({ store: 'templates', value })),
        { store: 'schemes', value: seed.scheme },
        { store: 'meta', value: { key: 'seedVersion', value: GN.SEED_VERSION } },
      ]);
      return true;
    }

    async function exerciseMap() {
      return new Map((await repos.exercises.list()).map((e) => [e.id, e]));
    }

    return {
      ensureSeeded,
      exerciseMap,

      // ── Цикл ──
      async getActiveCycleWithScheme() {
        const cycle = (await repos.cycles.getActive()) || null;
        const scheme = cycle ? (await repos.schemes.get(cycle.schemeId)) || null : null;
        return { cycle, scheme };
      },

      async startCycle(startDate) {
        const ts = clock.now().toISOString();
        const active = await repos.cycles.getActive();
        const cycle = {
          id: clock.uuid(),
          startDate,
          schemeId: active ? active.schemeId : GN.DEFAULT_SCHEME_ID,
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
        };
        const ops = [{ store: 'cycles', value: cycle }];
        if (active) ops.push({ store: 'cycles', value: { ...active, status: 'finished', updatedAt: ts } });
        await repos.writeBatch(ops);
        return cycle;
      },

      async changeStartDate(cycleId, startDate) {
        const cycle = await repos.cycles.get(cycleId);
        if (!cycle) throw new Error('Цикл не найден');
        await repos.cycles.put({ ...cycle, startDate, updatedAt: clock.now().toISOString() });
      },

      // ── Программа ──
      listTemplates: () => repos.templates.list(),
      getTemplate: (code) => repos.templates.getByCode(code),
      listExercises: () => repos.exercises.list(),

      /** Явное сохранение Edit Mode. Тренировки не затрагиваются — у каждой свой snapshot. */
      async saveTemplates(drafts) {
        const errors = drafts.flatMap(GN.validateTemplate);
        if (errors.length) throw new ValidationError(errors);
        const ts = clock.now().toISOString();
        await repos.templates.putMany(drafts.map((t) => ({ ...t, updatedAt: ts })));
      },

      // ── Тренировки ──
      getSession: (id) => repos.sessions.get(id),
      getInProgress: async () => (await repos.sessions.getInProgress()) || null,
      listCompleted: () => repos.sessions.listCompleted(),
      listByDate: (date) => repos.sessions.listByPlannedDate(date),
      listByCycle: (cycleId) => repos.sessions.listByCycle(cycleId),

      /** Начать тренировку. Если уже идёт другая — возвращает её (одновременно — не больше одной). */
      async startWorkout(code, plannedDate) {
        const existing = await repos.sessions.getInProgress();
        if (existing) return existing;
        const template = await repos.templates.getByCode(code);
        if (!template) throw new GN.SessionError(`Тренировка ${code} не найдена`);
        const now = clock.now();
        const cycle = (await repos.cycles.getActive()) || null;
        const scheme = cycle ? await repos.schemes.get(cycle.schemeId) : null;
        let cycleWeek = null;
        if (cycle && scheme) {
          const i = GN.getDayIndex(cycle.startDate, now);
          if (i >= 0 && i < scheme.lengthDays) cycleWeek = GN.weekForDayIndex(i, scheme);
        }
        const session = GN.createSessionFromTemplate({
          id: clock.uuid(),
          template,
          exercises: await exerciseMap(),
          cycle,
          plannedDate: plannedDate || GN.toISODate(now),
          cycleWeek,
          now,
        });
        await repos.sessions.put(session);
        return session;
      },

      /**
       * Применить чистую функцию к тренировке и сохранить.
       * Пример: services.mutate(id, (s, now) => GN.completeSet(s, 0, 1, {...}, now))
       */
      mutate(id, fn) {
        return enqueue(async () => {
          const session = await repos.sessions.get(id);
          if (!session) throw new GN.SessionError('Тренировка не найдена');
          const next = fn(session, clock.now());
          if (next !== session) await repos.sessions.put(next);
          return next;
        });
      },

      async getPreviousPerformance(exerciseId, templateId, excludeSessionId) {
        const sessions = await repos.sessions.listCompletedWithExercise(exerciseId);
        return GN.findPreviousPerformance(sessions, exerciseId, templateId, excludeSessionId);
      },

      // ── Данные ──
      async loadDemo() {
        await repos.clearAll();
        await ensureSeeded();
        const seed = {
          exercises: await repos.exercises.list(),
          templates: await repos.templates.list(),
          scheme: await repos.schemes.get(GN.DEFAULT_SCHEME_ID),
        };
        const demo = GN.buildDemo(seed, clock.now(), clock.uuid);
        await repos.writeBatch([
          { store: 'cycles', value: demo.cycle },
          ...demo.sessions.map((value) => ({ store: 'sessions', value })),
        ]);
      },

      async resetAll() {
        await repos.clearAll();
        await ensureSeeded();
      },
    };
  }

  Object.assign(GN, { openDatabase, createRepositories, createServices, systemClock, ValidationError });
})((globalThis.GN = globalThis.GN || {}));
