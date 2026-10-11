/* Экран «Сегодня» */
(function (GN) {
  'use strict';
  const { esc, icon, button, screenHeader, progressBar, startCycleForm, bindStartCycleForm } = GN.ui;

  function cycleCard(p) {
    const notStarted = p.status === 'not_started';
    return `<section class="card" aria-label="Прогресс цикла">
      <div class="cycle-top">
        <p class="cycle-week">${notStarted ? 'Цикл ещё не начался' : `Неделя ${p.week} <span>/ ${p.weeks}</span>`}</p>
        ${p.isDeloadWeek ? '<span class="badge">Разгрузка</span>' : ''}
      </div>
      ${progressBar(notStarted ? 0 : p.progress, 'Пройдено от цикла')}
      <p class="cycle-meta">${
        notStarted
          ? `Старт ${esc(GN.formatDayMonth(p.startDate))}`
          : `День ${p.day} из ${p.lengthDays} · до ${esc(GN.formatDayMonth(p.endDate))}`
      }</p>
    </section>`;
  }

  function templatePreview(template, exercises, occurrence = 1) {
    return `<ol class="ex-list">${template.items
      .map((item) => {
        const ex = exercises.get(GN.resolveItemExerciseId(item, occurrence));
        const warm = item.warmupSets ? `<span class="warm-tag">+${item.warmupSets} разм.</span> ` : '';
        return `<li><span>${esc(ex ? ex.name : 'Упражнение')}</span><span class="meta">${warm}${item.sets} × ${GN.formatRepRange(item.repMin, item.repMax)}${ex && ex.resultType === 'seconds' ? ' с' : ''}</span></li>`;
      })
      .join('')}</ol>`;
  }

  function workoutCard(template, exercises, actionHtml, occurrence = 1) {
    const sets = template.items.reduce((s, i) => s + i.sets, 0);
    return `<section class="card" aria-label="${esc(template.name)}">
      <p class="eyebrow">Сегодня</p>
      <h2 class="display">${esc(template.name)}</h2>
      <p class="muted">${GN.exercisesLabel(template.items.length)} · ${sets} ${GN.plural(sets, ['подход', 'подхода', 'подходов'])}</p>
      ${templatePreview(template, exercises, occurrence)}
      ${actionHtml}
    </section>`;
  }

  function restCard(next) {
    return `<section class="card">
      <h2 class="display">Сегодня отдых</h2>
      ${
        next
          ? `<p class="muted" style="margin-top:8px">Следующая — <strong style="color:var(--text)">${esc(GN.templateTitle(next.templateCode))}</strong>, ${esc(GN.formatWeekdayDate(next.date))}</p>`
          : '<p class="muted">Тренировок в этом цикле больше нет.</p>'
      }
    </section>`;
  }

  function nextLine(next) {
    if (!next) return '';
    return `<a href="#/program/${next.templateCode}" class="card-flat next-line">
      <span><span class="eyebrow">Следующая</span><strong>${esc(GN.templateTitle(next.templateCode))} · ${esc(GN.formatWeekdayDate(next.date))}</strong></span>
      ${icon('chevronRight')}
    </a>`;
  }

  function doneCard(s) {
    const ex = GN.sessionExerciseCounts(s);
    return `<section class="card">
      <p class="eyebrow done-eyebrow">${icon('check', 18, { stroke: 2.6 })} Выполнено</p>
      <h2 class="display">${esc(s.templateName)}</h2>
      <dl class="stats">
        <div><dt>Время</dt><dd>${GN.formatDuration(GN.sessionDurationMs(s))}</dd></div>
        <div><dt>Объём</dt><dd>${GN.formatVolume(GN.sessionVolume(s))}</dd></div>
        <div><dt>Упражн.</dt><dd>${ex.done}/${ex.total}</dd></div>
      </dl>
    </section>`;
  }

  function resumeCard(s) {
    const c = GN.sessionSetCounts(s);
    return `<section class="card resume" aria-label="Тренировка в процессе">
      <p class="eyebrow">Идёт тренировка</p>
      <h2 class="display">${esc(s.templateName)}</h2>
      ${progressBar(c.total ? c.done / c.total : 0, 'Выполнено подходов')}
      <p class="muted small" style="margin:8px 0 16px">${c.done} из ${c.total} подходов</p>
      ${button('ПРОДОЛЖИТЬ', { size: 'lg', block: true, icon: 'play', attrs: `data-action="resume" data-id="${esc(s.id)}"` })}
    </section>`;
  }

  function installHint() {
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem('install-hint-dismissed') === '1';
    } catch (e) {
      /* приватный режим */
    }
    if (!isIOS || standalone || dismissed) return '';
    return `<aside class="install-hint" aria-label="Установка приложения">
      <div class="text">
        <strong>Установите на экран «Домой»</strong>
        Нажмите ${icon('share', 18, { label: 'Поделиться' })} → «На экран „Домой“». Данные из Safari не переносятся в установленное приложение — лучше установить сразу.
      </div>
      ${GN.ui.iconButton('close', 'Скрыть подсказку', 'data-action="hide-install"')}
    </aside>`;
  }

  GN.screens = GN.screens || {};
  GN.screens.today = function (ctx) {
    const { services } = ctx;
    let error = '';

    return {
      async render() {
        const today = new Date();
        const todayIso = GN.toISODate(today);
        const [{ cycle, scheme }, templates, exercises, inProgress, todaySessions] = await Promise.all([
          services.getActiveCycleWithScheme(),
          services.listTemplates(),
          services.exerciseMap(),
          services.getInProgress(),
          services.listByDate(todayIso),
        ]);
        const plan = GN.getTodayPlan(cycle, scheme, today);
        const byCode = new Map(templates.map((t) => [t.code, t]));

        let body = '';
        switch (plan.kind) {
          case 'no_cycle':
            body = `<section class="card">
                <p class="eyebrow">Новый цикл · 8 недель</p>
                <h2 class="display" style="margin-bottom:8px">Тренировочный блокнот</h2>
                <p class="muted" style="margin-bottom:20px">Программа на 8 недель: A/B/C и D/E/F по очереди, восьмая неделя — разгрузочная. Выберите день старта.</p>
                ${startCycleForm(today)}
              </section>
              ${button('Посмотреть с демо-данными', { variant: 'ghost', block: true, attrs: 'data-action="demo"' })}`;
            break;
          case 'not_started':
            body = cycleCard(plan.position) + nextLine(plan.next);
            break;
          case 'finished':
            body = `${cycleCard(plan.position)}
              <section class="card">
                <h2 class="title" style="margin-bottom:8px">Цикл завершён</h2>
                <p class="muted" style="margin-bottom:20px">Отличная работа. Начните следующий цикл — история сохранится.</p>
                ${startCycleForm(today, 'Начать новый цикл')}
              </section>`;
            break;
          case 'rest': {
            // В день отдыха тоже показываем тренировку, сделанную сегодня вне расписания
            const doneToday = todaySessions.filter((s) => s.status === 'completed');
            body = cycleCard(plan.position) + doneToday.map(doneCard).join('') + restCard(plan.next);
            break;
          }
          case 'workout': {
            const code = plan.planned.templateCode;
            const template = byCode.get(code);
            const done = todaySessions.find((s) => s.status === 'completed' && s.templateCode === code);
            const runningThis = inProgress && inProgress.templateCode === code;
            body = cycleCard(plan.position);
            if (done) body += doneCard(done) + nextLine(plan.next);
            else if (template && !runningThis) {
              body += workoutCard(
                template,
                exercises,
                button(inProgress ? 'Сначала завершите текущую' : 'НАЧАТЬ ТРЕНИРОВКУ', {
                  size: 'lg',
                  block: true,
                  attrs: `data-action="start" data-code="${code}" data-date="${plan.planned.date}" ${inProgress ? 'disabled' : ''}`,
                }),
                await services.nextOccurrence(code),
              );
            }
            break;
          }
        }

        return `${screenHeader({ eyebrow: esc(GN.formatWeekday(today)), title: esc(GN.formatDayMonth(today)) })}
          <div class="stack">
            ${installHint()}
            ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
            ${inProgress ? resumeCard(inProgress) : ''}
            ${body}
          </div>`;
      },

      mount(root) {
        bindStartCycleForm(root, async (date) => {
          await services.startCycle(date);
          GN.requestPersistentStorage();
          ctx.refresh();
        });
      },

      actions: {
        async start(el) {
          try {
            const s = await services.startWorkout(el.dataset.code, el.dataset.date);
            ctx.go(`/workout/${s.id}`);
          } catch (e) {
            error = e.message || 'Не удалось начать тренировку';
            ctx.refresh();
          }
        },
        resume(el) {
          ctx.go(`/workout/${el.dataset.id}`);
        },
        async demo() {
          await services.loadDemo();
          ctx.refresh();
        },
        'hide-install'() {
          try {
            localStorage.setItem('install-hint-dismissed', '1');
          } catch (e) {
            /* не критично */
          }
          ctx.refresh();
        },
      },
    };
  };

  GN.todayParts = { templatePreview };
})((globalThis.GN = globalThis.GN || {}));
