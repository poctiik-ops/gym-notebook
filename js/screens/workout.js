/* Экран активной тренировки: карточки упражнений, ввод подходов, таймер отдыха. */
(function (GN) {
  'use strict';
  const { esc, icon, button, iconButton, progressBar, exerciseImage, screenHeader } = GN.ui;

  // ── Блок «Прошлый раз» ──
  function previousBlock(prev) {
    if (!prev) {
      return `<section class="prev" aria-label="Прошлый раз">
        <p class="eyebrow">Прошлый раз</p>
        <p class="first">Первое выполнение — запишите стартовый вес</p>
      </section>`;
    }
    const weights = prev.sets.map((s) => s.weight).filter((w) => w != null);
    let weightLine = 'Без веса';
    if (weights.length) {
      const min = Math.min(...weights);
      const max = Math.max(...weights);
      weightLine = min === max ? `${GN.formatNumber(max)} кг` : `${GN.formatNumber(min)}–${GN.formatNumber(max)} кг`;
    }
    const values = prev.sets.map((s) => (s.value == null ? '—' : GN.formatNumber(s.value))).join(' / ');
    return `<section class="prev" aria-label="Прошлый раз">
      <p class="eyebrow">Прошлый раз · ${esc(GN.formatDayMonthShort(prev.plannedDate))}${
        prev.sameTemplate ? '' : `<span class="other"> · ${esc(prev.templateName)}</span>`
      }</p>
      <p class="weight">${weightLine}</p>
      <p class="values">${values || '—'}${values && prev.resultType === 'seconds' ? ' с' : ''}</p>
      ${
        prev.warmups && prev.warmups.length
          ? `<p class="prev-warmup">Разминка: ${prev.warmups.map((w) => esc(GN.formatSet(w.weight, w.value, prev.resultType))).join(' · ')}</p>`
          : ''
      }
    </section>`;
  }

  function numField({ label, unit, value, placeholder, decimal, disabled, field, ei, si, invalid }) {
    const id = `f-${field}-${ei}-${si}`;
    return `<div class="num">
      <label for="${id}">${label}</label>
      <input id="${id}" type="text" inputmode="${decimal ? 'decimal' : 'numeric'}" enterkeyhint="done"
        autocomplete="off" autocorrect="off" spellcheck="false"
        data-field="${field}" data-ex="${ei}" data-set="${si}"
        value="${value == null ? '' : GN.formatNumber(value)}"
        placeholder="${placeholder == null ? '—' : GN.formatNumber(placeholder)}"
        ${disabled ? 'disabled' : ''} ${invalid ? 'aria-invalid="true"' : ''}>
      ${unit ? `<span class="unit" aria-hidden="true">${unit}</span>` : ''}
    </div>`;
  }

  /**
   * Вес по умолчанию: последний отмеченный сегодня подход того же вида (разминка к разминке,
   * рабочий к рабочему), иначе — из прошлого раза.
   */
  function defaultWeight(ex, si, prevSet) {
    const warmup = !!ex.sets[si].warmup;
    // Разминка идёт «лесенкой» — для неё важнее прошлый раз, чем предыдущий подход
    if (warmup && prevSet && prevSet.weight != null) return prevSet.weight;
    for (let i = si - 1; i >= 0; i--) {
      const s = ex.sets[i];
      if (!!s.warmup === warmup && s.completedAt && s.weight != null) return s.weight;
    }
    return prevSet ? prevSet.weight : null;
  }

  const prevSetFor = (prev, ex, set) => GN.previousSetAt(prev, GN.kindIndex(ex, set), !!set.warmup);
  const setLabel = (ex, set) => (set.warmup ? `Разминка ${GN.kindIndex(ex, set) + 1}` : `Подход ${GN.kindIndex(ex, set) + 1}`);

  function setRow(set, prevSet, ex, ei, showWeight, hasError) {
    const done = set.completedAt != null;
    const label = setLabel(ex, set);
    const type = ex.snapshot.resultType;
    const firstWork = !set.warmup && set.index > 0 && ex.sets[set.index - 1].warmup;
    return `${firstWork ? '<li class="sets-divider" aria-hidden="true">Рабочие подходы</li>' : ''}
    <li class="set${done ? ' is-done' : ''}${set.warmup ? ' is-warmup' : ''}">
      <div class="set-head">
        <span class="set-title">${label}${done ? ' <span class="ok" aria-hidden="true">✓</span><span class="sr-only">выполнен</span>' : ''}</span>
        <span class="set-prev">Прошлый: ${prevSet ? esc(GN.formatSet(prevSet.weight, prevSet.value, type)) : '—'}</span>
      </div>
      <div class="set-inputs${showWeight ? '' : ' no-weight'}">
        ${
          showWeight
            ? numField({ label: 'Вес', unit: 'кг', value: set.weight, placeholder: defaultWeight(ex, set.index, prevSet), decimal: true, disabled: done, field: 'weight', ei, si: set.index })
            : ''
        }
        ${numField({
          label: type === 'seconds' ? 'Секунды' : 'Повторы',
          unit: type === 'seconds' ? 'с' : '',
          value: set.value,
          placeholder: prevSet && prevSet.value,
          disabled: done,
          field: 'value',
          ei,
          si: set.index,
          invalid: hasError,
        })}
        <button type="button" class="check" data-action="toggle-set" data-ex="${ei}" data-set="${set.index}"
          aria-pressed="${done}" aria-label="${label}: ${done ? 'снять отметку' : 'отметить выполненным'}">
          ${icon('check', 28, { stroke: done ? 2.6 : 2 })}
        </button>
      </div>
      ${hasError ? `<p class="set-error" role="alert">Введите ${type === 'seconds' ? 'время в секундах' : 'количество повторов'}</p>` : ''}
    </li>`;
  }

  function summaryText(ex) {
    const sets = GN.completedSets(ex);
    if (!sets.length) return 'Нет выполненных подходов';
    const weights = sets.map((s) => s.weight).filter((w) => w != null);
    const values = sets.map((s) => GN.formatNumber(s.value || 0)).join(' / ');
    const suffix = ex.snapshot.resultType === 'seconds' ? ' с' : '';
    return weights.length ? `${GN.formatNumber(Math.max(...weights))} кг · ${values}${suffix}` : values + suffix;
  }

  function exerciseCard(ex, ei, total, prev, errors) {
    const s = ex.snapshot;
    const done = GN.isExerciseDone(ex);
    const doneCount = GN.completedSets(ex).length;
    const workTotal = GN.workingSets(ex).length;
    const status = `${doneCount} из ${workTotal}`;
    const badgeIcon = done ? icon('check', 16, { stroke: 2.6 }) : '';

    if (ex.collapsed) {
      return `<article class="ex-card collapsed" aria-label="${esc(s.name)}">
        <button type="button" class="collapsed-row" data-action="expand" data-ex="${ei}" aria-expanded="false">
          ${exerciseImage(s.image, { compact: true })}
          <span class="txt"><span class="n">${esc(s.name)}</span><span class="s">${esc(summaryText(ex))}</span></span>
          <span class="status-badge${done ? ' done' : ''}">${badgeIcon}${status}</span>
        </button>
      </article>`;
    }

    // Поле веса есть всегда: для упражнений без отягощения его можно оставить пустым
    const showWeight = true;
    const unitWord = s.resultType === 'seconds' ? 'Секунды' : 'Повторы';
    const left = workTotal - doneCount;
    const warmCount = s.warmupSets || 0;
    const side = GN.perSideLabel(s.perSide);

    return `<article class="ex-card" id="ex-${ei}" aria-labelledby="ex-name-${ei}">
      ${exerciseImage(s.image, {
        extra: `<span class="pill left">${ei + 1} / ${total}</span><span class="pill right${done ? ' done' : ''}">${badgeIcon}${done ? 'Готово' : status}</span>`,
      })}
      <div class="ex-body">
        <p class="ex-muscle">${esc(s.muscleGroup)}</p>
        <h2 class="ex-name" id="ex-name-${ei}">${esc(s.name)}</h2>
        <dl class="ex-stats">
          <div><dt>Подходы</dt><dd>${s.sets}</dd></div>
          <div><dt>${unitWord}</dt><dd>${GN.formatRepRange(s.repMin, s.repMax)}</dd></div>
          <div><dt>Отдых</dt><dd>${GN.formatRest(s.restSeconds, s.restMinSeconds)}</dd></div>
        </dl>
        ${side ? `<p class="ex-note">${unitWord} — ${side}</p>` : ''}
        ${
          warmCount
            ? `<p class="ex-note warm">+ ${warmCount} ${GN.plural(warmCount, ['разминочный подход', 'разминочных подхода', 'разминочных подходов'])} перед рабочими. Их вес и повторы тоже записываются — в следующий раз увидите их как «Прошлый».</p>`
            : ''
        }
        ${s.instruction ? `<details class="hint"><summary>${icon('info', 20)} Техника</summary><p>${esc(s.instruction)}</p></details>` : ''}
        ${previousBlock(prev)}
        <ol class="sets" aria-label="Подходы">
          ${ex.sets.map((set) => setRow(set, prevSetFor(prev, ex, set), ex, ei, showWeight, errors.has(`${ei}:${set.index}`))).join('')}
        </ol>
        ${done ? button('Свернуть', { variant: 'secondary', block: true, icon: 'chevronUp', attrs: `data-action="collapse" data-ex="${ei}"` }) : ''}
        ${!done && doneCount > 0 ? `<p class="left-note">Осталось ${left} ${GN.plural(left, ['подход', 'подхода', 'подходов'])}</p>` : ''}
      </div>
    </article>`;
  }

  function summaryView(s) {
    const abandoned = s.status === 'abandoned';
    const ex = GN.sessionExerciseCounts(s);
    const rows = s.exercises
      .map((e) => {
        const sets = GN.completedSets(e);
        const unit = e.snapshot.resultType === 'seconds' ? ' с' : '';
        const text = sets.length
          ? sets.map((x) => (x.weight != null ? `${GN.formatNumber(x.weight)}×${x.value}` : `${x.value}${unit}`)).join('  ·  ')
          : 'не выполнено';
        const warm = GN.completedWarmups(e);
        const warmText = warm.length ? `Разминка: ${warm.map((x) => GN.formatSet(x.weight, x.value, e.snapshot.resultType)).join(' · ')}` : '';
        return `<li><strong>${esc(e.snapshot.name)}</strong><span class="r">${esc(text)}</span>${warmText ? `<span class="r small">${esc(warmText)}</span>` : ''}</li>`;
      })
      .join('');
    return `${screenHeader({
      eyebrow: esc(GN.formatDayMonth(s.plannedDate)),
      title: abandoned ? 'Тренировка прервана' : `<span style="display:inline-flex;align-items:center;gap:8px;"><span style="color:var(--accent)">${icon('check', 30, { stroke: 2.6 })}</span>Тренировка завершена</span>`,
    })}
      <div class="stack">
        <section class="card">
          <p class="eyebrow">${esc(s.templateName)}</p>
          <dl class="stats">
            <div><dt>Время</dt><dd>${GN.formatDuration(GN.sessionDurationMs(s))}</dd></div>
            <div><dt>Объём</dt><dd>${GN.formatVolume(GN.sessionVolume(s))}</dd></div>
            <div><dt>Упражн.</dt><dd>${ex.done}/${ex.total}</dd></div>
          </dl>
        </section>
        <section class="card"><ul class="summary-list">${rows}</ul></section>
        <a href="#/" class="btn btn-primary btn-lg btn-block">Готово</a>
      </div>`;
  }

  function nextSetHint(s) {
    for (const ex of s.exercises) {
      const set = ex.sets.find((x) => !x.completedAt);
      if (set) return `${ex.snapshot.name} — ${setLabel(ex, set).toLowerCase()}`;
    }
    return 'Следующий подход';
  }

  // ── Wake Lock: экран не гаснет во время тренировки (если система позволяет) ──
  function createWakeLock() {
    let sentinel = null;
    let active = false;
    const request = async () => {
      try {
        if (!active || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
        sentinel = await navigator.wakeLock.request('screen');
      } catch (e) {
        /* энергосбережение и т.п. — не критично */
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && request();
    return {
      start() {
        active = true;
        request();
        document.addEventListener('visibilitychange', onVisible);
      },
      stop() {
        active = false;
        document.removeEventListener('visibilitychange', onVisible);
        if (sentinel) sentinel.release().catch(() => {});
        sentinel = null;
      },
    };
  }

  GN.screens = GN.screens || {};
  GN.screens.workout = function (ctx) {
    const { services } = ctx;
    const id = ctx.params.id;
    let session = null;
    let previous = null; // Map exerciseIndex → PreviousPerformance | null
    let errors = new Set();
    let timerInterval = null;
    let timerKey = '';
    let chimedFor = null;
    const wake = createWakeLock();

    const save = (fn) =>
      services.mutate(id, fn).then(
        (s) => {
          session = s;
          return s;
        },
        (e) => {
          GN.ui.toast(e.message || 'Не удалось сохранить');
          throw e;
        },
      );

    // ── Таймер отдыха: время считается от endsAt, интервал только перерисовывает ──
    function renderTimer() {
      const host = document.getElementById('timer-root');
      const t = session && session.status === 'in_progress' ? session.restTimer : null;
      if (!t) {
        host.innerHTML = '';
        timerKey = '';
        return;
      }
      const remainingMs = t.endsAt - Date.now();
      const finished = remainingMs <= 0;
      const key = `${t.endsAt}|${finished}`;
      if (key !== timerKey) {
        timerKey = key;
        host.innerHTML = `<div class="timer${finished ? ' finished' : ''}" role="region" aria-label="Таймер отдыха">
          <div class="bar" aria-hidden="true"></div>
          <div class="content">
            <div class="txt">
              <span class="lbl">${finished ? 'Отдых окончен' : 'Отдых'}</span>
              ${finished ? `<span class="next">${esc(nextSetHint(session))}</span>` : '<span class="time" role="timer"></span>'}
            </div>
            <div class="actions">
              ${
                finished
                  ? button('Ок', { variant: 'secondary', size: 'sm', attrs: 'data-action="skip-rest"' })
                  : button('+15 с', { variant: 'secondary on-dark', size: 'sm', attrs: 'data-action="extend-rest" aria-label="Добавить 15 секунд"' }) +
                    button('Пропустить', { variant: 'secondary on-dark', size: 'sm', attrs: 'data-action="skip-rest"' })
              }
            </div>
          </div>
          <span class="sr-only" aria-live="polite">${finished ? 'Отдых окончен' : ''}</span>
        </div>`;
        if (finished && chimedFor !== t.endsAt) {
          chimedFor = t.endsAt;
          // Сигнал только если окончание поймали «вживую», а не при возврате через несколько минут
          if (Date.now() - t.endsAt < 3000) GN.playChime();
        }
      }
      const time = host.querySelector('.time');
      if (time) time.textContent = GN.formatClock(Math.ceil(Math.max(0, remainingMs) / 1000));
      const bar = host.querySelector('.bar');
      if (bar) {
        const p = finished ? 1 : 1 - remainingMs / (t.durationSeconds * 1000);
        bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
      }
    }

    const onVisible = () => document.visibilityState === 'visible' && renderTimer();

    async function completeFromRow(ei, si) {
      const ex = session.exercises[ei];
      const set = ex.sets[si];
      if (set.completedAt) {
        await save((s, now) => GN.uncompleteSet(s, ei, si, now));
        return ctx.refresh();
      }
      const row = document.querySelector(`.check[data-ex="${ei}"][data-set="${si}"]`).closest('.set');
      const wIn = row.querySelector('[data-field="weight"]');
      const vIn = row.querySelector('[data-field="value"]');
      const prevSet = prevSetFor(previous.get(ei), ex, set);
      const parsedW = wIn ? GN.parseDecimal(wIn.value) : null;
      const parsedV = GN.parseInteger(vIn.value);
      // Пустое поле = «как в прошлый раз» (значение показано подсказкой)
      const weight = parsedW === undefined ? set.weight : parsedW ?? defaultWeight(ex, si, prevSet);
      const value = parsedV === undefined ? null : parsedV ?? (prevSet ? prevSet.value : null);
      const key = `${ei}:${si}`;
      if (value == null || value <= 0) {
        errors.add(key);
        return ctx.refresh();
      }
      errors.delete(key);
      await save((s, now) => GN.completeSet(s, ei, si, { weight, value }, now));
      ctx.refresh();
    }

    return {
      full: true,

      async render() {
        session = (await services.getSession(id)) || null;
        if (!session) {
          return `<div class="empty"><p>Тренировка не найдена.</p><p><a href="#/" style="color:var(--accent)">На главную</a></p></div>`;
        }
        if (session.status !== 'in_progress') return summaryView(session);

        if (!previous) {
          const list = await Promise.all(
            session.exercises.map((e) => services.getPreviousPerformance(e.exerciseId, session.templateId, session.id)),
          );
          previous = new Map(list.map((p, i) => [i, p]));
        }

        const c = GN.sessionSetCounts(session);
        const allDone = GN.isSessionFullyDone(session);
        return `<header class="workout-header">
            ${iconButton('chevronLeft', 'К экрану «Сегодня»', 'data-action="back"')}
            <div style="min-width:0">
              <p class="t">${esc(session.templateName)}</p>
              <p class="m">${session.cycleWeek ? `Неделя ${session.cycleWeek} · ` : ''}${c.done} / ${c.total} подходов</p>
            </div>
          </header>
          <div class="workout-progress">${progressBar(c.total ? c.done / c.total : 0, 'Выполнено подходов')}</div>
          <div class="workout-list">
            ${session.exercises.map((ex, i) => exerciseCard(ex, i, session.exercises.length, previous.get(i), errors)).join('')}
          </div>
          <div class="stack" style="margin-top:24px">
            ${button('ЗАВЕРШИТЬ ТРЕНИРОВКУ', { variant: allDone ? 'primary' : 'secondary', size: 'lg', block: true, attrs: 'data-action="finish"' })}
            ${button('Прервать без сохранения', { variant: 'ghost', block: true, attrs: 'data-action="abandon"' })}
          </div>
          <div class="timer-spacer" aria-hidden="true"></div>`;
      },

      mount() {
        const running = session && session.status === 'in_progress';
        if (running && !timerInterval) {
          timerInterval = setInterval(renderTimer, 250);
          document.addEventListener('visibilitychange', onVisible);
          wake.start();
        }
        if (!running) this.unmount();
        renderTimer();
      },

      unmount() {
        clearInterval(timerInterval);
        timerInterval = null;
        document.removeEventListener('visibilitychange', onVisible);
        wake.stop();
        const host = document.getElementById('timer-root');
        if (host) host.innerHTML = '';
        timerKey = '';
      },

      onInput(e) {
        const el = e.target;
        if (!el.dataset.field || !session) return;
        if (el.value.includes('.')) el.value = el.value.replace('.', ',');
        const field = el.dataset.field;
        const ei = Number(el.dataset.ex);
        const si = Number(el.dataset.set);
        const parsed = field === 'weight' ? GN.parseDecimal(el.value) : GN.parseInteger(el.value);
        if (parsed === undefined) {
          el.setAttribute('aria-invalid', 'true');
          return;
        }
        el.removeAttribute('aria-invalid');
        // Черновик сохраняется сразу — если iOS выгрузит приложение, ввод не пропадёт
        save((s, now) => GN.updateSetDraft(s, ei, si, { [field]: parsed }, now)).catch(() => {});
      },

      onFocusOut(e) {
        const el = e.target;
        if (!el.dataset.field || !session) return;
        const parsed = el.dataset.field === 'weight' ? GN.parseDecimal(el.value) : GN.parseInteger(el.value);
        if (parsed === undefined) {
          const set = session.exercises[el.dataset.ex].sets[el.dataset.set];
          const v = set[el.dataset.field];
          el.value = v == null ? '' : GN.formatNumber(v);
        } else {
          el.value = parsed == null ? '' : GN.formatNumber(parsed);
        }
        el.removeAttribute('aria-invalid');
      },

      onKeyDown(e) {
        const el = e.target;
        if (e.key !== 'Enter' || !el.dataset.field) return;
        e.preventDefault();
        el.blur();
        if (el.dataset.field === 'value') completeFromRow(Number(el.dataset.ex), Number(el.dataset.set));
      },

      actions: {
        back: () => ctx.go('/'),
        'toggle-set': (el) => completeFromRow(Number(el.dataset.ex), Number(el.dataset.set)),
        async collapse(el) {
          await save((s, now) => GN.setExerciseCollapsed(s, Number(el.dataset.ex), true, now));
          await ctx.refresh();
          const next = document.querySelector('.ex-card:not(.collapsed)');
          if (next) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        async expand(el) {
          await save((s, now) => GN.setExerciseCollapsed(s, Number(el.dataset.ex), false, now));
          ctx.refresh();
        },
        async 'skip-rest'() {
          await save((s, now) => GN.clearRestTimer(s, now));
          renderTimer();
        },
        async 'extend-rest'() {
          await save((s, now) => GN.extendRestTimer(s, 15, now));
          renderTimer();
        },
        async finish() {
          const doFinish = async (close) => {
            await save((s, now) => GN.finishSession(s, now));
            if (close) close();
            window.scrollTo(0, 0);
            ctx.refresh();
          };
          if (GN.isSessionFullyDone(session)) return doFinish();
          const c = GN.sessionSetCounts(session);
          GN.ui.openSheet({
            title: 'Завершить тренировку?',
            description: `Выполнено ${c.done} из ${c.total} подходов. В историю попадут только отмеченные подходы.`,
            body:
              button('Завершить', { size: 'lg', block: true, attrs: 'data-sheet-action="finish"' }) +
              button('Продолжить тренировку', { variant: 'secondary', block: true, attrs: 'data-sheet-action="close"' }),
            actions: { finish: (_el, close) => doFinish(close) },
          });
        },
        abandon() {
          GN.ui.openSheet({
            title: 'Прервать тренировку?',
            description: 'Результаты этой тренировки не попадут в историю и не будут показаны как «Прошлый раз».',
            body:
              button('Прервать', { variant: 'danger', size: 'lg', block: true, attrs: 'data-sheet-action="abandon"' }) +
              button('Отмена', { variant: 'secondary', block: true, attrs: 'data-sheet-action="close"' }),
            actions: {
              abandon: async (_el, close) => {
                await save((s, now) => GN.abandonSession(s, now));
                close();
                ctx.go('/');
              },
            },
          });
        },
      },
    };
  };
})((globalThis.GN = globalThis.GN || {}));
