/* Настройки, а также простые «История» и «Прогресс» (полные версии — на следующем этапе). */
(function (GN) {
  'use strict';
  const { esc, button, iconButton, screenHeader, startCycleForm, bindStartCycleForm } = GN.ui;

  GN.screens = GN.screens || {};

  GN.screens.settings = function (ctx) {
    const { services } = ctx;
    let cycle = null;
    return {
      async render() {
        const [{ cycle: c }, sessions, persisted] = await Promise.all([
          services.getActiveCycleWithScheme(),
          services.listCompleted(),
          GN.isStoragePersisted(),
        ]);
        cycle = c;
        const today = new Date();

        const cycleBlock = cycle
          ? `<p class="muted" style="margin:4px 0 16px">Текущий цикл начался ${esc(GN.formatDayMonth(cycle.startDate))}. Если перенести дату, расписание пересчитается; записанные тренировки останутся в истории.</p>
             <label class="field-label">Дата начала
               <input class="date-input" type="date" id="cycle-start" value="${esc(cycle.startDate)}">
             </label>
             <div class="btn-row">
               ${button('Сохранить дату', { variant: 'secondary', attrs: 'data-action="save-date"' })}
               ${button('Начать новый цикл', { variant: 'ghost', attrs: 'data-action="new-cycle"' })}
             </div>`
          : `<div style="margin-top:16px">${startCycleForm(today)}</div>`;

        const persistText = persisted === null ? 'не поддерживается' : persisted ? 'включена' : 'выключена';

        return `${screenHeader({ leading: iconButton('chevronLeft', 'Назад', 'data-action="back"'), title: 'Настройки' })}
          <div class="stack">
            <section class="card"><h2 class="title">Цикл</h2>${cycleBlock}</section>

            <section class="card">
              <h2 class="title">Данные</h2>
              <dl class="facts">
                <div><dt>Хранятся</dt><dd>на этом устройстве</dd></div>
                <div><dt>Тренировок в истории</dt><dd>${sessions.length}</dd></div>
                <div><dt>Защита от очистки</dt><dd>${persistText}</dd></div>
              </dl>
              ${persisted === false ? button('Запросить постоянное хранилище', { variant: 'secondary', block: true, attrs: 'data-action="persist"' }) : ''}
              <p class="muted" style="margin-top:12px;font-size:14px">Экспорт и импорт в JSON появятся на следующем этапе.</p>
            </section>

            <section class="card-flat">
              <h2 class="title">Демо</h2>
              <p class="muted" style="margin:4px 0 0">Цикл, начатый 2,5 недели назад, и заполненная история — чтобы посмотреть блок «Прошлый раз».</p>
              <div class="btn-row">
                ${button('Загрузить демо-данные', { variant: 'secondary', attrs: 'data-action="demo"' })}
                ${button('Удалить все данные', { variant: 'danger', attrs: 'data-action="reset"' })}
              </div>
            </section>
          </div>`;
      },

      mount(root) {
        bindStartCycleForm(root, async (date) => {
          await services.startCycle(date);
          GN.requestPersistentStorage();
          ctx.go('/');
        });
      },

      actions: {
        back: () => history.back(),
        async 'save-date'() {
          const value = document.getElementById('cycle-start').value;
          if (!value || value === cycle.startDate) return;
          await services.changeStartDate(cycle.id, value);
          GN.ui.toast('Дата начала изменена');
          ctx.refresh();
        },
        'new-cycle'() {
          GN.ui.openSheet({
            title: 'Новый цикл',
            description: 'Текущий цикл будет завершён. История сохранится.',
            body: startCycleForm(new Date(), 'Начать новый цикл'),
          });
          bindStartCycleForm(document.getElementById('sheet-root'), async (date) => {
            await services.startCycle(date);
            GN.ui.closeSheet();
            ctx.go('/');
          });
        },
        async persist() {
          const ok = await GN.requestPersistentStorage();
          GN.ui.toast(ok ? 'Хранилище защищено' : 'Браузер отклонил запрос');
          ctx.refresh();
        },
        demo() {
          GN.ui.openSheet({
            title: 'Загрузить демо-данные?',
            description: 'Все текущие данные — программа, цикл и история — будут заменены демо-набором.',
            body:
              button('Заменить демо-данными', { size: 'lg', block: true, attrs: 'data-sheet-action="ok"' }) +
              button('Отмена', { variant: 'secondary', block: true, attrs: 'data-sheet-action="close"' }),
            actions: {
              ok: async (_el, close) => {
                await services.loadDemo();
                close();
                ctx.go('/');
              },
            },
          });
        },
        reset() {
          GN.ui.openSheet({
            title: 'Удалить все данные?',
            description: 'История тренировок будет удалена без возможности восстановления. Программа вернётся к исходной.',
            body:
              button('Удалить всё', { variant: 'danger', size: 'lg', block: true, attrs: 'data-sheet-action="ok"' }) +
              button('Отмена', { variant: 'secondary', block: true, attrs: 'data-sheet-action="close"' }),
            actions: {
              ok: async (_el, close) => {
                await services.resetAll();
                close();
                ctx.go('/');
              },
            },
          });
        },
      },
    };
  };

  GN.screens.history = function (ctx) {
    return {
      async render() {
        const sessions = await ctx.services.listCompleted();
        const body = sessions.length
          ? `<div class="stack">${sessions
              .slice(0, 30)
              .map(
                (s) => `<a href="#/workout/${esc(s.id)}" class="card" style="display:block">
                  <p class="eyebrow">${esc(GN.formatDayMonth(s.plannedDate))}</p>
                  <p class="title">${esc(s.templateName)}</p>
                  <p class="muted">${GN.formatDuration(GN.sessionDurationMs(s))} · ${GN.sessionExerciseCounts(s).done}/${s.exercises.length} упражнений · ${GN.formatVolume(GN.sessionVolume(s))}</p>
                </a>`,
              )
              .join('')}<p class="empty">Сравнение с прошлой тренировкой — на следующем этапе.</p></div>`
          : '<p class="empty">Здесь появятся завершённые тренировки.</p>';
        return screenHeader({ title: 'История' }) + body;
      },
    };
  };

  GN.screens.progress = function () {
    return {
      render: () => screenHeader({ title: 'Прогресс' }) + '<p class="empty">Графики рабочего веса и объёма появятся на следующем этапе.</p>',
    };
  };
})((globalThis.GN = globalThis.GN || {}));
