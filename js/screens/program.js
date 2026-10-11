/* Экраны «Программа», состав тренировки и режим редактирования. */
(function (GN) {
  'use strict';
  const { esc, icon, button, iconButton, screenHeader, exerciseImage, stepper } = GN.ui;

  function calendar(startDate, scheme, todayIso, sessions) {
    const weeks = GN.buildCycleCalendar(startDate, scheme);
    const done = new Set(sessions.filter((s) => s.status === 'completed').map((s) => `${s.plannedDate}|${s.templateCode}`));
    const head = weeks[0].days.map((d) => `<span class="cal-dow" role="columnheader">${esc(GN.formatWeekdayShort(d.date))}</span>`).join('');
    const rows = weeks
      .map((w) => {
        const cells = w.days
          .map((d) => {
            const isToday = d.date === todayIso;
            const dayNum = GN.fromISODate(d.date).getDate();
            if (!d.workout) {
              return `<span class="cal-cell${isToday ? ' today' : ''}" role="cell" aria-label="${esc(GN.formatWeekdayDate(d.date))}, отдых"><span class="d">${dayNum}</span></span>`;
            }
            const code = d.workout.templateCode;
            const isDone = done.has(`${d.date}|${code}`);
            const isPast = d.date < todayIso;
            const status = isDone ? 'выполнена' : isPast ? 'пропущена' : isToday ? 'сегодня' : 'запланирована';
            const cls = ['cal-cell', 'workout', isToday && 'today', isDone && 'done', isPast && !isDone && 'missed', GN.isLightTemplate(code) && 'light']
              .filter(Boolean)
              .join(' ');
            return `<a href="#/program/${code}" role="cell" class="${cls}" aria-label="${esc(GN.formatWeekdayDate(d.date))}: ${esc(GN.templateTitle(code))}, ${status}">
              <span class="d">${dayNum}</span><span class="c">${isDone ? '✓' : code}</span></a>`;
          })
          .join('');
        return `<div class="cal-row${w.isDeload ? ' deload' : ''}" role="row">
          <span class="cal-week" role="rowheader" aria-label="Неделя ${w.week}${w.isDeload ? ', разгрузочная' : ''}">${w.week}</span>${cells}</div>`;
      })
      .join('');
    return `<div class="cal" role="table" aria-label="Календарь цикла">
      <div class="cal-row" role="row"><span class="cal-week" role="columnheader" aria-label="Неделя"></span>${head}</div>
      ${rows}
      <p class="cal-legend"><span>✓ выполнена</span><span><i></i> сегодня</span><span>Пунктир — пропущена</span><span>LA / LB — лёгкие</span></p>
    </div>`;
  }

  GN.screens = GN.screens || {};

  // ── Программа ──
  GN.screens.program = function (ctx) {
    const { services } = ctx;
    return {
      async render() {
        const today = new Date();
        const [{ cycle, scheme }, templates, exercises] = await Promise.all([
          services.getActiveCycleWithScheme(),
          services.listTemplates(),
          services.exerciseMap(),
        ]);
        const sessions = cycle ? await services.listByCycle(cycle.id) : [];
        const header = screenHeader({ title: 'Программа', action: iconButton('settings', 'Настройки', 'data-action="settings"') });

        let cycleBlock;
        if (cycle && scheme) {
          const p = GN.getCyclePosition(cycle.startDate, scheme, today);
          const now = p.status === 'active' ? `Неделя ${p.week}` : p.status === 'not_started' ? 'Не начат' : 'Завершён';
          cycleBlock = `<section class="card" aria-label="Текущий цикл">
            <dl class="cycle-dates">
              <div><dt>Начало</dt><dd>${esc(GN.formatDayMonthShort(cycle.startDate))}</dd></div>
              <div><dt>Окончание</dt><dd>${esc(GN.formatDayMonthShort(GN.getCycleEndDate(cycle.startDate, scheme)))}</dd></div>
              <div><dt>Сейчас</dt><dd>${now}</dd></div>
            </dl>
            ${calendar(cycle.startDate, scheme, GN.toISODate(today), sessions)}
          </section>`;
        } else {
          cycleBlock = `<section class="card-flat">
            <p class="title">Цикл не начат</p>
            <p class="muted" style="margin:6px 0 16px">Выберите дату старта на экране «Сегодня» — календарь появится здесь.</p>
            <a href="#/" class="btn btn-secondary">Выбрать дату</a>
          </section>`;
        }

        const list = templates
          .map((t) => {
            const names = t.items
              .slice(0, 2)
              .map((i) => (exercises.get(i.exerciseId) || {}).name)
              .filter(Boolean)
              .join(', ');
            return `<li><a href="#/program/${t.code}" class="tpl-link">
              <span class="tpl-code" aria-hidden="true">${t.code}</span>
              <span class="tpl-text"><span class="n">${esc(t.name)}</span>
                <span class="m">${GN.exercisesLabel(t.items.length)} · ${esc(names)}${t.items.length > 2 ? '…' : ''}</span></span>
              ${icon('chevronRight')}
            </a></li>`;
          })
          .join('');

        return `${header}<div class="stack">
          ${cycleBlock}
          <h2 class="section-title">Тренировки</h2>
          <ul class="tpl-list">${list}</ul>
          ${button('Редактировать программу', { variant: 'secondary', block: true, icon: 'edit', attrs: 'data-action="edit"' })}
        </div>`;
      },
      actions: {
        settings: () => ctx.go('/settings'),
        edit: () => ctx.go('/program/edit'),
      },
    };
  };

  // ── Состав тренировки (только чтение) ──
  GN.screens.template = function (ctx) {
    const { services } = ctx;
    const code = ctx.params.code;
    let template = null;
    return {
      async render() {
        const back = iconButton('chevronLeft', 'Назад', 'data-action="back"');
        const [t, exercises, inProgress] = await Promise.all([
          GN.TEMPLATE_CODES.includes(code) ? services.getTemplate(code) : null,
          services.exerciseMap(),
          services.getInProgress(),
        ]);
        template = t;
        if (!template) return `${screenHeader({ leading: back, title: 'Не найдено' })}<p class="muted">Такой тренировки нет в программе.</p>`;

        const rows = template.items
          .map((item, i) => {
            const ex = exercises.get(item.exerciseId);
            return `<li class="tpl-row">${exerciseImage(ex ? ex.image : null, { compact: true })}
              <div style="min-width:0">
                <p class="n"><span class="i">${i + 1}</span>${esc(ex ? ex.name : 'Неизвестное упражнение')}</p>
                <p class="m">${item.sets} × ${GN.formatRepRange(item.repMin, item.repMax)}${ex && ex.resultType === 'seconds' ? ' с' : ''} · отдых ${GN.formatClock(item.restSeconds)}</p>
                ${ex ? `<p class="g">${esc(ex.muscleGroup)}</p>` : ''}
              </div></li>`;
          })
          .join('');

        const action = inProgress
          ? button(`Продолжить: ${esc(inProgress.templateName)}`, { variant: 'secondary', size: 'lg', block: true, attrs: `data-action="resume" data-id="${esc(inProgress.id)}"` })
          : button('Начать эту тренировку сегодня', { variant: 'secondary', size: 'lg', block: true, icon: 'play', attrs: 'data-action="start"' });

        return `${screenHeader({ leading: back, eyebrow: GN.exercisesLabel(template.items.length), title: esc(template.name) })}
          <div class="stack">
            <section class="card"><ul class="tpl-rows">${rows}</ul></section>
            ${action}
            <p class="muted small center">Например, если пропустили тренировку по расписанию.</p>
          </div>`;
      },
      actions: {
        back: () => history.back(),
        resume: (el) => ctx.go(`/workout/${el.dataset.id}`),
        async start() {
          const s = await services.startWorkout(template.code, GN.toISODate(new Date()));
          ctx.go(`/workout/${s.id}`);
        },
      },
    };
  };

  // ── Режим редактирования ──
  // Работаем с копией шаблонов; в базу — только по «Сохранить». Записанные тренировки не меняются.
  GN.screens.programEdit = function (ctx) {
    const { services } = ctx;
    let stored = null;
    let drafts = null;
    let catalog = null;
    let active = 'A';
    let errors = [];
    let saving = false;

    const dirtyCodes = () =>
      new Set(drafts.filter((d) => JSON.stringify(d.items) !== JSON.stringify(stored.find((s) => s.id === d.id).items)).map((d) => d.code));
    const current = () => drafts.find((t) => t.code === active);
    const change = (next) => {
      errors = [];
      drafts = drafts.map((t) => (t.id === next.id ? next : t));
      ctx.refresh();
    };

    function leave() {
      if (dirtyCodes().size === 0) return ctx.go('/program');
      GN.ui.openSheet({
        title: 'Отменить изменения?',
        description: 'Несохранённые изменения программы будут потеряны.',
        body:
          button('Отменить изменения', { variant: 'danger', size: 'lg', block: true, attrs: 'data-sheet-action="discard"' }) +
          button('Продолжить редактирование', { variant: 'secondary', block: true, attrs: 'data-sheet-action="close"' }),
        actions: {
          discard: (_el, close) => {
            close();
            ctx.go('/program');
          },
        },
      });
    }

    return {
      full: true,
      async render() {
        if (!drafts) {
          [stored, catalog] = await Promise.all([services.listTemplates(), services.listExercises()]);
          drafts = JSON.parse(JSON.stringify(stored));
        }
        const byId = new Map(catalog.map((e) => [e.id, e]));
        const dirty = dirtyCodes();
        const t = current();

        const tabs = drafts
          .map(
            (d) =>
              `<button type="button" role="tab" class="tab" aria-selected="${d.code === active}" data-action="tab" data-code="${d.code}">${d.code}${
                dirty.has(d.code) ? '<span class="dot" aria-label="изменено"></span>' : ''
              }</button>`,
          )
          .join('');

        const items = t.items
          .map((item, idx) => {
            const ex = byId.get(item.exerciseId);
            const sec = ex && ex.resultType === 'seconds';
            const a = `data-item="${esc(item.id)}"`;
            return `<li class="edit-item">
              <div class="edit-head">
                <span class="edit-index">${idx + 1}</span>
                <div style="min-width:0"><p style="font-weight:600">${esc(ex ? ex.name : 'Неизвестное упражнение')}</p>
                <p class="muted" style="font-size:14px">${esc(ex ? ex.muscleGroup : '')}</p></div>
              </div>
              <div class="edit-grid">
                ${stepper({ label: 'Подходы', value: item.sets, min: 1, max: 10, action: 'step', attrs: `${a} data-key="sets" data-step="1"` })}
                ${stepper({ label: 'Отдых', value: item.restSeconds, min: 0, max: 600, action: 'step', attrs: `${a} data-key="restSeconds" data-step="15"`, format: GN.formatClock })}
                ${stepper({ label: sec ? 'Сек. от' : 'Повт. от', value: item.repMin, min: 1, max: sec ? 600 : 100, action: 'step', attrs: `${a} data-key="repMin" data-step="${sec ? 5 : 1}"` })}
                ${stepper({ label: sec ? 'Сек. до' : 'Повт. до', value: item.repMax, min: 1, max: sec ? 600 : 100, action: 'step', attrs: `${a} data-key="repMax" data-step="${sec ? 5 : 1}"` })}
              </div>
              <div class="edit-actions">
                ${iconButton('chevronUp', 'Выше', `data-action="move" data-index="${idx}" data-delta="-1" ${idx === 0 ? 'disabled' : ''}`)}
                ${iconButton('chevronDown', 'Ниже', `data-action="move" data-index="${idx}" data-delta="1" ${idx === t.items.length - 1 ? 'disabled' : ''}`)}
                ${button('Убрать', { variant: 'ghost remove', size: 'sm', icon: 'trash', attrs: `data-action="remove" ${a}` })}
              </div>
            </li>`;
          })
          .join('');

        return `${screenHeader({
          leading: iconButton('close', 'Выйти из редактирования', 'data-action="leave"'),
          eyebrow: 'Режим редактирования',
          title: 'Программа',
        })}
          <div class="tabs" role="tablist" aria-label="Тренировки">${tabs}</div>
          <p class="muted small" style="margin:12px 0 16px">Изменения применятся к следующим тренировкам. Уже записанные не изменятся.</p>
          <ol class="edit-items" aria-label="${esc(t.name)}">${items || '<li class="empty">В тренировке нет упражнений</li>'}</ol>
          ${button('Добавить упражнение', { variant: 'secondary', block: true, icon: 'plus', attrs: 'data-action="add"' })}
          ${errors.length ? `<div class="error" role="alert" style="margin-top:16px">${errors.map((e) => `<p>${esc(e)}</p>`).join('')}</div>` : ''}
          <div class="save-spacer"></div>
          <div class="save-bar">
            ${button('Отмена', { variant: 'secondary', attrs: 'data-action="leave"' })}
            ${button(saving ? 'Сохраняю…' : 'Сохранить изменения', { attrs: `data-action="save" ${dirty.size === 0 || saving ? 'disabled' : ''}` })}
          </div>`;
      },

      actions: {
        leave,
        tab(el) {
          active = el.dataset.code;
          ctx.refresh();
        },
        step(el) {
          const t = current();
          const item = t.items.find((i) => i.id === el.dataset.item);
          const key = el.dataset.key;
          const delta = Number(el.dataset.delta) * Number(el.dataset.step);
          const limits = { sets: [1, 10], restSeconds: [0, 600], repMin: [1, 600], repMax: [1, 600] }[key];
          const value = Math.min(limits[1], Math.max(limits[0], item[key] + delta));
          const patch = { [key]: value };
          if (key === 'repMin') patch.repMax = Math.max(value, item.repMax);
          if (key === 'repMax') patch.repMin = Math.min(value, item.repMin);
          change(GN.updateItem(t, item.id, patch));
        },
        move(el) {
          change(GN.moveItem(current(), Number(el.dataset.index), Number(el.dataset.delta)));
        },
        remove(el) {
          change(GN.removeItem(current(), el.dataset.item));
        },
        add() {
          const t = current();
          const available = catalog.filter((e) => !t.items.some((i) => i.exerciseId === e.id));
          GN.ui.openSheet({
            title: `Добавить в ${t.name}`,
            body: `<ul class="picker">${available
              .map((e) => `<li><button type="button" data-sheet-action="pick" data-id="${esc(e.id)}"><span style="font-weight:600">${esc(e.name)}</span><span class="g">${esc(e.muscleGroup)}</span></button></li>`)
              .join('')}</ul>`,
            actions: {
              pick: (el, close) => {
                const ex = catalog.find((e) => e.id === el.dataset.id);
                close();
                change(GN.addItem(current(), ex, GN.systemClock.uuid()));
              },
            },
          });
        },
        async save() {
          const problems = drafts.flatMap(GN.validateTemplate);
          if (problems.length) {
            errors = problems;
            return ctx.refresh();
          }
          saving = true;
          ctx.refresh();
          try {
            const dirty = dirtyCodes();
            await services.saveTemplates(drafts.filter((d) => dirty.has(d.code)));
            GN.ui.toast('Программа сохранена');
            ctx.go('/program');
          } catch (e) {
            errors = e.errors || [e.message || 'Не удалось сохранить'];
            saving = false;
            ctx.refresh();
          }
        },
      },
    };
  };
})((globalThis.GN = globalThis.GN || {}));
