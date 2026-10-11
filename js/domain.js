/*
 * Доменная логика: даты, форматирование, цикл 8 недель, тренировки, «прошлый раз».
 * Чистые функции без DOM и без базы — их проверяет tests.html.
 */
(function (GN) {
  'use strict';

  // ── Даты ────────────────────────────────────────────────
  // Даты дней храним строкой 'yyyy-MM-dd' в локальном времени — так тренировка около полуночи не «уедет».

  const pad = (n) => String(n).padStart(2, '0');

  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromISODate(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    return r;
  }

  /** Разница в календарных днях (не зависит от часов и перехода на летнее время). */
  function diffDays(a, b) {
    return Math.round((startOfDay(a) - startOfDay(b)) / 864e5);
  }

  function nextMonday(d) {
    const day = d.getDay(); // 0 = вс
    const delta = day === 1 ? 7 : (8 - day) % 7 || 7;
    return addDays(d, delta);
  }

  const asDate = (v) => (typeof v === 'string' ? fromISODate(v) : v);
  const fmt = (opts) => new Intl.DateTimeFormat('ru-RU', opts);
  const fDayMonth = fmt({ day: 'numeric', month: 'long' });
  const fDayMonthShort = fmt({ day: 'numeric', month: 'short' });
  const fWeekday = fmt({ weekday: 'long' });
  const fWeekdayShort = fmt({ weekday: 'short' });

  const formatDayMonth = (v) => fDayMonth.format(asDate(v)); // «11 октября»
  const formatDayMonthShort = (v) => fDayMonthShort.format(asDate(v)).replace('.', ''); // «11 окт»
  const formatWeekday = (v) => fWeekday.format(asDate(v)); // «воскресенье»
  const formatWeekdayShort = (v) => fWeekdayShort.format(asDate(v)).replace('.', ''); // «вс»
  const formatWeekdayDate = (v) => `${formatWeekdayShort(v)}, ${formatDayMonth(v)}`; // «пн, 12 октября»

  // ── Числа и текст ───────────────────────────────────────

  const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2, useGrouping: false });

  /** 47.5 → «47,5» */
  const formatNumber = (n) => numberFormat.format(n);

  /** «47,5» / «47.5» / «47,» → число; '' → null; мусор → undefined */
  function parseDecimal(input) {
    const raw = String(input).replace(/\s+/g, '');
    if (raw === '') return null;
    if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(raw)) return undefined;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  function parseInteger(input) {
    const raw = String(input).replace(/\s+/g, '');
    if (raw === '') return null;
    if (!/^\d+$/.test(raw)) return undefined;
    return Number(raw);
  }

  /** 90 → «1:30» */
  function formatClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  }

  function formatDuration(ms) {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h === 0 ? `${m} мин` : `${h} ч ${pad(m)} мин`;
  }

  function plural(n, forms) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  const formatRepRange = (min, max) => (min === max ? `${min}` : `${min}–${max}`);
  const exercisesLabel = (n) => `${n} ${plural(n, ['упражнение', 'упражнения', 'упражнений'])}`;

  function formatSet(weight, value, type) {
    const v = value == null ? '—' : formatNumber(value);
    if (type === 'seconds') return weight != null ? `${formatNumber(weight)} кг × ${v} с` : `${v} с`;
    return weight != null ? `${formatNumber(weight)} × ${v}` : `${v} повт.`;
  }

  /** Отдых: 180 → «3 мин», (120, 180) → «2–3 мин», (60, 90) → «1–1,5 мин» */
  function formatRest(maxSec, minSec) {
    const m = (sec) => formatNumber(Math.round((sec / 60) * 10) / 10);
    if (maxSec < 60) return `${maxSec} с`;
    if (minSec && minSec < maxSec) return `${m(minSec)}–${m(maxSec)} мин`;
    return `${m(maxSec)} мин`;
  }

  /** «каждой рукой» / «на каждую сторону» */
  const perSideLabel = (perSide) => (perSide === 'arm' ? 'каждой рукой' : perSide === 'side' ? 'на каждую сторону' : '');

  const formatVolume = (kg) => `${new Intl.NumberFormat('ru-RU').format(Math.round(kg))} кг`;

  // ── Расписание ──────────────────────────────────────────

  const CYCLE_WEEKS = 8;
  const CYCLE_LENGTH_DAYS = 56;
  const DELOAD_WEEK = 8;
  const TEMPLATE_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'LA', 'LB'];

  /** Недели 1,3,5,7 — A/B/C (пн/ср/пт), 2,4,6 — D/E/F, неделя 8 — Light A (вт), Light B (чт). */
  function buildDefaultSlots() {
    const slots = [];
    for (let week = 0; week < 7; week++) {
      const codes = week % 2 === 0 ? ['A', 'B', 'C'] : ['D', 'E', 'F'];
      [0, 2, 4].forEach((off, i) => slots.push({ dayOffset: week * 7 + off, templateCode: codes[i] }));
    }
    slots.push({ dayOffset: 50, templateCode: 'LA' });
    slots.push({ dayOffset: 52, templateCode: 'LB' });
    return slots;
  }

  // Внутренние коды A–F, на экране — русские буквы, как в бумажном блокноте
  const LETTERS = { A: 'А', B: 'Б', C: 'В', D: 'Г', E: 'Д', F: 'Е', LA: 'LА', LB: 'LБ' };
  const templateLetter = (code) => LETTERS[code] || code;

  function templateTitle(code) {
    if (code === 'LA') return 'Light А';
    if (code === 'LB') return 'Light Б';
    return `Тренировка ${templateLetter(code)}`;
  }

  const isLightTemplate = (code) => code === 'LA' || code === 'LB';

  // ── Цикл ────────────────────────────────────────────────

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const getDayIndex = (startDate, date) => diffDays(date, fromISODate(startDate));
  const weekForDayIndex = (i, scheme) => clamp(Math.floor(i / 7) + 1, 1, scheme.weeks);
  const getCycleEndDate = (startDate, scheme) => toISODate(addDays(fromISODate(startDate), scheme.lengthDays - 1));

  function getCyclePosition(startDate, scheme, today) {
    const dayIndex = getDayIndex(startDate, today);
    const status = dayIndex < 0 ? 'not_started' : dayIndex >= scheme.lengthDays ? 'finished' : 'active';
    const week = weekForDayIndex(dayIndex, scheme);
    return {
      status,
      dayIndex,
      week,
      weeks: scheme.weeks,
      day: clamp(dayIndex + 1, 1, scheme.lengthDays),
      lengthDays: scheme.lengthDays,
      progress: clamp((dayIndex + 1) / scheme.lengthDays, 0, 1),
      isDeloadWeek: status === 'active' && scheme.deloadWeek === week,
      startDate,
      endDate: getCycleEndDate(startDate, scheme),
    };
  }

  function getPlannedWorkouts(startDate, scheme) {
    const start = fromISODate(startDate);
    return scheme.slots
      .filter((s) => s.dayOffset >= 0 && s.dayOffset < scheme.lengthDays)
      .slice()
      .sort((a, b) => a.dayOffset - b.dayOffset)
      .map((s) => ({
        date: toISODate(addDays(start, s.dayOffset)),
        dayIndex: s.dayOffset,
        week: weekForDayIndex(s.dayOffset, scheme),
        templateCode: s.templateCode,
      }));
  }

  function getWorkoutForDate(startDate, scheme, date) {
    const i = getDayIndex(startDate, date);
    return getPlannedWorkouts(startDate, scheme).find((w) => w.dayIndex === i) || null;
  }

  function getNextWorkout(startDate, scheme, after) {
    const i = getDayIndex(startDate, after);
    return getPlannedWorkouts(startDate, scheme).find((w) => w.dayIndex > i) || null;
  }

  function buildCycleCalendar(startDate, scheme) {
    const start = fromISODate(startDate);
    const byDay = new Map(getPlannedWorkouts(startDate, scheme).map((w) => [w.dayIndex, w]));
    const weeks = [];
    for (let w = 0; w < scheme.weeks; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dayIndex = w * 7 + d;
        days.push({ date: toISODate(addDays(start, dayIndex)), dayIndex, workout: byDay.get(dayIndex) || null });
      }
      weeks.push({ week: w + 1, isDeload: scheme.deloadWeek === w + 1, days });
    }
    return weeks;
  }

  /** Что показывать на экране «Сегодня». */
  function getTodayPlan(cycle, scheme, today) {
    if (!cycle || !scheme) return { kind: 'no_cycle' };
    const position = getCyclePosition(cycle.startDate, scheme, today);
    const next = getNextWorkout(cycle.startDate, scheme, today);
    if (position.status === 'not_started') {
      return { kind: 'not_started', position, next: getPlannedWorkouts(cycle.startDate, scheme)[0] || null };
    }
    if (position.status === 'finished') return { kind: 'finished', position };
    const planned = getWorkoutForDate(cycle.startDate, scheme, today);
    if (planned) return { kind: 'workout', position, planned, next };
    return { kind: 'rest', position, next };
  }

  // ── Тренировка (WorkoutSession) ─────────────────────────
  // Каждая функция возвращает новый объект. Завершённую тренировку изменить нельзя.

  class SessionError extends Error {}

  /**
   * Чередование: у пункта шаблона может быть altExerciseId — его делают на каждом втором
   * выполнении этой тренировки (2-е, 4-е…). occurrence — номер выполнения, с 1.
   */
  function resolveItemExerciseId(item, occurrence = 1) {
    return item.altExerciseId && occurrence % 2 === 0 ? item.altExerciseId : item.exerciseId;
  }

  function createSessionFromTemplate({ id, template, exercises, cycle, plannedDate, cycleWeek, now, occurrence = 1 }) {
    const nowIso = now.toISOString();
    const lookup = (eid) => (exercises instanceof Map ? exercises.get(eid) : exercises[eid]);
    const list = template.items.map((item, order) => {
      const exId = resolveItemExerciseId(item, occurrence);
      const ex = lookup(exId);
      if (!ex) throw new SessionError(`Упражнение ${exId} не найдено`);
      return {
        exerciseId: ex.id,
        templateItemId: item.id,
        order,
        // snapshot: копия упражнения и настроек шаблона на момент тренировки
        snapshot: JSON.parse(
          JSON.stringify({
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            instruction: ex.instruction,
            resultType: ex.resultType,
            image: ex.image,
            perSide: ex.perSide || null,
            sets: item.sets,
            warmupSets: item.warmupSets || 0,
            repMin: item.repMin,
            repMax: item.repMax,
            restSeconds: item.restSeconds,
            restMinSeconds: item.restMinSeconds || null,
          }),
        ),
        // Сначала разминочные подходы (warmup: true), затем рабочие
        sets: Array.from({ length: (item.warmupSets || 0) + item.sets }, (_, index) => ({
          index,
          warmup: index < (item.warmupSets || 0),
          weight: null,
          value: null,
          completedAt: null,
        })),
        collapsed: false,
      };
    });
    return {
      id,
      occurrence,
      cycleId: cycle ? cycle.id : null,
      templateId: template.id,
      templateCode: template.code,
      templateName: template.name,
      plannedDate,
      cycleWeek,
      startedAt: nowIso,
      finishedAt: null,
      status: 'in_progress',
      exercises: list,
      exerciseIds: [...new Set(list.map((e) => e.exerciseId))],
      restTimer: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null,
    };
  }

  function assertEditable(s) {
    if (s.status !== 'in_progress') throw new SessionError('Завершённую тренировку нельзя изменить');
  }

  const touch = (s, now) => ({ ...s, updatedAt: now.toISOString() });

  function mapSet(s, ei, si, fn) {
    const ex = s.exercises[ei];
    if (!ex || !ex.sets[si]) throw new SessionError('Подход не найден');
    return {
      ...s,
      exercises: s.exercises.map((e, i) => (i === ei ? { ...e, sets: e.sets.map((x, j) => (j === si ? fn(x) : x)) } : e)),
    };
  }

  function updateSetDraft(s, ei, si, patch, now) {
    assertEditable(s);
    return touch(mapSet(s, ei, si, (x) => ({ ...x, ...patch })), now);
  }

  const WARMUP_REST_SECONDS = 60;

  /** Тренировка считается выполненной по рабочим подходам; разминку можно пропустить. */
  const isSessionFullyDone = (s) => s.exercises.every((e) => workingSets(e).every((x) => x.completedAt != null));

  /** Отметить подход и запустить отдых: храним момент окончания, а не счётчик. */
  function completeSet(s, ei, si, input, now) {
    assertEditable(s);
    if (input.value == null || input.value <= 0) throw new SessionError('Укажите количество повторений');
    if (input.weight != null && input.weight < 0) throw new SessionError('Вес не может быть отрицательным');
    let next = mapSet(s, ei, si, (x) => ({ ...x, weight: input.weight, value: input.value, completedAt: now.toISOString() }));
    const fullRest = next.exercises[ei].snapshot.restSeconds;
    const rest = next.exercises[ei].sets[si].warmup ? Math.min(WARMUP_REST_SECONDS, fullRest) : fullRest;
    next = {
      ...next,
      restTimer:
        isSessionFullyDone(next) || rest <= 0
          ? null
          : { endsAt: now.getTime() + rest * 1000, durationSeconds: rest, exerciseIndex: ei, setIndex: si },
    };
    return touch(next, now);
  }

  function uncompleteSet(s, ei, si, now) {
    assertEditable(s);
    const next = mapSet(s, ei, si, (x) => ({ ...x, completedAt: null }));
    const t = next.restTimer;
    const clear = t && t.exerciseIndex === ei && t.setIndex === si;
    return touch({ ...next, restTimer: clear ? null : t }, now);
  }

  function clearRestTimer(s, now) {
    assertEditable(s);
    return touch({ ...s, restTimer: null }, now);
  }

  function extendRestTimer(s, seconds, now) {
    assertEditable(s);
    if (!s.restTimer) return s;
    const base = Math.max(s.restTimer.endsAt, now.getTime());
    return touch(
      { ...s, restTimer: { ...s.restTimer, endsAt: base + seconds * 1000, durationSeconds: s.restTimer.durationSeconds + seconds } },
      now,
    );
  }

  function setExerciseCollapsed(s, ei, collapsed, now) {
    assertEditable(s);
    return touch({ ...s, exercises: s.exercises.map((e, i) => (i === ei ? { ...e, collapsed } : e)) }, now);
  }

  function finishSession(s, now) {
    assertEditable(s);
    return touch({ ...s, status: 'completed', finishedAt: now.toISOString(), restTimer: null }, now);
  }

  function abandonSession(s, now) {
    assertEditable(s);
    return touch({ ...s, status: 'abandoned', finishedAt: now.toISOString(), restTimer: null }, now);
  }

  // Старые записи без поля warmup считаются рабочими подходами
  const workingSets = (ex) => ex.sets.filter((x) => !x.warmup);
  const warmupSets = (ex) => ex.sets.filter((x) => x.warmup);
  /** Выполненные РАБОЧИЕ подходы — для объёма, итогов и «Прошлого раза». */
  const completedSets = (ex) => workingSets(ex).filter((x) => x.completedAt != null);
  const completedWarmups = (ex) => warmupSets(ex).filter((x) => x.completedAt != null);
  const isExerciseDone = (ex) => workingSets(ex).length > 0 && workingSets(ex).every((x) => x.completedAt != null);
  /** Номер подхода внутри своей группы: разминка 0,1…; рабочие 0,1,2… */
  const kindIndex = (ex, set) => (set.warmup ? set.index : set.index - warmupSets(ex).length);

  /** Объём = Σ вес × повторы выполненных подходов. Упражнения на время не учитываются. */
  function exerciseVolume(ex) {
    if (ex.snapshot.resultType !== 'reps') return 0;
    return completedSets(ex).reduce((sum, x) => sum + (x.weight || 0) * (x.value || 0), 0);
  }

  const sessionVolume = (s) => s.exercises.reduce((sum, e) => sum + exerciseVolume(e), 0);

  function sessionSetCounts(s) {
    let done = 0;
    let total = 0;
    s.exercises.forEach((e) => {
      total += workingSets(e).length;
      done += completedSets(e).length;
    });
    return { done, total };
  }

  const sessionExerciseCounts = (s) => ({ done: s.exercises.filter(isExerciseDone).length, total: s.exercises.length });

  function sessionDurationMs(s, now) {
    const end = s.finishedAt ? Date.parse(s.finishedAt) : (now || new Date()).getTime();
    return end - Date.parse(s.startedAt);
  }

  // ── «Прошлый раз» ───────────────────────────────────────

  /**
   * 1) последнее выполнение упражнения в том же шаблоне;
   * 2) иначе — последнее выполнение вообще.
   * Только завершённые тренировки, где у упражнения есть выполненные подходы.
   */
  function findPreviousPerformance(sessions, exerciseId, templateId, excludeSessionId) {
    const candidates = sessions
      .filter((s) => s.status === 'completed' && s.finishedAt && s.id !== excludeSessionId)
      .map((s) => {
        const ex = s.exercises.find((e) => e.exerciseId === exerciseId && (completedSets(e).length > 0 || completedWarmups(e).length > 0));
        return ex ? { session: s, exercise: ex } : null;
      })
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.session.finishedAt) - Date.parse(a.session.finishedAt));

    const match = candidates.find((c) => c.session.templateId === templateId) || candidates[0];
    if (!match) return null;
    return {
      sessionId: match.session.id,
      plannedDate: match.session.plannedDate,
      finishedAt: match.session.finishedAt,
      templateId: match.session.templateId,
      templateName: match.session.templateName,
      sameTemplate: match.session.templateId === templateId,
      resultType: match.exercise.snapshot.resultType,
      sets: completedSets(match.exercise),
      warmups: completedWarmups(match.exercise),
    };
  }

  /** Прошлый подход с тем же номером; если подходов было меньше — последний известный. */
  function previousSetAt(prev, index, warmup = false) {
    const list = prev ? (warmup ? prev.warmups || [] : prev.sets) : [];
    if (list.length === 0) return null;
    return list[index] || list[list.length - 1];
  }

  // ── Редактирование программы ────────────────────────────

  function moveItem(t, index, delta) {
    const target = index + delta;
    if (target < 0 || target >= t.items.length) return t;
    const items = t.items.slice();
    [items[index], items[target]] = [items[target], items[index]];
    return { ...t, items };
  }

  const removeItem = (t, itemId) => ({ ...t, items: t.items.filter((i) => i.id !== itemId) });
  const updateItem = (t, itemId, patch) => ({ ...t, items: t.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) });

  function addItem(t, ex, id) {
    const sec = ex.resultType === 'seconds';
    return {
      ...t,
      items: [
        ...t.items,
        {
          id,
          exerciseId: ex.id,
          sets: 3,
          warmupSets: t.items.length < 4 ? 2 : 0,
          repMin: sec ? 30 : 8,
          repMax: sec ? 60 : 12,
          restSeconds: ex.defaultRestSeconds,
          restMinSeconds: null,
        },
      ],
    };
  }

  function validateTemplate(t) {
    const errors = [];
    if (t.items.length === 0) errors.push(`${t.name}: нужно хотя бы одно упражнение`);
    t.items.forEach((i, idx) => {
      const n = idx + 1;
      if (!Number.isInteger(i.sets) || i.sets < 1 || i.sets > 10) errors.push(`${t.name}, №${n}: подходов 1–10`);
      if (i.repMin < 1 || i.repMax < 1) errors.push(`${t.name}, №${n}: повторы должны быть больше нуля`);
      if (i.repMin > i.repMax) errors.push(`${t.name}, №${n}: минимум повторов больше максимума`);
      if (i.restSeconds < 0 || i.restSeconds > 600) errors.push(`${t.name}, №${n}: отдых 0–10 минут`);
      if (i.warmupSets != null && (i.warmupSets < 0 || i.warmupSets > 5)) errors.push(`${t.name}, №${n}: разминка 0–5 подходов`);
    });
    return errors;
  }

  Object.assign(GN, {
    toISODate, fromISODate, addDays, diffDays, nextMonday,
    formatDayMonth, formatDayMonthShort, formatWeekday, formatWeekdayShort, formatWeekdayDate,
    formatNumber, parseDecimal, parseInteger, formatClock, formatDuration, plural, formatRepRange,
    exercisesLabel, formatSet, formatVolume,
    formatRest, perSideLabel, templateLetter, WARMUP_REST_SECONDS, workingSets, warmupSets, completedWarmups, kindIndex,
    CYCLE_WEEKS, CYCLE_LENGTH_DAYS, DELOAD_WEEK, TEMPLATE_CODES, buildDefaultSlots, templateTitle, isLightTemplate,
    getDayIndex, weekForDayIndex, getCycleEndDate, getCyclePosition, getPlannedWorkouts, getWorkoutForDate,
    getNextWorkout, buildCycleCalendar, getTodayPlan,
    SessionError, createSessionFromTemplate, resolveItemExerciseId, updateSetDraft, isSessionFullyDone, completeSet, uncompleteSet,
    clearRestTimer, extendRestTimer, setExerciseCollapsed, finishSession, abandonSession,
    completedSets, isExerciseDone, exerciseVolume, sessionVolume, sessionSetCounts, sessionExerciseCounts,
    sessionDurationMs, findPreviousPerformance, previousSetAt,
    moveItem, removeItem, updateItem, addItem, validateTemplate,
  });
})((globalThis.GN = globalThis.GN || {}));
