/* Тесты логики: неделя цикла, сегодняшняя тренировка, тренировка и подходы, «прошлый раз», форматирование. */
(function () {
  'use strict';

  // ── Данные для тестов ──
  const T = '2026-01-01T00:00:00.000Z';
  const meta = { createdAt: T, updatedAt: T, deletedAt: null };
  const scheme = { id: 's', lengthDays: 56, weeks: 8, deloadWeek: 8, slots: GN.buildDefaultSlots() };

  const ex = (id, o = {}) => ({
    id, name: `Упражнение ${id}`, muscleGroup: 'Грудь', instruction: '', defaultRestSeconds: 90,
    resultType: 'reps', image: { kind: 'builtin', key: 'chest' }, ...meta, ...o,
  });
  const exercises = {
    bench: ex('bench', { name: 'Жим лёжа' }),
    row: ex('row', { name: 'Тяга' }),
    plank: ex('plank', { name: 'Планка', resultType: 'seconds' }),
  };
  const tpl = (id, code, items) => ({
    id, code, name: `Тренировка ${code}`, ...meta,
    items: items.map(([exerciseId, sets], i) => ({ id: `${id}-${i}`, exerciseId, sets, repMin: 8, repMax: 10, restSeconds: 90 })),
  });
  const templateA = tpl('tpl-A', 'A', [['bench', 3], ['row', 3], ['plank', 2]]);
  const templateD = tpl('tpl-D', 'D', [['row', 3], ['bench', 2]]);

  // 2026-10-12 — понедельник
  const START = '2026-10-12';
  const day = (offset) => new Date(2026, 9, 12 + offset, 10, 30);

  describe('Неделя и день цикла', () => {
    it('день старта — неделя 1, день 1', () => {
      expect(GN.getCyclePosition(START, scheme, day(0))).toMatchObject({ status: 'active', week: 1, day: 1, dayIndex: 0 });
    });
    it('следующий понедельник — неделя 2', () => {
      expect(GN.getCyclePosition(START, scheme, day(6)).week).toBe(1);
      expect(GN.getCyclePosition(START, scheme, day(7)).week).toBe(2);
    });
    it('последний день — неделя 8, разгрузка, прогресс 100%', () => {
      expect(GN.getCyclePosition(START, scheme, day(55))).toMatchObject({ status: 'active', week: 8, day: 56, isDeloadWeek: true, progress: 1 });
    });
    it('до старта и после окончания', () => {
      expect(GN.getCyclePosition(START, scheme, day(-1)).status).toBe('not_started');
      expect(GN.getCyclePosition(START, scheme, day(56)).status).toBe('finished');
    });
    it('время суток не влияет на номер дня', () => {
      expect(GN.getCyclePosition(START, scheme, new Date(2026, 9, 12, 23, 59)).dayIndex).toBe(0);
      expect(GN.getCyclePosition(START, scheme, new Date(2026, 9, 13, 0, 1)).dayIndex).toBe(1);
    });
    it('дата окончания — 56-й день', () => {
      expect(GN.getCycleEndDate(START, scheme)).toBe('2026-12-06');
    });
  });

  describe('Расписание', () => {
    it('23 тренировки: 7 недель × 3 + 2 лёгкие', () => {
      expect(GN.getPlannedWorkouts(START, scheme)).toHaveLength(23);
    });
    it('неделя 1 — A/B/C в пн/ср/пт', () => {
      expect(GN.getWorkoutForDate(START, scheme, day(0)).templateCode).toBe('A');
      expect(GN.getWorkoutForDate(START, scheme, day(2)).templateCode).toBe('B');
      expect(GN.getWorkoutForDate(START, scheme, day(4)).templateCode).toBe('C');
      expect(GN.getWorkoutForDate(START, scheme, day(1))).toBeNull();
    });
    it('неделя 2 — D/E/F, неделя 7 — снова A', () => {
      expect(GN.getWorkoutForDate(START, scheme, day(7)).templateCode).toBe('D');
      expect(GN.getWorkoutForDate(START, scheme, day(11)).templateCode).toBe('F');
      expect(GN.getWorkoutForDate(START, scheme, day(42)).templateCode).toBe('A');
    });
    it('неделя 8 — Light A во вторник, Light B в четверг', () => {
      expect(GN.getWorkoutForDate(START, scheme, day(49))).toBeNull();
      expect(GN.getWorkoutForDate(START, scheme, day(50))).toMatchObject({ templateCode: 'LA', week: 8 });
      expect(GN.getWorkoutForDate(START, scheme, day(52))).toMatchObject({ templateCode: 'LB', week: 8 });
    });
    it('следующая тренировка — строго после даты', () => {
      expect(GN.getNextWorkout(START, scheme, day(0))).toMatchObject({ templateCode: 'B', date: '2026-10-14' });
      expect(GN.getNextWorkout(START, scheme, day(5))).toMatchObject({ templateCode: 'D', date: '2026-10-19' });
      expect(GN.getNextWorkout(START, scheme, day(52))).toBeNull();
    });
    it('календарь — 8 недель по 7 дней', () => {
      const cal = GN.buildCycleCalendar(START, scheme);
      expect(cal).toHaveLength(8);
      expect(cal.every((w) => w.days.length === 7)).toBeTrue();
      expect(cal[7].isDeload).toBeTrue();
    });
  });

  describe('Сегодняшняя тренировка', () => {
    const cycle = { startDate: START };
    it('нет цикла', () => expect(GN.getTodayPlan(null, scheme, day(0)).kind).toBe('no_cycle'));
    it('день тренировки: неделя 3, тренировка B', () => {
      const plan = GN.getTodayPlan(cycle, scheme, day(16));
      expect(plan.kind).toBe('workout');
      expect(plan.planned.templateCode).toBe('B');
      expect(plan.position.week).toBe(3);
    });
    it('день отдыха — следующая тренировка с датой', () => {
      const plan = GN.getTodayPlan(cycle, scheme, day(5));
      expect(plan.kind).toBe('rest');
      expect(plan.next).toMatchObject({ templateCode: 'D', date: '2026-10-19' });
    });
    it('цикл ещё не начался — первая тренировка A', () => {
      const plan = GN.getTodayPlan(cycle, scheme, day(-3));
      expect(plan.kind).toBe('not_started');
      expect(plan.next).toMatchObject({ templateCode: 'A', date: START });
    });
    it('цикл завершён', () => expect(GN.getTodayPlan(cycle, scheme, day(60)).kind).toBe('finished'));
    it('старт не в понедельник — расписание считается от даты старта', () => {
      const plan = GN.getTodayPlan({ startDate: '2026-10-14' }, scheme, new Date(2026, 9, 14));
      expect(plan.planned.templateCode).toBe('A');
    });
  });

  // ── Тренировка ──
  const now = new Date('2026-10-12T15:00:00.000Z');
  const later = (sec) => new Date(now.getTime() + sec * 1000);
  const newSession = (template = templateA) =>
    GN.createSessionFromTemplate({ id: 's1', template, exercises, cycle: { id: 'c1' }, plannedDate: '2026-10-12', cycleWeek: 1, now });

  describe('Создание тренировки и snapshot', () => {
    it('упражнения и пустые подходы по шаблону', () => {
      const s = newSession();
      expect(s.status).toBe('in_progress');
      expect(s.exercises.map((e) => e.sets.length)).toEqual([3, 3, 2]);
      expect(s.exerciseIds).toEqual(['bench', 'row', 'plank']);
      expect(s.exercises[0].snapshot).toMatchObject({ name: 'Жим лёжа', repMin: 8, repMax: 10, restSeconds: 90 });
    });
    it('изменение шаблона не меняет сохранённую тренировку', () => {
      const template = JSON.parse(JSON.stringify(templateA));
      const s = newSession(template);
      template.items[0].sets = 5;
      template.items[0].repMax = 15;
      expect(s.exercises[0].snapshot.sets).toBe(3);
      expect(s.exercises[0].snapshot.repMax).toBe(10);
    });
    it('ошибка, если упражнения нет в каталоге', () => {
      expect(() =>
        GN.createSessionFromTemplate({ id: 'x', template: templateA, exercises: {}, cycle: null, plannedDate: '2026-10-12', cycleWeek: null, now }),
      ).toThrow(GN.SessionError);
    });
  });

  describe('Подходы и таймер отдыха', () => {
    it('галочка: подход выполнен, таймер хранит момент окончания', () => {
      const s = GN.completeSet(newSession(), 0, 0, { weight: 47.5, value: 8 }, now);
      expect(s.exercises[0].sets[0]).toMatchObject({ weight: 47.5, value: 8, completedAt: now.toISOString() });
      expect(s.restTimer).toEqual({ endsAt: now.getTime() + 90000, durationSeconds: 90, exerciseIndex: 0, setIndex: 0 });
    });
    it('без повторов подход не засчитывается', () => {
      expect(() => GN.completeSet(newSession(), 0, 0, { weight: 40, value: null }, now)).toThrow(GN.SessionError);
    });
    it('снятие галочки убирает таймер этого подхода', () => {
      let s = GN.completeSet(newSession(), 0, 0, { weight: 40, value: 8 }, now);
      s = GN.uncompleteSet(s, 0, 0, later(5));
      expect(s.exercises[0].sets[0].completedAt).toBeNull();
      expect(s.restTimer).toBeNull();
    });
    it('+15 с к уже истёкшему отдыху — от текущего момента', () => {
      let s = GN.completeSet(newSession(), 0, 0, { weight: 40, value: 8 }, now);
      s = GN.extendRestTimer(s, 15, later(200));
      expect(s.restTimer.endsAt).toBe(later(215).getTime());
    });
    it('после последнего подхода таймер не запускается', () => {
      let s = newSession();
      s.exercises.forEach((e, ei) => e.sets.forEach((_, si) => (s = GN.completeSet(s, ei, si, { weight: ei === 2 ? null : 50, value: 8 }, now))));
      expect(GN.isSessionFullyDone(s)).toBeTrue();
      expect(s.restTimer).toBeNull();
    });
    it('объём и счётчики (планка в объём не входит)', () => {
      let s = newSession();
      s = GN.completeSet(s, 0, 0, { weight: 50, value: 10 }, now);
      s = GN.completeSet(s, 0, 1, { weight: 50, value: 8 }, now);
      s = GN.completeSet(s, 2, 0, { weight: null, value: 60 }, now);
      expect(GN.sessionVolume(s)).toBe(900);
      expect(GN.sessionSetCounts(s)).toEqual({ done: 3, total: 8 });
    });
    it('завершённую тренировку изменить нельзя', () => {
      const d = GN.finishSession(GN.completeSet(newSession(), 0, 0, { weight: 50, value: 8 }, now), later(3600));
      expect(d.status).toBe('completed');
      expect(d.restTimer).toBeNull();
      expect(() => GN.completeSet(d, 0, 1, { weight: 50, value: 8 }, later(3700))).toThrow(GN.SessionError);
    });
  });

  describe('Разминочные подходы', () => {
    const tplW = { ...templateA, items: templateA.items.map((i, k) => ({ ...i, warmupSets: k === 0 ? 2 : 0 })) };
    const fresh = () => GN.createSessionFromTemplate({ id: 'w', template: tplW, exercises, cycle: null, plannedDate: '2026-10-12', cycleWeek: null, now });

    it('сначала разминка, затем рабочие подходы', () => {
      const s = fresh();
      expect(s.exercises[0].sets.map((x) => x.warmup)).toEqual([true, true, false, false, false]);
      expect(s.exercises[0].snapshot.warmupSets).toBe(2);
      expect(GN.kindIndex(s.exercises[0], s.exercises[0].sets[3])).toBe(1);
    });
    it('после разминки отдых короче (60 с)', () => {
      const s = GN.completeSet(fresh(), 0, 0, { weight: 20, value: 12 }, now);
      expect(s.restTimer.durationSeconds).toBe(60);
    });
    it('разминка не входит в объём и счётчики, тренировку можно завершить без неё', () => {
      let s = fresh();
      s = GN.completeSet(s, 0, 0, { weight: 20, value: 12 }, now);
      expect(GN.sessionVolume(s)).toBe(0);
      expect(GN.sessionSetCounts(s)).toEqual({ done: 0, total: 8 });
      s.exercises.forEach((e, ei) => e.sets.forEach((x, si) => { if (!x.warmup) s = GN.completeSet(s, ei, si, { weight: 50, value: 8 }, now); }));
      expect(GN.isSessionFullyDone(s)).toBeTrue();
    });
  });

  // ── «Прошлый раз» ──
  function doneSession(id, template, date, results, status = 'completed') {
    const start = new Date(`${date}T15:00:00.000Z`);
    let s = GN.createSessionFromTemplate({ id, template, exercises, cycle: null, plannedDate: date, cycleWeek: null, now: start });
    s.exercises.forEach((e, ei) => (results[e.exerciseId] || []).forEach(([w, v], si) => (s = GN.completeSet(s, ei, si, { weight: w, value: v }, start))));
    return status === 'completed' ? GN.finishSession(s, new Date(start.getTime() + 3600000)) : s;
  }

  describe('Прошлый результат', () => {
    const a1 = doneSession('a1', templateA, '2026-10-12', { bench: [[45, 8], [45, 8], [45, 7]] });
    const d1 = doneSession('d1', templateD, '2026-10-19', { bench: [[50, 6], [50, 6]] });

    it('приоритет — тот же шаблон, даже если в другом выполнялось позже', () => {
      const prev = GN.findPreviousPerformance([a1, d1], 'bench', templateA.id);
      expect(prev).toMatchObject({ sessionId: 'a1', sameTemplate: true });
      expect(prev.sets.map((s) => s.value)).toEqual([8, 8, 7]);
    });
    it('если в шаблоне не было — последнее выполнение вообще', () => {
      expect(GN.findPreviousPerformance([a1], 'bench', templateD.id)).toMatchObject({ sessionId: 'a1', sameTemplate: false });
    });
    it('берёт самое свежее выполнение в шаблоне', () => {
      const a2 = doneSession('a2', templateA, '2026-10-26', { bench: [[47.5, 8]] });
      expect(GN.findPreviousPerformance([a1, a2, d1], 'bench', templateA.id).sessionId).toBe('a2');
    });
    it('не учитывает незавершённые, текущую и пропущенные упражнения', () => {
      const ip = doneSession('ip', templateA, '2026-10-30', { bench: [[60, 8]] }, 'in_progress');
      const sk = doneSession('sk', templateA, '2026-10-28', { row: [[30, 10]] });
      expect(GN.findPreviousPerformance([a1, ip, sk], 'bench', templateA.id, 'a1')).toBeNull();
      expect(GN.findPreviousPerformance([a1, ip, sk], 'bench', templateA.id).sessionId).toBe('a1');
    });
    it('нет истории — null', () => expect(GN.findPreviousPerformance([], 'bench', templateA.id)).toBeNull());
    it('подходы по номеру; лишним — последний известный', () => {
      const prev = GN.findPreviousPerformance([d1], 'bench', templateD.id);
      expect(GN.previousSetAt(prev, 0)).toMatchObject({ weight: 50, value: 6 });
      expect(GN.previousSetAt(prev, 2)).toMatchObject({ weight: 50, value: 6 });
      expect(GN.previousSetAt(null, 0)).toBeNull();
    });
  });

  describe('Десятичная запятая и форматирование', () => {
    it('вес отображается с запятой', () => {
      expect(GN.formatNumber(47.5)).toBe('47,5');
      expect(GN.formatNumber(42.5)).toBe('42,5');
      expect(GN.formatNumber(50)).toBe('50');
    });
    it('ввод принимает запятую и точку', () => {
      expect(GN.parseDecimal('47,5')).toBe(47.5);
      expect(GN.parseDecimal('52.5')).toBe(52.5);
      expect(GN.parseDecimal('47,')).toBe(47);
      expect(GN.parseDecimal('')).toBeNull();
      expect(GN.parseDecimal('4,5,5')).toBeUndefined();
      expect(GN.parseDecimal('-5')).toBeUndefined();
      expect(GN.parseInteger('8')).toBe(8);
      expect(GN.parseInteger('8,5')).toBeUndefined();
    });
    it('отдых диапазоном', () => {
      expect(GN.formatRest(180)).toBe('3 мин');
      expect(GN.formatRest(180, 120)).toBe('2–3 мин');
      expect(GN.formatRest(90, 60)).toBe('1–1,5 мин');
    });
    it('время, подход, склонения', () => {
      expect(GN.formatClock(90)).toBe('1:30');
      expect(GN.formatDuration(65 * 60000)).toBe('1 ч 05 мин');
      expect(GN.formatSet(45, 8, 'reps')).toBe('45 × 8');
      expect(GN.formatSet(null, 60, 'seconds')).toBe('60 с');
      expect(GN.exercisesLabel(7)).toBe('7 упражнений');
      expect(GN.exercisesLabel(21)).toBe('21 упражнение');
    });
  });
})();
