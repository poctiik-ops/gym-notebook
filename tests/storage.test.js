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
      expect(started.exercises).toHaveLength(8);
      expect((await services.getInProgress()).id).toBe(started.id);

      // вторая тренировка не создаётся, пока идёт первая
      expect((await services.startWorkout('B')).id).toBe(started.id);

      expect(started.exercises[0].sets.map((x) => !!x.warmup)).toEqual([true, true, false, false, false]);

      // разминка: короткий отдых 60 с
      const warm = await services.mutate(started.id, (s, now) => GN.completeSet(s, 0, 0, { weight: 10, value: 12 }, now));
      expect(warm.restTimer.endsAt).toBe(current.getTime() + 60000);

      await services.mutate(started.id, (s, now) => GN.updateSetDraft(s, 0, 2, { weight: 47.5 }, now));
      advance(30);
      const after = await services.mutate(started.id, (s, now) => GN.completeSet(s, 0, 2, { weight: 47.5, value: 8 }, now));
      expect(after.restTimer.endsAt).toBe(current.getTime() + 180000);

      // «перезапуск приложения»: всё читается из базы, включая таймер
      const reloaded = await repos.sessions.get(started.id);
      expect(reloaded.restTimer.endsAt).toBe(after.restTimer.endsAt);
      expect(reloaded.exercises[0].sets[2]).toMatchObject({ weight: 47.5, value: 8 });

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
      await services.mutate(s.id, (x, now) => GN.completeSet(x, 0, 2, { weight: 45, value: 8 }, now));
      await services.mutate(s.id, (x, now) => GN.finishSession(x, now));

      const tplA = await services.getTemplate('A');
      await services.saveTemplates([GN.updateItem(tplA, tplA.items[0].id, { sets: 5, repMin: 3, repMax: 5 })]);
      expect((await services.getTemplate('A')).items[0].sets).toBe(5);

      const stored = await repos.sessions.get(s.id);
      expect(stored.exercises[0].snapshot).toMatchObject({ sets: 3, repMin: 6, repMax: 8 });
      expect(stored.exercises[0].sets).toHaveLength(5); // 2 разминочных + 3 рабочих
    });

    it('неправильный шаблон не сохраняется', async () => {
      const tplA = await services.getTemplate('A');
      await expect(services.saveTemplates([GN.updateItem(tplA, tplA.items[0].id, { repMin: 12, repMax: 6 })])).toReject(GN.ValidationError);
      expect((await services.getTemplate('A')).items[0].repMin).toBe(6);
    });

    it('«Прошлый раз» через базу; прерванная тренировка не в истории', async () => {
      const a = await services.startWorkout('A');
      await services.mutate(a.id, (x, now) => GN.completeSet(x, 0, 0, { weight: 20, value: 12 }, now)); // разминка
      await services.mutate(a.id, (x, now) => GN.completeSet(x, 0, 2, { weight: 45, value: 8 }, now));
      await services.mutate(a.id, (x, now) => GN.completeSet(x, 0, 3, { weight: 45, value: 7 }, now));
      await services.mutate(a.id, (x, now) => GN.finishSession(x, now));

      advance(86400 * 2);
      const la = await services.startWorkout('LB'); // Light Б начинается с той же одноручной тяги, что и А
      const prev = await services.getPreviousPerformance(la.exercises[0].exerciseId, la.templateId, la.id);
      expect(prev).toMatchObject({ sessionId: a.id, sameTemplate: false });
      expect(prev.sets.map((x) => x.value)).toEqual([8, 7]);
      expect(prev.warmups.map((x) => x.weight)).toEqual([20]);
      // прошлый раз для разминки и для рабочих подходов сопоставляется отдельно
      expect(GN.previousSetAt(prev, 0, true)).toMatchObject({ weight: 20, value: 12 });
      expect(GN.previousSetAt(prev, 0)).toMatchObject({ weight: 45, value: 8 });

      await services.mutate(la.id, (x, now) => GN.abandonSession(x, now));
      expect(await services.listCompleted()).toHaveLength(1);
    });

    it('программа А–Е: по 8 упражнений, разминка в первых четырёх', async () => {
      const templates = (await services.listTemplates()).filter((t) => !t.code.startsWith('O'));
      const ex = await services.exerciseMap();
      expect(templates.map((t) => t.name)).toEqual([
        'Тренировка А', 'Тренировка Б', 'Тренировка В', 'Тренировка Г', 'Тренировка Д', 'Тренировка Е', 'Light А', 'Light Б',
      ]);
      const a = templates[0];
      expect(templates.every((t) => t.items.length === 8)).toBeTrue();
      expect(a.items.map((i) => i.warmupSets)).toEqual([2, 2, 2, 2, 0, 0, 0, 0]);
      expect(ex.get(a.items[7].exerciseId).name).toBe('Пресс');
      expect(ex.get(a.items[0].exerciseId).name).toBe('Одноручная верхняя тяга в блоке сидя');
      expect(ex.get(a.items[0].exerciseId).perSide).toBe('arm');
      expect(a.items[2]).toMatchObject({ restSeconds: 180, restMinSeconds: 120 });
      // разгрузочная неделя: 4×15, без разминки
      const light = templates.filter((t) => t.code === 'LA' || t.code === 'LB');
      expect(light.every((t) => t.items.every((i) => i.sets === 4 && i.repMin === 15 && i.repMax === 15 && i.warmupSets === 0))).toBeTrue();
      // у каждого упражнения есть схема мышц
      expect([...ex.values()].every((e) => e.image.kind === 'muscles' && e.image.primary.length > 0)).toBeTrue();
    });

    it('обновление со старой программы: шаблоны заменяются, история остаётся', async () => {
      // имитируем установленную версию 1 со старым упражнением и записанной тренировкой
      const ts = current.toISOString();
      const old = { id: 'ex-bench-press', name: 'Жим штанги лёжа', muscleGroup: 'Грудь', instruction: '', defaultRestSeconds: 120, resultType: 'reps', image: null, createdAt: ts, updatedAt: ts, deletedAt: null };
      const oldTpl = { id: 'tpl-A', code: 'A', name: 'Тренировка A', items: [{ id: 'x1', exerciseId: 'ex-bench-press', sets: 3, repMin: 6, repMax: 8, restSeconds: 120 }], createdAt: ts, updatedAt: ts, deletedAt: null };
      await repos.writeBatch([
        { store: 'exercises', value: old },
        { store: 'templates', value: oldTpl },
        { store: 'meta', value: { key: 'seedVersion', value: 1 } },
      ]);
      const s = await services.startWorkout('A');
      await services.mutate(s.id, (x, now) => GN.completeSet(x, 0, 0, { weight: 45, value: 8 }, now));
      await services.mutate(s.id, (x, now) => GN.finishSession(x, now));

      expect(await services.ensureSeeded()).toBeTrue();
      expect((await services.getTemplate('A')).items[0].exerciseId).toBe('ex-one-arm-lat-pulldown');
      expect((await services.listExercises()).some((e) => e.id === 'ex-bench-press')).toBe(false);
      expect((await repos.sessions.get(s.id)).exercises[0].snapshot.name).toBe('Жим штанги лёжа');
    });

    it('тренировка Г: на 2-м выполнении вместо Reverse Pec Deck — махи лёжа', async () => {
      await services.startCycle('2026-10-12');
      const names = async () => {
        const s = await services.startWorkout('D');
        const name = s.exercises[3].snapshot.name;
        await services.mutate(s.id, (x, now) => GN.finishSession(x, now));
        return name;
      };
      expect(await names()).toBe('Reverse Pec Deck');
      expect(await names()).toBe('Махи гантелями лёжа грудью на наклонной скамье');
      expect(await names()).toBe('Reverse Pec Deck');
    });

    it('текущий цикл с 28 сентября сменяется новым 2 ноября', async () => {
      const at = (y, m, d) => {
        current = new Date(y, m - 1, d, 10, 0);
      };
      at(2026, 10, 12);
      let { cycle, scheme, upcoming } = await services.getActiveCycleWithScheme();
      expect(cycle.startDate).toBe('2026-09-28');
      expect(upcoming.startDate).toBe('2026-11-02');
      expect(GN.getTodayPlan(cycle, scheme, current).planned.templateCode).toBe('O1'); // Д1 (второй круг — Д15)
      at(2026, 10, 23);
      expect(GN.getTodayPlan(cycle, scheme, current).planned.templateCode).toBe('O6'); // Д26 = Д12
      at(2026, 10, 27);
      expect(GN.getTodayPlan(cycle, scheme, current).planned.templateCode).toBe('OLA');
      at(2026, 10, 29);
      expect(GN.getTodayPlan(cycle, scheme, current).planned.templateCode).toBe('OLB');
      expect(GN.getCycleEndDate(cycle.startDate, scheme)).toBe('2026-11-01');

      at(2026, 11, 2);
      ({ cycle, scheme, upcoming } = await services.getActiveCycleWithScheme());
      expect(cycle.startDate).toBe('2026-11-02');
      expect(upcoming).toBeNull();
      expect(GN.getTodayPlan(cycle, scheme, current).planned.templateCode).toBe('A');

      // тренировка старого цикла: 7 упражнений, разминка у упражнений с 3 рабочими подходами
      at(2026, 10, 12);
      const s = await services.startWorkout('O1');
      expect(s.cycleId).toBe('cycle-2026-09-28');
      expect(s.cycleWeek).toBe(3);
      expect(s.exercises.map((e) => e.snapshot.warmupSets)).toEqual([2, 2, 0, 2, 0, 0, 0]);
      expect(s.exercises[0].snapshot.name).toBe('Тяга верхнего блока параллельным хватом');
    });

    it('запись прошедшей тренировки задним числом', async () => {
      // сегодня 12 октября; сначала записали сегодняшнюю Д1, потом вспомнили про 28 сентября
      const today = await services.startWorkout('O1');
      await services.mutate(today.id, (x, now) => GN.completeSet(x, 0, 2, { weight: 50, value: 8 }, now));
      await services.mutate(today.id, (x, now) => GN.finishSession(x, now));
      advance(600);
      const past = await services.startWorkout('O1', '2026-09-28');
      expect(past).toMatchObject({ plannedDate: '2026-09-28', cycleWeek: 1, cycleId: 'cycle-2026-09-28' });
      // для прошлой тренировки «Прошлый раз» не берёт более позднюю
      expect(await services.getPreviousPerformance(past.exercises[0].exerciseId, past.templateId, past.id, past.plannedDate)).toBeNull();
      await services.mutate(past.id, (x, now) => GN.completeSet(x, 0, 2, { weight: 45, value: 8 }, now));
      await services.mutate(past.id, (x, now) => GN.finishSession(x, now));
      // история — по дате тренировки: 12 октября выше 28 сентября
      expect((await services.listCompleted()).map((x) => x.plannedDate)).toEqual(['2026-10-12', '2026-09-28']);
      const next = await services.getPreviousPerformance(past.exercises[0].exerciseId, past.templateId, null, '2026-10-14');
      expect(next.plannedDate).toBe('2026-10-12');
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
