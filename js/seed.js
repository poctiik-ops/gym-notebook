/*
 * Программа по умолчанию (заготовка — меняется в «Редактировать программу») и демо-история.
 * id стабильные, чтобы повторное заполнение и будущая синхронизация не плодили дубликаты.
 */
(function (GN) {
  'use strict';

  const SEED_VERSION = 1;
  const DEFAULT_SCHEME_ID = 'scheme-default';

  // [id, название, мышцы, картинка, отдых (с), подсказка, тип результата]
  const EXERCISES = [
    ['bench-press', 'Жим штанги лёжа', 'Грудь', 'chest', 120, 'Лопатки сведены, стопы в пол. Опускайте гриф к низу груди, локти под 45°.'],
    ['incline-db-press', 'Жим гантелей на наклонной', 'Грудь', 'chest', 90, 'Скамья 30°. Гантели опускайте до уровня груди, без рывка вверху.'],
    ['db-bench-press', 'Жим гантелей лёжа', 'Грудь', 'chest', 90, 'Плавно вниз, гантели над плечами в верхней точке.'],
    ['incline-bench-press', 'Жим штанги на наклонной', 'Грудь', 'chest', 120, 'Гриф к верху груди, поясница прижата к скамье.'],
    ['machine-chest-press', 'Жим в тренажёре сидя', 'Грудь', 'chest', 90, 'Рукояти на уровне середины груди, не отрывайте лопатки.'],
    ['cable-fly', 'Разведения в кроссовере', 'Грудь', 'chest', 60, 'Локти слегка согнуты, сводите руки дугой, пауза в центре.'],
    ['lat-pulldown', 'Тяга верхнего блока', 'Спина', 'back', 90, 'Тяните к верху груди локтями вниз, не отклоняйтесь сильно назад.'],
    ['close-grip-pulldown', 'Тяга верхнего блока узким хватом', 'Спина', 'back', 90, 'Корпус неподвижен, локти вдоль тела.'],
    ['db-row', 'Тяга гантели в наклоне', 'Спина', 'back', 90, 'Спина ровная, тяните гантель к поясу, а не к груди.'],
    ['barbell-row', 'Тяга штанги в наклоне', 'Спина', 'back', 120, 'Наклон ~45°, гриф к низу живота, без рывков корпусом.'],
    ['seated-cable-row', 'Тяга горизонтального блока', 'Спина', 'back', 90, 'Грудь вперёд, сводите лопатки в конце движения.'],
    ['pull-up', 'Подтягивания', 'Спина', 'back', 120, 'Полная амплитуда, подбородок над перекладиной. Вес — дополнительное отягощение.'],
    ['cable-pullover', 'Пуловер на блоке', 'Спина', 'back', 60, 'Руки почти прямые, ведите рукоять к бёдрам за счёт спины.'],
    ['deadlift', 'Становая тяга', 'Спина и ноги', 'back', 180, 'Гриф у голени, спина нейтральная, вставайте ногами, а не поясницей.'],
    ['overhead-press', 'Жим штанги стоя', 'Плечи', 'shoulders', 120, 'Ягодицы и пресс напряжены, гриф по прямой над головой.'],
    ['seated-db-press', 'Жим гантелей сидя', 'Плечи', 'shoulders', 90, 'Опускайте до уровня ушей, не прогибайте поясницу.'],
    ['lateral-raise', 'Махи гантелями в стороны', 'Плечи', 'shoulders', 60, 'Небольшой вес, локти чуть выше кистей, без раскачки.'],
    ['rear-delt-fly', 'Обратные разведения', 'Плечи', 'shoulders', 60, 'Наклон корпуса, разводите руки за счёт задней дельты.'],
    ['face-pull', 'Тяга каната к лицу', 'Плечи', 'shoulders', 60, 'Тяните канат к глазам, разводя концы в стороны.'],
    ['squat', 'Приседания со штангой', 'Ноги', 'legs', 150, 'Колени по линии носков, глубина — бедро параллельно полу.'],
    ['goblet-squat', 'Гоблет-присед', 'Ноги', 'legs', 120, 'Гантель у груди, корпус вертикально, садитесь между коленей.'],
    ['leg-press', 'Жим ногами', 'Ноги', 'legs', 90, 'Поясница прижата, колени не выпрямляйте до замка.'],
    ['leg-extension', 'Разгибание ног', 'Ноги', 'legs', 60, 'Пауза в верхней точке, медленно вниз.'],
    ['bulgarian-split-squat', 'Болгарские выпады', 'Ноги', 'legs', 90, 'Задняя нога на скамье, опускайтесь вертикально. Вес — одной гантели.'],
    ['romanian-deadlift', 'Румынская тяга', 'Задняя поверхность бедра', 'hamstrings', 120, 'Таз назад, колени чуть согнуты, гриф скользит по бёдрам.'],
    ['leg-curl', 'Сгибание ног в тренажёре', 'Задняя поверхность бедра', 'hamstrings', 60, 'Таз прижат, без рывка, медленное опускание.'],
    ['db-lunge', 'Выпады с гантелями', 'Ягодицы', 'glutes', 90, 'Шаг достаточно длинный, колено задней ноги почти касается пола.'],
    ['hip-thrust', 'Ягодичный мост', 'Ягодицы', 'glutes', 90, 'Лопатки на скамье, подбородок к груди, пауза вверху.'],
    ['standing-calf-raise', 'Подъём на носки стоя', 'Икры', 'calves', 60, 'Полная амплитуда, пауза внизу и вверху.'],
    ['seated-calf-raise', 'Подъём на носки сидя', 'Икры', 'calves', 60, 'Медленно, без пружинящих движений.'],
    ['barbell-curl', 'Подъём штанги на бицепс', 'Бицепс', 'arms', 60, 'Локти прижаты, без раскачки корпусом.'],
    ['hammer-curl', 'Молотки', 'Бицепс', 'arms', 60, 'Нейтральный хват, поднимайте поочерёдно.'],
    ['db-curl', 'Сгибания с гантелями', 'Бицепс', 'arms', 60, 'Супинируйте кисть в подъёме, медленно вниз.'],
    ['skull-crusher', 'Французский жим', 'Трицепс', 'arms', 60, 'Двигаются только предплечья, локти смотрят вверх.'],
    ['triceps-pushdown', 'Разгибания на блоке', 'Трицепс', 'arms', 60, 'Локти у корпуса, полное разгибание внизу.'],
    ['dips', 'Отжимания на брусьях', 'Трицепс', 'arms', 90, 'Корпус вертикально, опускайтесь до 90° в локтях. Вес — дополнительный.'],
    ['plank', 'Планка', 'Пресс', 'core', 60, 'Тело одной линией, таз не провисает. Результат — в секундах.', 'seconds'],
    ['side-plank', 'Боковая планка', 'Пресс', 'core', 45, 'Таз высоко, корпус ровный. Время на каждую сторону.', 'seconds'],
    ['cable-crunch', 'Скручивания на блоке', 'Пресс', 'core', 60, 'Скручивайтесь грудью к тазу, бёдра неподвижны.'],
    ['hanging-leg-raise', 'Подъём ног в висе', 'Пресс', 'core', 60, 'Без раскачки, подкручивайте таз вверху.'],
  ];

  // [упражнение, подходы, повторы от, повторы до]
  const TEMPLATES = {
    A: [
      ['bench-press', 3, 6, 8],
      ['lat-pulldown', 3, 8, 10],
      ['incline-db-press', 3, 8, 10],
      ['db-row', 3, 8, 10],
      ['lateral-raise', 3, 12, 15],
      ['skull-crusher', 3, 10, 12],
      ['plank', 3, 30, 60],
    ],
    B: [
      ['squat', 3, 6, 8],
      ['romanian-deadlift', 3, 8, 10],
      ['leg-press', 3, 10, 12],
      ['db-lunge', 3, 10, 12],
      ['leg-curl', 3, 10, 12],
      ['standing-calf-raise', 3, 12, 15],
      ['cable-crunch', 3, 12, 15],
    ],
    C: [
      ['overhead-press', 3, 6, 8],
      ['pull-up', 3, 6, 10],
      ['machine-chest-press', 3, 8, 10],
      ['seated-cable-row', 3, 10, 12],
      ['barbell-curl', 3, 8, 10],
      ['triceps-pushdown', 3, 10, 12],
      ['rear-delt-fly', 3, 12, 15],
    ],
    D: [
      ['db-bench-press', 3, 8, 10],
      ['barbell-row', 3, 6, 8],
      ['seated-db-press', 3, 8, 10],
      ['cable-pullover', 3, 10, 12],
      ['cable-fly', 3, 12, 15],
      ['hammer-curl', 3, 10, 12],
      ['side-plank', 3, 30, 45],
    ],
    E: [
      ['deadlift', 3, 5, 6],
      ['goblet-squat', 3, 8, 10],
      ['hip-thrust', 3, 10, 12],
      ['leg-extension', 3, 12, 15],
      ['bulgarian-split-squat', 3, 8, 10],
      ['seated-calf-raise', 3, 15, 20],
      ['hanging-leg-raise', 3, 10, 15],
    ],
    F: [
      ['incline-bench-press', 3, 6, 8],
      ['close-grip-pulldown', 3, 8, 10],
      ['dips', 3, 8, 12],
      ['face-pull', 3, 12, 15],
      ['lateral-raise', 3, 12, 15],
      ['db-curl', 3, 10, 12],
      ['plank', 3, 30, 60],
    ],
    LA: [
      ['bench-press', 2, 8, 10],
      ['lat-pulldown', 2, 10, 12],
      ['incline-db-press', 2, 10, 12],
      ['db-row', 2, 10, 12],
      ['lateral-raise', 2, 12, 15],
    ],
    LB: [
      ['squat', 2, 8, 10],
      ['romanian-deadlift', 2, 10, 12],
      ['leg-press', 2, 10, 12],
      ['leg-curl', 2, 12, 15],
      ['standing-calf-raise', 2, 12, 15],
    ],
  };

  /** Стартовые рабочие веса для демо; null — собственный вес. */
  const BASE_WEIGHT = {
    'ex-bench-press': 45, 'ex-incline-db-press': 16, 'ex-db-bench-press': 18, 'ex-incline-bench-press': 40,
    'ex-machine-chest-press': 35, 'ex-cable-fly': 10, 'ex-lat-pulldown': 40, 'ex-close-grip-pulldown': 40,
    'ex-db-row': 20, 'ex-barbell-row': 40, 'ex-seated-cable-row': 40, 'ex-pull-up': null,
    'ex-cable-pullover': 20, 'ex-deadlift': 70, 'ex-overhead-press': 30, 'ex-seated-db-press': 14,
    'ex-lateral-raise': 6, 'ex-rear-delt-fly': 6, 'ex-face-pull': 15, 'ex-squat': 60, 'ex-goblet-squat': 20,
    'ex-leg-press': 100, 'ex-leg-extension': 30, 'ex-bulgarian-split-squat': 10, 'ex-romanian-deadlift': 50,
    'ex-leg-curl': 30, 'ex-db-lunge': 12, 'ex-hip-thrust': 60, 'ex-standing-calf-raise': 40,
    'ex-seated-calf-raise': 25, 'ex-barbell-curl': 20, 'ex-hammer-curl': 10, 'ex-db-curl': 10,
    'ex-skull-crusher': 20, 'ex-triceps-pushdown': 20, 'ex-dips': null, 'ex-plank': null,
    'ex-side-plank': null, 'ex-cable-crunch': 25, 'ex-hanging-leg-raise': null,
  };

  function buildSeed(now) {
    const ts = now.toISOString();
    const meta = { createdAt: ts, updatedAt: ts, deletedAt: null };

    const exercises = EXERCISES.map(([id, name, muscleGroup, imageKey, rest, instruction, type]) => ({
      id: `ex-${id}`,
      name,
      muscleGroup,
      instruction,
      defaultRestSeconds: rest,
      resultType: type || 'reps',
      image: { kind: 'builtin', key: imageKey },
      ...meta,
    }));
    const restById = new Map(exercises.map((e) => [e.id, e.defaultRestSeconds]));

    const templates = Object.keys(TEMPLATES).map((code) => ({
      id: `tpl-${code}`,
      code,
      name: GN.templateTitle(code),
      items: TEMPLATES[code].map(([exId, sets, repMin, repMax], i) => {
        const exerciseId = `ex-${exId}`;
        if (!restById.has(exerciseId)) throw new Error(`Seed: нет упражнения ${exerciseId}`);
        return { id: `tpl-${code}-${i + 1}`, exerciseId, sets, repMin, repMax, restSeconds: restById.get(exerciseId) };
      }),
      ...meta,
    }));

    const scheme = {
      id: DEFAULT_SCHEME_ID,
      name: '8 недель: A/B/C — D/E/F, разгрузка',
      lengthDays: GN.CYCLE_LENGTH_DAYS,
      weeks: GN.CYCLE_WEEKS,
      deloadWeek: GN.DELOAD_WEEK,
      slots: GN.buildDefaultSlots(),
      ...meta,
    };

    return { exercises, templates, scheme };
  }

  /**
   * Демо: цикл, начатый в понедельник ~2,5 недели назад, и завершённые тренировки
   * за все прошедшие дни расписания с плавной прогрессией весов.
   */
  function buildDemo(seed, today, uuid) {
    const start = GN.addDays(today, -16);
    const monday = GN.addDays(start, -((start.getDay() + 6) % 7));
    const startDate = GN.toISODate(monday);
    const ts = today.toISOString();
    const cycle = { id: uuid(), startDate, schemeId: seed.scheme.id, status: 'active', createdAt: ts, updatedAt: ts, deletedAt: null };
    const templates = new Map(seed.templates.map((t) => [t.code, t]));
    const exercises = new Map(seed.exercises.map((e) => [e.id, e]));
    const todayIso = GN.toISODate(today);
    const occurrences = new Map();
    const sessions = [];

    for (const planned of GN.getPlannedWorkouts(startDate, seed.scheme)) {
      if (planned.date >= todayIso) break;
      const d = GN.fromISODate(planned.date);
      const started = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 30);
      let s = GN.createSessionFromTemplate({
        id: uuid(),
        template: templates.get(planned.templateCode),
        exercises,
        cycle,
        plannedDate: planned.date,
        cycleWeek: planned.week,
        now: started,
      });
      let minute = 3;
      s.exercises.forEach((ex, ei) => {
        const occ = occurrences.get(ex.exerciseId) || 0;
        occurrences.set(ex.exerciseId, occ + 1);
        const base = BASE_WEIGHT[ex.exerciseId] ?? null;
        const step = base != null && base < 15 ? 1 : 2.5;
        const weight = base == null ? null : base + step * Math.floor(occ / 2);
        const { repMin, repMax, resultType } = ex.snapshot;
        ex.sets.forEach((_, si) => {
          const value =
            resultType === 'seconds'
              ? Math.min(repMax, repMin + 5 * occ)
              : Math.max(repMin, Math.min(repMax, repMin + 1 + (occ % 3) - si));
          s = GN.completeSet(s, ei, si, { weight, value }, new Date(started.getTime() + minute * 60000));
          minute += 3;
        });
      });
      sessions.push(GN.finishSession(s, new Date(started.getTime() + (minute + 2) * 60000)));
    }
    return { cycle, sessions };
  }

  Object.assign(GN, { SEED_VERSION, DEFAULT_SCHEME_ID, buildSeed, buildDemo });
})((globalThis.GN = globalThis.GN || {}));
