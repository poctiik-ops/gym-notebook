/* Мини-фреймворк тестов: describe / it / expect. Результаты выводятся на страницу tests.html. */
(function (global) {
  'use strict';

  const suites = [];
  let currentSuite = null;

  global.describe = (name, fn) => {
    currentSuite = { name, tests: [], beforeEach: [], afterEach: [] };
    suites.push(currentSuite);
    fn();
    currentSuite = null;
  };
  global.it = (name, fn) => currentSuite.tests.push({ name, fn });
  global.beforeEach = (fn) => currentSuite.beforeEach.push(fn);
  global.afterEach = (fn) => currentSuite.afterEach.push(fn);

  const show = (v) => {
    try {
      return JSON.stringify(v);
    } catch (e) {
      return String(v);
    }
  };

  function deepEqual(a, b) {
    return show(a) === show(b);
  }

  function matchObject(actual, expected, path = '') {
    if (actual == null) throw new Error(`${path || 'значение'}: ожидался объект, получено ${show(actual)}`);
    for (const k of Object.keys(expected)) {
      const e = expected[k];
      const p = path ? `${path}.${k}` : k;
      if (e && typeof e === 'object' && !Array.isArray(e)) matchObject(actual[k], e, p);
      else if (!deepEqual(actual[k], e)) throw new Error(`${p}: ожидалось ${show(e)}, получено ${show(actual[k])}`);
    }
  }

  global.expect = (actual) => ({
    toBe(e) {
      if (!Object.is(actual, e)) throw new Error(`ожидалось ${show(e)}, получено ${show(actual)}`);
    },
    toEqual(e) {
      if (!deepEqual(actual, e)) throw new Error(`ожидалось ${show(e)}, получено ${show(actual)}`);
    },
    toMatchObject(e) {
      matchObject(actual, e);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`ожидалось null, получено ${show(actual)}`);
    },
    toBeUndefined() {
      if (actual !== undefined) throw new Error(`ожидалось undefined, получено ${show(actual)}`);
    },
    toBeDefined() {
      if (actual === undefined) throw new Error('значение не определено');
    },
    toHaveLength(n) {
      if (!actual || actual.length !== n) throw new Error(`ожидалась длина ${n}, получено ${actual && actual.length}`);
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(`ожидалось > ${n}, получено ${show(actual)}`);
    },
    toBeTrue() {
      if (actual !== true) throw new Error(`ожидалось true, получено ${show(actual)}`);
    },
    toThrow(Type) {
      try {
        actual();
      } catch (err) {
        if (Type && !(err instanceof Type)) throw new Error(`ошибка другого типа: ${err}`);
        return;
      }
      throw new Error('ожидалась ошибка');
    },
    async toReject(Type) {
      try {
        await actual;
      } catch (err) {
        if (Type && !(err instanceof Type)) throw new Error(`ошибка другого типа: ${err}`);
        return;
      }
      throw new Error('ожидалась ошибка');
    },
  });

  global.runTests = async function (report) {
    let passed = 0;
    let failed = 0;
    for (const suite of suites) {
      const results = [];
      for (const t of suite.tests) {
        try {
          for (const fn of suite.beforeEach) await fn();
          await t.fn();
          for (const fn of suite.afterEach) await fn();
          results.push({ name: t.name, ok: true });
          passed++;
        } catch (err) {
          results.push({ name: t.name, ok: false, error: err && err.message ? err.message : String(err) });
          failed++;
          try {
            for (const fn of suite.afterEach) await fn();
          } catch (e) {
            /* ignore */
          }
        }
      }
      report.suite(suite.name, results);
    }
    report.done(passed, failed);
    return { passed, failed };
  };
})(globalThis);
