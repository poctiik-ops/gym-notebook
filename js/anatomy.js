/*
 * Эскизная анатомическая схема: фигура спереди и сзади, работающие мышцы подсвечены.
 * Основные мышцы — насыщенный акцент, вспомогательные — светлый.
 * Все координаты — для левой половины фигуры; правая получается зеркально.
 */
(function (GN) {
  'use strict';

  // ── Плавный замкнутый контур через точки (Catmull-Rom → кривые Безье) ──
  function smooth(points, closed = true) {
    const p = points;
    const n = p.length;
    const at = (i) => p[(i + n) % n];
    let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = closed ? at(i - 1) : p[Math.max(0, i - 1)];
      const p1 = at(i);
      const p2 = at(i + 1);
      const p3 = closed ? at(i + 2) : p[Math.min(n - 1, i + 2)];
      const t = 0.18;
      const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
      const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return closed ? d + 'Z' : d;
  }

  const mirror = (pts) => pts.map(([x, y]) => [-x, y]);

  // Силуэт: левая половина сверху вниз, правая — зеркально снизу вверх
  const HALF = [
    [-6, 29], [-16, 33], [-27, 36], [-34, 44], [-37, 58], [-39, 80], [-41, 96], [-43, 110], [-42, 119], [-37, 121],
    [-35, 112], [-32, 96], [-29, 80], [-25, 62], [-21, 70], [-20, 92], [-23, 106], [-23, 124], [-21, 142], [-18, 150],
    [-18, 160], [-14, 171], [-5, 172], [-6, 160], [-5, 146], [-3, 124], [0, 117],
  ];
  const SILHOUETTE = [...HALF, ...mirror(HALF.slice(0, -1)).reverse()];

  // ── Мышцы (левая половина) ──
  const FRONT = {
    upperChest: [[-2, 39], [-12, 37], [-22, 39], [-26, 46], [-14, 48], [-2, 48]],
    chest: [[-2, 49], [-14, 49], [-26, 48], [-23, 58], [-13, 62], [-2, 60]],
    frontDelts: [[-23, 37], [-29, 39], [-32, 47], [-30, 53], [-26, 49], [-24, 43]],
    midDelts: [[-28, 36], [-34, 41], [-37, 50], [-35, 57], [-32, 50], [-31, 42]],
    biceps: [[-27, 57], [-33, 57], [-37, 66], [-37, 77], [-33, 83], [-29, 76], [-27, 66]],
    forearms: [[-31, 86], [-38, 85], [-41, 98], [-41, 110], [-37, 113], [-34, 104], [-32, 95]],
    obliques: [[-12, 64], [-19, 62], [-21, 76], [-21, 92], [-17, 100], [-12, 96]],
    quads: [[-7, 118], [-14, 114], [-21, 116], [-23, 128], [-20, 142], [-13, 146], [-8, 136]],
    adductors: [[-1, 119], [-6, 119], [-8, 130], [-6, 138], [-2, 130]],
    calves: [[-8, 152], [-16, 152], [-17, 162], [-12, 168], [-8, 162]],
  };
  // Пресс — сетка «кубиков»
  const ABS = [
    [[-1, 64], [-9, 64], [-10, 74], [-1, 74]],
    [[-1, 76], [-10, 76], [-10, 86], [-1, 86]],
    [[-1, 88], [-10, 88], [-9, 98], [-1, 100]],
  ];

  const BACK = {
    traps: [[0, 27], [-7, 29], [-18, 34], [-24, 38], [-14, 45], [-7, 54], [-2, 64], [0, 66]],
    rearDelts: [[-24, 39], [-31, 41], [-35, 49], [-33, 55], [-28, 51], [-25, 45]],
    midDelts: [[-28, 36], [-34, 41], [-37, 50], [-35, 57], [-32, 50], [-31, 42]],
    lats: [[-5, 66], [-13, 52], [-23, 50], [-25, 60], [-22, 76], [-14, 92], [-6, 86]],
    lowerBack: [[-1, 88], [-8, 88], [-12, 100], [-6, 104], [-1, 104]],
    triceps: [[-27, 56], [-34, 56], [-38, 66], [-38, 78], [-34, 84], [-30, 78], [-27, 66]],
    forearms: [[-31, 86], [-38, 85], [-41, 98], [-41, 110], [-37, 113], [-34, 104], [-32, 95]],
    glutes: [[-1, 106], [-10, 103], [-20, 106], [-23, 116], [-19, 125], [-9, 126], [-2, 120]],
    hamstrings: [[-4, 128], [-12, 127], [-21, 128], [-21, 140], [-17, 147], [-9, 147], [-5, 138]],
    calves: [[-6, 150], [-12, 149], [-18, 152], [-19, 161], [-14, 168], [-8, 163]],
  };

  /** Человеческие названия — для подписи и доступности */
  const NAMES = {
    upperChest: 'верх груди', chest: 'грудь', frontDelts: 'передняя дельта', midDelts: 'средняя дельта',
    rearDelts: 'задняя дельта', biceps: 'бицепс', triceps: 'трицепс', forearms: 'предплечья', abs: 'пресс',
    obliques: 'косые', quads: 'квадрицепс', adductors: 'приводящие', hamstrings: 'бицепс бедра', glutes: 'ягодицы',
    calves: 'икры', traps: 'трапеция', lats: 'широчайшие', lowerBack: 'поясница',
  };

  const LEG_MUSCLES = new Set(['quads', 'adductors', 'hamstrings', 'glutes', 'calves']);
  const BACK_MUSCLES = new Set(['traps', 'rearDelts', 'lats', 'lowerBack', 'triceps', 'glutes', 'hamstrings']);

  function region(name, pts, state, extraClass = '') {
    const cls = `am a${state}${extraClass ? ' ' + extraClass : ''}`;
    return `<path class="${cls}" d="${smooth(pts)}"/><path class="${cls}" d="${smooth(mirror(pts))}"/>`;
  }

  function figure(view, primary, secondary, cx, top, scale) {
    const set = view === 'front' ? FRONT : BACK;
    const state = (name) => (primary.has(name) ? 'p' : secondary.has(name) ? 's' : 'i');
    let muscles = '';
    for (const [name, pts] of Object.entries(set)) muscles += region(name, pts, state(name));
    if (view === 'front') {
      const st = state('abs');
      muscles += ABS.map((pts) => region('abs', pts, st)).join('');
    }
    // Разметка: позвоночник сзади, белая линия спереди
    const line =
      view === 'back'
        ? '<path class="aseam" d="M0 30 L0 104"/>'
        : '<path class="aseam" d="M0 40 L0 61"/>';
    return `<g transform="translate(${cx} ${top}) scale(${scale})">
      <ellipse class="af" cx="0" cy="174" rx="26" ry="3.5"/>
      <path class="ab" d="${smooth(SILHOUETTE)}"/>
      <circle class="ab" cx="0" cy="15" r="11"/>
      ${muscles}${line}
    </g>`;
  }

  let seq = 0;

  /**
   * SVG-схема для упражнения.
   * image = { kind: 'muscles', primary: [...], secondary: [...], equipment: 'Блок' }
   */
  function muscleMap(image, { compact = false } = {}) {
    const primary = new Set(image.primary || []);
    const secondary = new Set(image.secondary || []);
    const id = `an${++seq}`;
    const label = `Работают: ${[...primary].map((m) => NAMES[m]).join(', ')}${
      secondary.size ? `; помогают: ${[...secondary].map((m) => NAMES[m]).join(', ')}` : ''
    }`;
    const defs = `<defs>
      <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--an-primary-1,#3395ff)"/><stop offset="1" style="stop-color:var(--an-primary-2,#0059c7)"/></linearGradient>
    </defs>`;
    const style = `<style>
      #${id} .ab{fill:var(--an-body,#fff);stroke:var(--an-body-stroke,#c7c7cc);stroke-width:1.1;stroke-linejoin:round}
      #${id} .af{fill:var(--line,rgba(0,0,0,.08))}
      #${id} .am{stroke-width:.8;stroke-linejoin:round}
      #${id} .am.ai{fill:var(--an-idle,#e9e9ee);stroke:var(--an-idle-stroke,#d1d1d6)}
      #${id} .am.as{fill:var(--an-secondary,#9ecbff);stroke:var(--an-secondary-stroke,#5aa5ff)}
      #${id} .am.ap{fill:url(#${id}p);stroke:var(--an-primary-stroke,#00419a)}
      #${id} .aseam{stroke:var(--an-idle-stroke,#d1d1d6);stroke-width:.8;fill:none}
      #${id} .acap{font:600 9px -apple-system,'Segoe UI',system-ui,sans-serif;fill:var(--an-cap,#8e8e93);letter-spacing:.06em}
    </style>`;

    if (compact) {
      // Один ракурс — тот, где больше основных мышц
      const backScore = [...primary].filter((m) => BACK_MUSCLES.has(m)).length;
      const view = backScore > primary.size / 2 ? 'back' : 'front';
      // Крупный план: ноги или корпус — где работают основные мышцы
      const legs = [...primary].every((m) => LEG_MUSCLES.has(m));
      const box = legs ? '-40 100 80 80' : '-48 24 96 96';
      return `<svg id="${id}" class="anatomy" viewBox="${box}" role="img" aria-label="${label}">${defs}${style}${figure(view, primary, secondary, 0, 0, 1)}</svg>`;
    }

    return `<svg id="${id}" class="anatomy" viewBox="0 0 320 180" role="img" aria-label="${label}">${defs}${style}
      ${figure('front', primary, secondary, 108, 2, 0.95)}
      ${figure('back', primary, secondary, 212, 2, 0.95)}
      <text class="acap" x="108" y="178" text-anchor="middle">СПЕРЕДИ</text>
      <text class="acap" x="212" y="178" text-anchor="middle">СЗАДИ</text>
    </svg>`;
  }

  GN.anatomy = { muscleMap, NAMES };
})((globalThis.GN = globalThis.GN || {}));
