/* Тесты хранилища на настоящем IndexedDB браузера (отдельная тестовая база, удаляется после каждого теста). */
(function () {
  'use strict';

  let db;
  let repos;
  let services;
  let current;
  let seq;
  let dbName;
  const clock = { now: () => current, uuid: () => `id-${++seq}` };
  const advance = (sec) => (current = new Date(current.getTime() + sec * 1000));

  async function setup() {
    seq = 0;
    current = new Date(2026, 9, 12, 18, 0); // пн 12 октября
    dbName = `gym-notebook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    db = await GN.openDatabase(dbName);
    repos = GN.createRepositories(db);
    services = GN.createServices(repos, clock);
    await services.ensureSeeded();
  }

  async function teardown() {
    db.close();
    await new Promise((resolve) => {
      const r = indexedDB.deleteDatabase(dbName);
      r.onsuccess = r.onerror = r.onblocked = () => resolve();
    });
  }

  describe('Сохранение WorkoutSession (IndexedDB)', () => {
    beforeEach(setup);
    afterEach(teardown);

    it('полный путь: старт → подходы → завершение → история', async () => {
      await services.startCycle('2026-10-12');
      const started = await services.startWorkout('A');
      expect(started.cycleWeek).toBe(1);
      expect(started.exercises).toHaveLength(7);
      expect((await services.getInProgress()).id).toBe(started.id);

      // вторая тренировка не создаётся, пока идёт первая
      expect((await services.startWorkout('B')).id).toBe(started.id);

      await services.mutate(started.id, (s, now) => GN.updateSetDraft(s, 0, 0, { weight: 47.5 }, now));
      advance(30);
      const after = await services.mutate(started.id, (s, now) => GN.completeSet(s, 0, 0, { weight: 47.5, value: 8 }, now));
      expect(after.restTimer.endsAt).toBe(current.getTime() + 120000);

      // «перезапуск приложения»: всё читается из базы, включая таймер
      const reloaded = await repos.sessions.get(started.id);
      expect(reloaded.restTimer.endsAt).toBe(after.restTimer.endsAt);
      expect(reloaded.exercises[0].sets[0]).toMatchObject({ weight: 47.5, value: 8 });

      advance(3600);
      const finished = await services.mutate(started.id, (s, now) => GN.finishSession(s, now));
      expect(finished.status).toBe('completed');
      expect(await services.getInProgress()).toBeNull();
      expect((await services.listCompleted()).map((s) => s.id)).toEqual([started.id]);
    });

    it('быстрый ввод сохраняется по порядку', async () => {
      const s = await services.startWorkout('A');
      const writes = [];
      for (let i = 1; i <= 10; i++) writes.push(services.mutate(s.id, (x, now) => GN.updateSetDraft(x, 0, 0, { weight: i }, now)));
      await Promise.all(writes);
      expect((await repos.sessions.get(s.id)).exercises[0].sets[0].weight).toBe(10);
    });

    it('изменение программы не меняет записанную тренировку', async () => {
      const s = await services.startWorkout('A');
      await services.mutate(s.id, (x, now) => GN.completeSet(x, 0, 0, { weight: 45, value: 8 }, now));
      await services.mutate(s.id, (x, now) => GN.finishSession(x, now));

      const tplA = await services.getTemplate('A');
      await services.saveTemplates([GN.updateItem(tplA, tplA.items[0].id, { sets: 5, repMin: 3, repMax: 5 })]);
      expect((await services.getTemplate('A')).items[0].sets).toBe(5);

      const stored = await repos.sessions.get(s.id);
      expect(stored.exercises[0].snapshot).toMatchObject({ sets: 3, repMin: 6, repMax: 8 });
      expect(stored.exercises[0].sets).toHaveLength(3);
    });

    it('неправильный шаблон не сохраняется', async () => {
      const tplA = await services.getTemplate('A');
      await expect(services.saveTemplates([GN.updateItem(tplA, tplA.items[0].id, { repMin: 12, repMax: 6 })])).toReject(GN.ValidationError);
      expect((await services.getTemplate('A')).items[0].repMin).toBe(6);
    });

    it('«Прошлый раз» через базу; прерванная тренировка не в истории', async () => {
      const a = await services.startWorkout('A');
      await services.mutate(a.id, (x, now) => GN.completeSet(x, 0, 0, { weight: 45, value: 8 }, now));
      await services.mutate(a.id, (x, now) => GN.completeSet(x, 0, 1, { weight: 45, value: 7 }, now));
      await services.mutate(a.id, (x, now) => GN.finishSession(x, now));

      advance(86400 * 2);
      const la = await services.startWorkout('LA'); // Light A начинается с того же жима
      const prev = await services.getPreviousPerformance(la.exercises[0].exerciseId, la.templateId, la.id);
      expect(prev).toMatchObject({ sessionId: a.id, sameTemplate: false });
      expect(prev.sets.map((x) => x.value)).toEqual([8, 7]);

      await services.mutate(la.id, (x, now) => GN.abandonSession(x, now));
      expect(await services.listCompleted()).toHaveLength(1);
    });

    it('новый цикл завершает предыдущий', async () => {
      const c1 = await services.startCycle('2026-10-12');
      const c2 = await services.startCycle('2026-12-07');
      expect((await services.getActiveCycleWithScheme()).cycle.id).toBe(c2.id);
      expect((await repos.cycles.get(c1.id)).status).toBe('finished');
    });

    it('демо-данные: цикл и тренировки только в прошлом', async () => {
      await services.loadDemo();
      const { cycle } = await services.getActiveCycleWithScheme();
      expect(cycle).toBeDefined();
      const sessions = await services.listCompleted();
      expect(sessions.length).toBeGreaterThan(5);
      expect(sessions.every((s) => s.plannedDate < '2026-10-12')).toBeTrue();
    });
  });
})();
