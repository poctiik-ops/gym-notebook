/*
 * Программа (тренировки А–Е и лёгкие LА/LБ) и демо-история.
 * id стабильные: повторное заполнение и будущая синхронизация не плодят дубликаты.
 *
 * SEED_VERSION увеличивается при смене программы: у уже установленного приложения
 * шаблоны перезаписываются новой программой. История не меняется — у каждой тренировки свой snapshot.
 */
(function (GN) {
  'use strict';

  const SEED_VERSION = 2;
  const DEFAULT_SCHEME_ID = 'scheme-default';

  // Первые WARMUP_ITEMS упражнений каждой тренировки получают WARMUP_SETS разминочных подходов
  const WARMUP_ITEMS = 4;
  const WARMUP_SETS = 2;

  // [id, название, мышцы, картинка, отдых по умолчанию (с), подсказка, тип результата, «каждой» (arm|side)]
  const EXERCISES = [
    ['one-arm-lat-pulldown', 'Одноручная верхняя тяга в блоке сидя', 'Широчайшие', 'back', 180, 'Тяните локоть вниз к бедру, корпус не разворачивайте. Вверху — полное растяжение широчайшей.', 'reps', 'arm'],
    ['wide-neutral-pulldown', 'Верхняя тяга широким нейтральным хватом', 'Широчайшие', 'back', 180, 'Грудь вперёд, локти ведите вниз и чуть назад. Без рывка корпусом.', 'reps'],
    ['one-arm-cable-row-hip', 'Одноручная горизонтальная тяга нижнего блока к тазу', 'Широчайшие', 'back', 180, 'Тяните рукоять дугой к тазу, локоть вдоль тела. Вперёд — до растяжения.', 'reps', 'arm'],
    ['one-arm-db-row', 'Тяга гантели одной рукой к поясу', 'Широчайшие', 'back', 180, 'Спина ровная, гантель к поясу, а не к груди. Внизу — растяжение.', 'reps', 'arm'],
    ['cable-pullover', 'Пуловер в верхнем блоке', 'Широчайшие', 'back', 180, 'Руки почти прямые, ведите рукоять дугой к бёдрам за счёт спины.', 'reps'],
    ['wide-upright-row', 'Тяга штанги к верхней части груди широким хватом', 'Трапеция и дельты', 'shoulders', 120, 'Хват шире плеч, локти выше кистей. Тяните к верхней части груди, без рывка.', 'reps'],
    ['smith-shrug', 'Шраги в Смите', 'Трапеция', 'shoulders', 120, 'Плечи строго вверх к ушам, пауза наверху. Без вращений.', 'reps'],
    ['db-shrug', 'Шраги с гантелями', 'Трапеция', 'shoulders', 120, 'Гантели вдоль корпуса, плечи вверх, пауза наверху.', 'reps'],
    ['smith-incline-press', 'Наклонный жим в Смите', 'Грудь (верх)', 'chest', 180, 'Скамья 30°, гриф к верху груди, лопатки сведены.', 'reps'],
    ['incline-db-press', 'Наклонный жим гантелей', 'Грудь (верх)', 'chest', 180, 'Скамья 30°. Гантели до уровня груди, без удара вверху.', 'reps'],
    ['db-squeeze-press', 'Жим гантелей узко, прижимая их друг к другу', 'Грудь', 'chest', 180, 'Гантели прижаты друг к другу всю амплитуду — так работает грудь.', 'reps'],
    ['cable-crossover-mid', 'Кроссовер по центру', 'Грудь', 'chest', 180, 'Локти слегка согнуты, сводите руки перед грудью, пауза в центре.', 'reps'],
    ['cable-lateral-raise', 'Отведение рук с манжетами в нижнем блоке', 'Средняя дельта', 'shoulders', 120, 'Манжеты на запястьях, ведите локтем в сторону до уровня плеча.', 'reps'],
    ['db-lateral-raise', 'Подъём гантелей через стороны стоя', 'Средняя дельта', 'shoulders', 120, 'Небольшой вес, локоть чуть выше кисти, без раскачки.', 'reps'],
    ['reverse-pec-deck', 'Reverse Pec Deck', 'Задняя дельта', 'shoulders', 120, 'Грудь к спинке, разводите руки за счёт задней дельты, лопатки не сводите.', 'reps'],
    ['leg-extension', 'Разгибание ног сидя', 'Квадрицепс', 'legs', 180, 'Пауза в верхней точке, медленно вниз.', 'reps'],
    ['leg-press', 'Жим ногами', 'Квадрицепс и ягодицы', 'legs', 180, 'Поясница прижата, колени не выпрямляйте до замка.', 'reps'],
    ['hack-squat', 'Hack Squat', 'Квадрицепс', 'legs', 180, 'Спина прижата, опускайтесь глубоко, колени по линии носков.', 'reps'],
    ['hip-adduction', 'Сведение ног в тренажёре', 'Приводящие', 'legs', 120, 'Сводите медленно, пауза в сведённом положении.', 'reps'],
    ['db-romanian-deadlift', 'Румынская тяга с гантелями', 'Бицепс бедра и ягодицы', 'hamstrings', 180, 'Таз назад, колени чуть согнуты, гантели скользят по бёдрам.', 'reps'],
    ['barbell-curl', 'Сгибание рук с грифом стоя', 'Бицепс', 'arms', 120, 'Локти прижаты, без раскачки корпусом.', 'reps'],
    ['db-hammer-curl', 'Молотки с гантелями стоя', 'Бицепс и предплечья', 'arms', 120, 'Нейтральный хват, локти неподвижны.', 'reps'],
    ['incline-db-curl', 'Сгибание гантелей на наклонной скамье', 'Бицепс', 'arms', 120, 'Руки свисают за корпус, полное разгибание внизу.', 'reps'],
    ['db-spider-curl', 'Spider Curl с гантелями', 'Бицепс', 'arms', 120, 'Грудью на наклонной скамье, руки вертикально, пауза наверху.', 'reps'],
    ['straight-bar-pushdown', 'Разгибание рук вниз с прямой рукоятью', 'Трицепс', 'arms', 120, 'Локти у корпуса, полное разгибание внизу.', 'reps'],
    ['ez-skull-crusher', 'Французский жим с EZ-грифом', 'Трицепс', 'arms', 120, 'Двигаются только предплечья, локти смотрят вверх.', 'reps'],
    ['smith-close-press', 'Узкий жим в Смите на трицепс', 'Трицепс', 'arms', 180, 'Хват на ширине плеч, локти вдоль корпуса.', 'reps'],
    ['one-arm-d-pushdown', 'Одноручное разгибание вниз с D-рукоятью', 'Трицепс', 'arms', 120, 'Локоть прижат, полное разгибание внизу.', 'reps', 'arm'],
    ['machine-crunch', 'Машинные скручивания', 'Пресс', 'core', 90, 'Скручивайтесь грудью к тазу, без рывка.', 'reps'],
    ['hanging-knee-raise', 'Подъём коленей в висе', 'Пресс', 'core', 90, 'Без раскачки, подкручивайте таз вверху.', 'reps'],
    ['weighted-side-plank', 'Боковая планка с весом', 'Косые мышцы пресса', 'core', 60, 'Таз высоко, корпус одной линией. Вес — на бедре.', 'seconds', 'side'],
    ['ab-wheel', 'Ролик для пресса', 'Пресс', 'core', 90, 'Поясница не прогибается, катитесь настолько, насколько держите корпус.', 'reps'],
  ];

  // [упражнение, подходы, повторы от, повторы до, отдых от (с), отдых до (с)]
  const TEMPLATES = {
    // Широчайшие + средняя дельта + квадрицепс
    A: [
      ['one-arm-lat-pulldown', 3, 6, 8, 180, 180],
      ['smith-incline-press', 3, 6, 8, 180, 180],
      ['leg-extension', 3, 10, 12, 120, 180],
      ['cable-lateral-raise', 3, 10, 15, 120, 120],
      ['barbell-curl', 2, 8, 10, 120, 120],
      ['straight-bar-pushdown', 2, 8, 12, 120, 120],
      ['machine-crunch', 3, 10, 15, 60, 90],
    ],
    // Тяжёлый день спины, без груди
    B: [
      ['wide-neutral-pulldown', 3, 6, 8, 180, 180],
      ['one-arm-cable-row-hip', 3, 8, 10, 180, 180],
      ['db-romanian-deadlift', 3, 8, 10, 180, 180],
      ['smith-shrug', 3, 8, 12, 120, 120],
      ['db-hammer-curl', 2, 8, 10, 120, 120],
      ['ez-skull-crusher', 2, 8, 10, 120, 120],
      ['hanging-knee-raise', 3, 8, 12, 60, 90],
    ],
    // Визуальная ширина
    C: [
      ['incline-db-press', 3, 6, 8, 180, 180],
      ['one-arm-db-row', 3, 8, 10, 180, 180],
      ['leg-press', 3, 10, 12, 180, 180],
      ['db-lateral-raise', 3, 10, 15, 120, 120],
      ['incline-db-curl', 2, 8, 10, 120, 120],
      ['smith-close-press', 2, 6, 8, 120, 180],
      ['weighted-side-plank', 3, 30, 45, 60, 60],
    ],
    D: [
      ['cable-pullover', 3, 8, 12, 120, 180],
      ['db-squeeze-press', 3, 8, 10, 180, 180],
      ['hip-adduction', 3, 10, 15, 120, 120],
      ['reverse-pec-deck', 3, 10, 15, 120, 120],
      ['db-spider-curl', 2, 8, 12, 120, 120],
      ['one-arm-d-pushdown', 2, 10, 12, 120, 120],
      ['ab-wheel', 3, 6, 12, 60, 90],
    ],
    // Второй чистый день спины
    E: [
      ['one-arm-lat-pulldown', 3, 8, 10, 180, 180],
      ['one-arm-cable-row-hip', 3, 8, 10, 180, 180],
      ['hack-squat', 3, 8, 10, 180, 180],
      ['wide-upright-row', 3, 8, 12, 120, 120],
      ['barbell-curl', 2, 8, 10, 120, 120],
      ['ez-skull-crusher', 2, 8, 10, 120, 120],
      ['hanging-knee-raise', 3, 8, 12, 60, 90],
    ],
    F: [
      ['cable-crossover-mid', 3, 8, 12, 120, 180],
      ['one-arm-db-row', 3, 8, 10, 180, 180],
      ['leg-extension', 3, 10, 12, 120, 180],
      ['db-shrug', 3, 10, 12, 120, 120],
      ['db-hammer-curl', 2, 8, 10, 120, 120],
      ['straight-bar-pushdown', 2, 8, 12, 120, 120],
      ['machine-crunch', 3, 10, 15, 60, 90],
    ],
  };
  // Разгрузочная неделя: упражнения А и Б, по 2 рабочих подхода
  TEMPLATES.LA = TEMPLATES.A.map(([id, , min, max, rmin, rmax]) => [id, 2, min, max, rmin, rmax]);
  TEMPLATES.LB = TEMPLATES.B.map(([id, , min, max, rmin, rmax]) => [id, 2, min, max, rmin, rmax]);

  function buildSeed(now) {
    const ts = now.toISOString();
    const meta = { createdAt: ts, updatedAt: ts, deletedAt: null };

    const exercises = EXERCISES.map(([id, name, muscleGroup, imageKey, rest, instruction, type, perSide]) => ({
      id: `ex-${id}`,
      name,
      muscleGroup,
      instruction,
      defaultRestSeconds: rest,
      resultType: type || 'reps',
      perSide: perSide || null,
      image: { kind: 'builtin', key: imageKey },
      ...meta,
    }));
    const known = new Set(exercises.map((e) => e.id));

    const templates = Object.keys(TEMPLATES).map((code) => ({
      id: `tpl-${code}`,
      code,
      name: GN.templateTitle(code),
      items: TEMPLATES[code].map(([exId, sets, repMin, repMax, restMin, restMax], i) => {
        const exerciseId = `ex-${exId}`;
        if (!known.has(exerciseId)) throw new Error(`Seed: нет упражнения ${exerciseId}`);
        return {
          id: `tpl-${code}-${i + 1}`,
          exerciseId,
          sets,
          warmupSets: i < WARMUP_ITEMS ? WARMUP_SETS : 0,
          repMin,
          repMax,
          restSeconds: restMax, // таймер — по верхней границе
          restMinSeconds: restMin < restMax ? restMin : null,
        };
      }),
      ...meta,
    }));

    const scheme = {
      id: DEFAULT_SCHEME_ID,
      name: '8 недель: А/Б/В — Г/Д/Е, разгрузка',
      lengthDays: GN.CYCLE_LENGTH_DAYS,
      weeks: GN.CYCLE_WEEKS,
      deloadWeek: GN.DELOAD_WEEK,
      slots: GN.buildDefaultSlots(),
      ...meta,
    };

    return { exercises, templates, scheme };
  }

  /** Стартовые рабочие веса для демо; null — без отягощения. */
  const BASE_WEIGHT = {
    'ex-one-arm-lat-pulldown': 20, 'ex-wide-neutral-pulldown': 40, 'ex-one-arm-cable-row-hip': 17.5,
    'ex-one-arm-db-row': 16, 'ex-cable-pullover': 20, 'ex-wide-upright-row': 25, 'ex-smith-shrug': 40,
    'ex-db-shrug': 16, 'ex-smith-incline-press': 30, 'ex-incline-db-press': 12, 'ex-db-squeeze-press': 10,
    'ex-cable-crossover-mid': 7.5, 'ex-cable-lateral-raise': 5, 'ex-db-lateral-raise': 5, 'ex-reverse-pec-deck': 20,
    'ex-leg-extension': 35, 'ex-leg-press': 100, 'ex-hack-squat': 40, 'ex-hip-adduction': 40,
    'ex-db-romanian-deadlift': 16, 'ex-barbell-curl': 15, 'ex-db-hammer-curl': 8, 'ex-incline-db-curl': 6,
    'ex-db-spider-curl': 6, 'ex-straight-bar-pushdown': 15, 'ex-ez-skull-crusher': 15, 'ex-smith-close-press': 25,
    'ex-one-arm-d-pushdown': 7.5, 'ex-machine-crunch': 25, 'ex-hanging-knee-raise': null,
    'ex-weighted-side-plank': 5, 'ex-ab-wheel': null,
  };

  const round25 = (n) => Math.round(n / 2.5) * 2.5;

  /**
   * Демо: цикл, начатый в понедельник ~2,5 недели назад, и тренировки за все прошедшие дни
   * расписания — с разминкой и плавной прогрессией весов.
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
        ex.sets.forEach((set, si) => {
          const k = GN.kindIndex(ex, set);
          let w = weight;
          let value;
          if (set.warmup) {
            w = weight == null ? null : Math.max(0, round25(weight * (k === 0 ? 0.5 : 0.7)));
            value = resultType === 'seconds' ? 20 : k === 0 ? 12 : 8;
          } else {
            value =
              resultType === 'seconds'
                ? Math.min(repMax, repMin + 5 * occ)
                : Math.max(repMin, Math.min(repMax, repMin + 1 + (occ % 3) - k));
          }
          s = GN.completeSet(s, ei, si, { weight: w, value }, new Date(started.getTime() + minute * 60000));
          minute += 2;
        });
      });
      sessions.push(GN.finishSession(s, new Date(started.getTime() + (minute + 2) * 60000)));
    }
    return { cycle, sessions };
  }

  Object.assign(GN, { SEED_VERSION, DEFAULT_SCHEME_ID, buildSeed, buildDemo });
})((globalThis.GN = globalThis.GN || {}));
