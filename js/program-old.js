/*
 * Текущий (старый) цикл: 28 сентября — 1 ноября 2026, 5 недель.
 * Недели 1–4: пн/ср/пт по кругу Д1 · Д3 · Д5, затем Д8 · Д10 · Д12.
 * Неделя 5: лёгкие Д.А (вт) и Д.Б (чт). Сразу после него, 2 ноября, стартует новый цикл.
 *
 * Названия Д1…Д12 — номера дней из бумажного плана. Повторы тех же тренировок
 * (Д15, Д17…) в приложении считаются вторым выполнением той же тренировки.
 */
(function (GN) {
  'use strict';

  const OLD_SCHEME_ID = 'scheme-old-5w';
  const OLD_CYCLE = { id: 'cycle-2026-09-28', startDate: '2026-09-28', schemeId: OLD_SCHEME_ID };
  const NEW_CYCLE = { id: 'cycle-2026-11-02', startDate: '2026-11-02', schemeId: GN.DEFAULT_SCHEME_ID || 'scheme-default' };

  // [id, название, группа, отдых по умолчанию, подсказка, тип, «каждой» (arm|leg|side), [основные], [вспомогательные], оборудование]
  const EXERCISES = [
    ['parallel-pulldown', 'Тяга верхнего блока параллельным хватом', 'Широчайшие', 180, 'Узкая параллельная рукоять, тяните к верху груди, локти вниз вдоль корпуса.', 'reps', null, ['lats'], ['biceps'], 'Блок'],
    ['hammer-incline-press', 'Жим Хаммер верх груди', 'Грудь (верх)', 180, 'Лопатки сведены, рукояти к верху груди, без удара в верхней точке.', 'reps', null, ['upperChest'], ['frontDelts', 'triceps'], 'Хаммер'],
    ['smith-squat', 'Приседания в Смите', 'Квадрицепс и ягодицы', 180, 'Стопы чуть впереди грифа, садитесь до параллели, колени по линии носков.', 'reps', null, ['quads', 'glutes'], ['adductors'], 'Смит'],
    ['machine-lateral-raise', 'Lateral Raise Machine', 'Средняя дельта', 120, 'Ведите локтями в стороны до уровня плеч, медленно вниз.', 'reps', null, ['midDelts'], ['traps'], 'Тренажёр'],
    ['db-supination-curl', 'Подъём гантелей с супинацией', 'Бицепс', 120, 'Разворачивайте кисть мизинцем вверх в подъёме, локти прижаты.', 'reps', null, ['biceps'], ['forearms'], 'Гантели'],
    ['hanging-leg-raise', 'Подъём ног в висе', 'Пресс', 60, 'Без раскачки, подкручивайте таз вверху.', 'reps', null, ['abs'], ['obliques', 'forearms'], 'Турник'],

    ['db-bench-press', 'Жим гантелей лёжа', 'Грудь', 180, 'Лопатки сведены, гантели до уровня груди, без удара вверху.', 'reps', null, ['chest'], ['frontDelts', 'triceps'], 'Гантели'],
    ['close-grip-cable-row', 'Горизонтальная тяга узким хватом', 'Широчайшие', 180, 'Грудь вперёд, тяните к поясу, сводите лопатки в конце.', 'reps', null, ['lats'], ['rearDelts', 'biceps'], 'Блок'],
    ['single-leg-seated-curl', 'Сгибание ног сидя одной ногой', 'Бицепс бедра', 180, 'Таз прижат, сгибайте медленно, пауза внизу.', 'reps', 'leg', ['hamstrings'], [], 'Тренажёр'],
    ['prone-db-row-wide', 'Тяга гантелей лёжа локтями в стороны', 'Задняя дельта', 120, 'Грудью на скамье, тяните локти в стороны на уровне плеч.', 'reps', null, ['rearDelts'], ['traps', 'midDelts'], 'Гантели'],
    ['reverse-grip-pushdown', 'Разгибание обратным хватом', 'Трицепс', 120, 'Хват снизу, локти прижаты, полное разгибание.', 'reps', null, ['triceps'], ['forearms'], 'Блок'],
    ['seated-hammer-curl', 'Молотки сидя', 'Бицепс и предплечья', 120, 'Нейтральный хват, спина прижата к спинке.', 'reps', null, ['biceps', 'forearms'], [], 'Гантели'],
    ['woodchopper-high', 'Woodchopper сверху вниз', 'Косые мышцы пресса', 60, 'Разворот корпусом, руки почти прямые, тяните сверху вниз по диагонали.', 'reps', 'side', ['obliques'], ['abs'], 'Блок'],

    ['lever-pulldown', 'Рычажная верхняя тяга', 'Широчайшие', 180, 'Тяните локтями вниз, вверху — полное растяжение.', 'reps', null, ['lats'], ['biceps'], 'Рычажный'],
    ['low-to-high-crossover', 'Кроссовер снизу вверх', 'Грудь (верх)', 180, 'Сводите руки снизу вверх к уровню подбородка.', 'reps', null, ['upperChest'], ['frontDelts'], 'Кроссовер'],
    ['cable-kickback', 'Отведение ноги назад в кроссовере', 'Ягодицы', 180, 'Корпус неподвижен, ведите ногу назад за счёт ягодицы.', 'reps', 'leg', ['glutes'], ['hamstrings'], 'Кроссовер'],
    ['hammer-shoulder-press', 'Жим в Хаммере на плечи', 'Передняя и средняя дельта', 120, 'Спина прижата, жмите вверх без замка в локтях.', 'reps', null, ['frontDelts', 'midDelts'], ['triceps'], 'Хаммер'],
    ['concentration-curl', 'Концентрированный подъём', 'Бицепс', 120, 'Локоть упирается в бедро, пауза наверху.', 'reps', 'arm', ['biceps'], [], 'Гантель'],
    ['ez-bar-pushdown', 'Разгибание EZ-рукоятью вниз', 'Трицепс', 120, 'Локти у корпуса, полное разгибание внизу.', 'reps', null, ['triceps'], [], 'Блок'],
    ['hollow-body-hold', 'Hollow Body Hold', 'Пресс', 60, 'Поясница прижата к полу, руки и ноги вытянуты. Результат — в секундах.', 'seconds', null, ['abs'], ['obliques'], 'Свой вес'],

    ['incline-press', 'Жим на наклонной', 'Грудь (верх)', 180, 'Скамья 30°, гриф к верху груди, лопатки сведены.', 'reps', null, ['upperChest'], ['frontDelts', 'triceps'], 'Штанга'],
    ['parallel-pull-up', 'Подтягивания параллельным хватом', 'Широчайшие', 180, 'Полная амплитуда, грудь к рукояти. Вес — дополнительное отягощение.', 'reps', null, ['lats'], ['biceps'], 'Турник'],
    ['step-up', 'Step-Up', 'Квадрицепс и ягодицы', 180, 'Ставьте всю стопу на тумбу, поднимайтесь за счёт передней ноги.', 'reps', 'leg', ['quads', 'glutes'], ['hamstrings'], 'Гантели'],
    ['seated-db-lateral-raise', 'Подъём гантелей через стороны сидя', 'Средняя дельта', 120, 'Сидя, без раскачки, локоть чуть выше кисти.', 'reps', null, ['midDelts'], ['traps'], 'Гантели'],
    ['jm-press', 'JM Press', 'Трицепс', 120, 'Гибрид жима узким хватом и французского жима, локти вперёд.', 'reps', null, ['triceps'], ['chest'], 'Штанга'],
    ['side-plank', 'Боковая планка', 'Косые мышцы пресса', 60, 'Таз высоко, корпус одной линией. Результат — в секундах.', 'seconds', 'side', ['obliques'], ['abs'], 'Свой вес'],

    ['wide-cable-row', 'Горизонтальная тяга широким хватом', 'Спина', 180, 'Локти в стороны, тяните к нижней части груди.', 'reps', null, ['lats', 'rearDelts'], ['traps', 'biceps'], 'Блок'],
    ['pec-deck', 'Pec Deck', 'Грудь', 180, 'Локти слегка согнуты, сводите руки перед грудью, пауза.', 'reps', null, ['chest'], ['frontDelts'], 'Тренажёр'],
    ['lying-leg-curl', 'Сгибание ног лёжа', 'Бицепс бедра', 180, 'Таз прижат к скамье, без рывка.', 'reps', null, ['hamstrings'], ['calves'], 'Тренажёр'],
    ['face-pull', 'Face Pull', 'Задняя дельта', 120, 'Тяните канат к лицу, разводя концы в стороны.', 'reps', null, ['rearDelts'], ['traps'], 'Блок'],
    ['cross-body-extension', 'Одноручное разгибание через корпус', 'Трицепс', 120, 'Рукоять тянется через корпус, локоть неподвижен.', 'reps', 'arm', ['triceps'], [], 'Блок'],
    ['cable-rope-curl', 'Сгибание рук с канатом в нижнем блоке', 'Бицепс', 120, 'Локти прижаты, разводите концы каната вверху.', 'reps', null, ['biceps'], ['forearms'], 'Блок'],
    ['reverse-crunch', 'Обратные скручивания', 'Пресс', 60, 'Подкручивайте таз к груди, без рывка ногами.', 'reps', null, ['abs'], [], 'Свой вес'],

    ['lever-one-arm-row', 'Рычажная горизонтальная тяга одной рукой', 'Широчайшие', 180, 'Тяните локоть назад к поясу, корпус неподвижен.', 'reps', 'arm', ['lats'], ['rearDelts', 'biceps'], 'Рычажный'],
    ['chest-dips', 'Брусья на грудь', 'Грудь', 180, 'Наклон корпуса вперёд, локти чуть в стороны. Вес — дополнительный.', 'reps', null, ['chest'], ['triceps', 'frontDelts'], 'Брусья'],
    ['glute-bridge', 'Ягодичный мост', 'Ягодицы', 180, 'Подбородок к груди, пауза вверху, рёбра вниз.', 'reps', null, ['glutes'], ['hamstrings'], 'Штанга'],
    ['cable-upright-row', 'Протяжка с нижнего блока канатом', 'Трапеция и дельты', 120, 'Тяните канат к подбородку, локти выше кистей.', 'reps', null, ['midDelts', 'traps'], [], 'Блок'],
    ['bayesian-curl', 'Bayesian Curl', 'Бицепс', 120, 'Спиной к блоку, рука позади корпуса — растяжение бицепса внизу.', 'reps', 'arm', ['biceps'], [], 'Блок'],
    ['triceps-machine', 'Трицепс-машина', 'Трицепс', 120, 'Локти неподвижны, полное разгибание.', 'reps', null, ['triceps'], [], 'Тренажёр'],
    ['stomach-vacuum', 'Вакуум', 'Пресс', 60, 'Выдох, втяните живот к позвоночнику и удерживайте. Результат — в секундах.', 'seconds', null, ['abs'], [], 'Свой вес'],

    ['rope-pushdown', 'Разгибание канатом вниз', 'Трицепс', 60, 'Локти у корпуса, разводите концы каната внизу.', 'reps', null, ['triceps'], [], 'Блок'],
    ['crunch', 'Скручивания', 'Пресс', 60, 'Поясница прижата, скручивайтесь грудью к тазу.', 'reps', null, ['abs'], [], 'Свой вес'],
    ['seated-leg-curl', 'Сгибания ног сидя', 'Бицепс бедра', 60, 'Таз прижат, медленно вверх.', 'reps', null, ['hamstrings'], [], 'Тренажёр'],
    ['plank', 'Планка', 'Пресс', 60, 'Тело одной линией, таз не провисает. Результат — в секундах.', 'seconds', null, ['abs'], ['obliques'], 'Свой вес'],
  ];

  // [упражнение, подходы, повторы от, до, отдых (с)]; разминка — 2 подхода у упражнений с 3 рабочими
  const TEMPLATES = {
    O1: [
      ['parallel-pulldown', 3, 6, 8, 180],
      ['hammer-incline-press', 3, 6, 8, 180],
      ['smith-squat', 4, 10, 10, 180],
      ['machine-lateral-raise', 3, 8, 10, 120],
      ['smith-close-press', 2, 7, 8, 120],
      ['db-supination-curl', 2, 7, 8, 120],
      ['hanging-leg-raise', 4, 10, 10, 60],
    ],
    O2: [
      ['db-bench-press', 3, 6, 8, 180],
      ['close-grip-cable-row', 3, 6, 8, 180],
      ['single-leg-seated-curl', 3, 6, 8, 180],
      ['prone-db-row-wide', 3, 8, 10, 120],
      ['reverse-grip-pushdown', 2, 7, 8, 120],
      ['seated-hammer-curl', 2, 7, 8, 120],
      ['woodchopper-high', 4, 10, 10, 60],
    ],
    O3: [
      ['lever-pulldown', 3, 6, 8, 180],
      ['low-to-high-crossover', 3, 6, 8, 180],
      ['cable-kickback', 3, 6, 8, 180],
      ['hammer-shoulder-press', 3, 8, 10, 120],
      ['concentration-curl', 2, 7, 8, 120],
      ['ez-bar-pushdown', 2, 7, 8, 120],
      ['hollow-body-hold', 4, 20, 40, 60],
    ],
    O4: [
      ['incline-press', 3, 6, 8, 180],
      ['parallel-pull-up', 3, 6, 8, 180],
      ['step-up', 3, 6, 8, 180],
      ['seated-db-lateral-raise', 3, 8, 10, 120],
      ['incline-db-curl', 2, 7, 8, 120],
      ['jm-press', 2, 7, 8, 120],
      ['side-plank', 4, 40, 60, 60],
    ],
    O5: [
      ['wide-cable-row', 3, 6, 8, 180],
      ['pec-deck', 3, 6, 8, 180],
      ['lying-leg-curl', 3, 6, 8, 180],
      ['face-pull', 3, 8, 10, 120],
      ['cross-body-extension', 2, 7, 8, 120],
      ['cable-rope-curl', 2, 7, 8, 120],
      ['reverse-crunch', 4, 10, 10, 60],
    ],
    O6: [
      ['lever-one-arm-row', 3, 6, 8, 180],
      ['chest-dips', 3, 6, 8, 180],
      ['glute-bridge', 3, 6, 8, 180],
      ['cable-upright-row', 3, 8, 10, 120],
      ['bayesian-curl', 2, 7, 8, 120],
      ['triceps-machine', 2, 7, 8, 120],
      ['stomach-vacuum', 4, 15, 30, 60],
    ],
    OLA: ['parallel-pulldown', 'hammer-incline-press', 'leg-extension', 'machine-lateral-raise', 'rope-pushdown', 'db-supination-curl', 'crunch'].map((id) => [id, 4, 15, 15, 60]),
    OLB: ['lever-one-arm-row', 'pec-deck', 'seated-leg-curl', 'face-pull', 'triceps-machine', 'cable-rope-curl', 'plank'].map((id) => [id, 4, 15, 15, 60]),
  };

  function slots() {
    const s = [];
    for (let week = 0; week < 4; week++) {
      const codes = week % 2 === 0 ? ['O1', 'O2', 'O3'] : ['O4', 'O5', 'O6'];
      [0, 2, 4].forEach((off, i) => s.push({ dayOffset: week * 7 + off, templateCode: codes[i] }));
    }
    s.push({ dayOffset: 4 * 7 + 1, templateCode: 'OLA' });
    s.push({ dayOffset: 4 * 7 + 3, templateCode: 'OLB' });
    return s;
  }

  /** Дополняет seed старой программой: упражнения, шаблоны, схема 5 недель и оба личных цикла. */
  function extendSeed(seed, now) {
    const ts = now.toISOString();
    const meta = { createdAt: ts, updatedAt: ts, deletedAt: null };
    const known = new Set(seed.exercises.map((e) => e.id));

    EXERCISES.forEach(([id, name, muscleGroup, rest, instruction, type, perSide, primary, secondary, equipment]) => {
      const exId = `ex-${id}`;
      if (known.has(exId)) return;
      known.add(exId);
      seed.exercises.push({
        id: exId,
        name,
        muscleGroup,
        instruction,
        defaultRestSeconds: rest,
        resultType: type,
        perSide,
        image: { kind: 'muscles', primary, secondary, equipment },
        ...meta,
      });
    });

    Object.entries(TEMPLATES).forEach(([code, items]) => {
      seed.templates.push({
        id: `tpl-${code}`,
        code,
        name: GN.templateTitle(code),
        items: items.map(([exId, sets, repMin, repMax, rest], i) => {
          const exerciseId = `ex-${exId}`;
          if (!known.has(exerciseId)) throw new Error(`Seed: нет упражнения ${exerciseId}`);
          return {
            id: `tpl-${code}-${i + 1}`,
            exerciseId,
            sets,
            warmupSets: sets === 3 ? 2 : 0,
            repMin,
            repMax,
            restSeconds: rest,
            restMinSeconds: null,
            altExerciseId: null,
          };
        }),
        ...meta,
      });
    });

    seed.schemes.push({
      id: OLD_SCHEME_ID,
      name: '5 недель: Д1/Д3/Д5 — Д8/Д10/Д12, лёгкая неделя',
      lengthDays: 35,
      weeks: 5,
      deloadWeek: 5,
      slots: slots(),
      ...meta,
    });

    seed.cycles = [
      { ...OLD_CYCLE, status: 'active', ...meta },
      { ...NEW_CYCLE, status: 'active', ...meta },
    ];
    return seed;
  }

  Object.assign(GN, { OLD_SCHEME_ID, PERSONAL_CYCLES: [OLD_CYCLE, NEW_CYCLE], extendSeedWithOldProgram: extendSeed });
})((globalThis.GN = globalThis.GN || {}));
