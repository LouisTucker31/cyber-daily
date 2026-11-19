/* Cyber Daily 10 — front-end only daily quiz.
 * Progress is stored on this device in localStorage.
 */
(function () {
  'use strict';

  var DAILY_COUNT = 10;
  var STORE_KEY = 'cyberDaily10.state.v1';
  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /* ---------- helpers ---------- */

  function dateKey(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function dayBefore(key) {
    var p = key.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() - 1);
    return dateKey(d);
  }

  function randInt(n) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var buf = new Uint32Array(1);
      var limit = Math.floor(0x100000000 / n) * n;
      do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return buf[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function freshState() {
    return {
      cycle: 1,
      mastered: [],        // ids answered correctly this cycle
      lastSeen: {},        // id -> date key last shown
      prevSet: [],         // ids shown on the previous day
      streak: { count: 0, last: null },
      day: null            // today's set
    };
  }

  /* ---------- selection ----------
   * 1. Pool = questions not yet answered correctly this cycle.
   * 2. If the pool is empty, a new cycle starts and every question goes back in.
   * 3. Questions shown on the previous day are held back, so you never get the
   *    same one two days running (unless there's nothing else left).
   * 4. Within the pool, questions you haven't seen for longest are favoured,
   *    with random order among equals.
   * 5. If fewer than 10 remain, the rest are topped up with already-mastered
   *    "review" questions (least recently seen first). Reviews don't change progress.
   */
  function bySeenThenRandom(ids, lastSeen) {
    // shuffle first so ties are random, then stable-sort by last seen (never seen = oldest)
    return shuffle(ids).sort(function (a, b) {
      var sa = lastSeen[a] || '';
      var sb = lastSeen[b] || '';
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }

  function drawDailySet(bank, state, count) {
    count = count || DAILY_COUNT;
    var allIds = bank.map(function (q) { return q.id; });
    var idSet = {};
    allIds.forEach(function (id) { idSet[id] = true; });

    var masteredMap = {};
    state.mastered.forEach(function (id) { if (idSet[id]) masteredMap[id] = true; });

    var pool = allIds.filter(function (id) { return !masteredMap[id]; });
    if (pool.length === 0) {
      state.cycle += 1;
      masteredMap = {};
      pool = allIds.slice();
    }
    state.mastered = Object.keys(masteredMap);

    var prev = {};
    state.prevSet.forEach(function (id) { prev[id] = true; });

    var preferred = bySeenThenRandom(pool.filter(function (id) { return !prev[id]; }), state.lastSeen);
    var heldBack = bySeenThenRandom(pool.filter(function (id) { return prev[id]; }), state.lastSeen);
    var chosen = preferred.concat(heldBack).slice(0, count);

    var items = shuffle(chosen).map(function (id) { return { id: id, review: false }; });

    if (items.length < count) {
      var taken = {};
      chosen.forEach(function (id) { taken[id] = true; });
      var spare = allIds.filter(function (id) { return !taken[id]; });
      var spareFresh = bySeenThenRandom(spare.filter(function (id) { return !prev[id]; }), state.lastSeen);
      var spareHeld = bySeenThenRandom(spare.filter(function (id) { return prev[id]; }), state.lastSeen);
      spareFresh.concat(spareHeld).slice(0, count - items.length).forEach(function (id) {
        items.push({ id: id, review: true });
      });
    }

    var byId = {};
    bank.forEach(function (q) { byId[q.id] = q; });
    items.forEach(function (it) {
      var n = byId[it.id].options.length;
      var order = [];
      for (var i = 0; i < n; i++) order.push(i);
      it.order = shuffle(order);  // shuffled answer order, every time
      it.chosen = null;           // display index picked
      it.correct = null;
      it.hint = false;
    });
    return items;
  }

  /* ---------- storage ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return freshState();
      var s = JSON.parse(raw);
      var base = freshState();
      for (var k in base) if (!(k in s)) s[k] = base[k];
      return s;
    } catch (e) {
      return freshState();
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
  }

  /* ---------- app state ---------- */

  var bank = [];
  var byId = {};
  var state = null;
  var countdownTimer = null;

  function ensureToday() {
    var today = dateKey();
    if (state.day && state.day.date === today) {
      // drop any questions that were removed from the JSON since
      state.day.items = state.day.items.filter(function (it) { return byId[it.id]; });
      if (state.day.index > state.day.items.length) state.day.index = state.day.items.length;
      return;
    }
    if (state.day) {
      state.prevSet = state.day.items.map(function (it) { return it.id; });
    }
    var items = drawDailySet(bank, state);
    items.forEach(function (it) { state.lastSeen[it.id] = today; });
    state.day = { date: today, items: items, index: 0, revealed: false, completed: false };
    save();
  }

  function shownStreak() {
    var today = dateKey();
    var s = state.streak;
    if (!s.last) return 0;
    if (s.last === today || s.last === dayBefore(today)) return s.count;
    return 0;
  }

  function completeDay() {
    if (state.day.completed) return;
    state.day.completed = true;
    var today = state.day.date;
    if (state.streak.last === today) {
      // already counted
    } else if (state.streak.last === dayBefore(today)) {
      state.streak.count += 1;
      state.streak.last = today;
    } else {
      state.streak.count = 1;
      state.streak.last = today;
    }
    save();
  }

  /* ---------- rendering ---------- */

  var main = document.getElementById('main');
  var appEl = document.getElementById('app');
  var bar = document.getElementById('actionbar');
  var barInner = document.getElementById('actionbarInner');

  var ICON = {
    tick: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>',
    cross: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>',
    arrow: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5"/></svg>'
  };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderHeader() {
    var n = shownStreak();
    document.getElementById('streakCount').textContent = n;
    document.getElementById('streakUnit').textContent = n === 1 ? 'day' : 'days';
    document.getElementById('streak').classList.toggle('live', n > 0);
    document.getElementById('today').textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  function setBar(button) {
    barInner.innerHTML = '';
    if (button) {
      barInner.appendChild(button);
      bar.hidden = false;
      appEl.classList.add('has-bar');
    } else {
      bar.hidden = true;
      appEl.classList.remove('has-bar');
    }
  }

  function tickRow(items, currentIndex, extraClass) {
    var row = el('div', 'ticks' + (extraClass ? ' ' + extraClass : ''));
    row.setAttribute('aria-hidden', 'true');
    items.forEach(function (it, i) {
      var d = el('span', 'tick');
      if (it.correct === true) d.classList.add('right');
      else if (it.correct === false) d.classList.add('wrong');
      else if (i === currentIndex) d.classList.add('current');
      row.appendChild(d);
    });
    return row;
  }

  function render() {
    renderHeader();
    clearInterval(countdownTimer);
    main.innerHTML = '';
    var day = state.day;
    if (!day.items.length) {
      setBar(null);
      main.appendChild(el('p', 'status error', 'No questions found in questions.json.'));
      return;
    }
    if (day.index >= day.items.length) {
      completeDay();
      renderHeader();
      renderDone();
      return;
    }
    renderQuestion();
  }

  function renderQuestion() {
    var day = state.day;
    var item = day.items[day.index];
    var q = byId[item.id];
    var answered = item.chosen !== null;
    var rightSoFar = day.items.filter(function (it) { return it.correct === true; }).length;

    var progress = el('div', 'progress');
    var meta = el('div', 'progress-meta');
    var count = el('span');
    count.innerHTML = 'Question <b>' + (day.index + 1) + '</b> of ' + day.items.length;
    meta.appendChild(count);
    meta.appendChild(el('span', null, rightSoFar + ' correct'));
    progress.appendChild(meta);
    progress.appendChild(tickRow(day.items, day.index));
    main.appendChild(progress);

    var cat = el('p', 'category', q.category || '');
    if (item.review) {
      cat.appendChild(document.createTextNode(q.category ? ' · ' : ''));
      cat.appendChild(el('span', 'review', 'Review'));
    }
    main.appendChild(cat);
    main.appendChild(el('h2', 'question', q.question));

    var list = el('ul', 'options');
    item.order.forEach(function (origIdx, displayIdx) {
      var li = el('li');
      var b = el('button', 'option');
      b.type = 'button';
      var key = el('span', 'key');
      var picked = answered && displayIdx === item.chosen;
      if (picked) key.innerHTML = item.correct ? ICON.tick : ICON.cross;
      else key.textContent = LETTERS[displayIdx];
      b.appendChild(key);
      b.appendChild(el('span', null, q.options[origIdx]));
      if (answered) {
        b.disabled = true;
        b.classList.add(picked ? (item.correct ? 'picked-right' : 'picked-wrong') : 'dim');
      } else {
        b.addEventListener('click', function () { answer(displayIdx); });
      }
      li.appendChild(b);
      list.appendChild(li);
    });
    main.appendChild(list);

    if (q.hint) {
      if (item.hint) {
        var h = el('div', 'hint');
        h.appendChild(el('b', null, 'Hint'));
        h.appendChild(document.createTextNode(q.hint));
        main.appendChild(h);
      } else if (!answered) {
        var t = el('button', 'hint-toggle', 'Show a hint');
        t.type = 'button';
        t.addEventListener('click', function () {
          item.hint = true;
          save();
          render();
        });
        main.appendChild(t);
      }
    }

    if (!answered) { setBar(null); return; }

    var res = el('section', 'result ' + (item.correct ? 'right' : 'wrong'));
    var head = el('h3', 'result-head');
    head.innerHTML = item.correct ? ICON.tick : ICON.cross;
    head.appendChild(document.createTextNode(item.correct ? 'Correct' : 'Not this time'));
    res.appendChild(head);
    if (item.correct) {
      if (q.explanation) res.appendChild(el('p', null, q.explanation));
      if (!item.review) res.appendChild(el('p', 'note', 'Ticked off. It won’t come up again this round.'));
    } else {
      res.appendChild(el('p', null, item.review
        ? 'This was a review question, so your progress isn’t affected.'
        : 'This one goes back in the pot. You’ll get another go on a later day.'));
    }
    main.appendChild(res);

    var last = day.index === day.items.length - 1;
    var next = el('button', 'btn');
    next.type = 'button';
    next.appendChild(document.createTextNode(last ? 'See today’s results' : 'Next question'));
    next.insertAdjacentHTML('beforeend', ICON.arrow);
    next.addEventListener('click', function () {
      day.index += 1;
      save();
      render();
      window.scrollTo(0, 0);
    });
    setBar(next);
    requestAnimationFrame(function () { res.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  }

  function answer(displayIdx) {
    var item = state.day.items[state.day.index];
    if (item.chosen !== null) return;
    var q = byId[item.id];
    item.chosen = displayIdx;
    item.correct = item.order[displayIdx] === q.correctIndex;
    if (item.correct && !item.review && state.mastered.indexOf(item.id) === -1) {
      state.mastered.push(item.id);
    }
    save(); // saved straight away, so refreshing can't give a second chance
    render();
  }

  function renderDone() {
    setBar(null);
    var day = state.day;
    var total = day.items.length;
    var right = day.items.filter(function (it) { return it.correct === true; }).length;
    var wrong = total - right;

    main.appendChild(el('h2', 'done-title', right === total ? 'Clean sweep.' : 'That’s today done.'));
    var sub = el('p', 'done-sub');
    sub.innerHTML = '<b>' + right + ' of ' + total + '</b> correct. ' +
      (wrong === 0 ? 'Nothing goes back in the pot.'
        : wrong + (wrong === 1 ? ' goes' : ' go') + ' back in the pot for another day.');
    main.appendChild(sub);
    main.appendChild(tickRow(day.items, -1, 'compact'));

    main.appendChild(el('p', 'section-label', 'Today’s questions'));
    var list = el('ul', 'recap');
    day.items.forEach(function (it) {
      var li = el('li', it.correct ? 'right' : 'wrong');
      var icon = el('span');
      icon.innerHTML = it.correct ? ICON.tick : ICON.cross;
      li.appendChild(icon);
      li.appendChild(el('span', null, byId[it.id].question));
      list.appendChild(li);
    });
    main.appendChild(list);

    var next = el('div', 'next-set');
    next.appendChild(el('span', null, 'Next set unlocks in'));
    var t = el('strong', null, '');
    next.appendChild(t);
    main.appendChild(next);

    function tick() {
      var now = new Date();
      var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      var s = Math.max(0, Math.floor((midnight - now) / 1000));
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      t.textContent = h + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
      if (dateKey(now) !== state.day.date) {
        ensureToday();
        render();
      }
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }
  /* ---------- no pinch / double-tap zoom ---------- */

  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  // double-tap zoom is disabled by `touch-action: manipulation` in styles.css

  /* ---------- day rollover when app is reopened ---------- */

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state && state.day && state.day.date !== dateKey()) {
      ensureToday();
      render();
    }
  });

  /* ---------- start ---------- */

  function start(data) {
    var list = Array.isArray(data) ? data : data.questions;
    bank = (list || []).filter(function (q) {
      return q && q.id && q.question && Array.isArray(q.options) && q.options.length >= 2 &&
        typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < q.options.length;
    });
    byId = {};
    bank.forEach(function (q) { byId[q.id] = q; });
    state = load();
    ensureToday();
    render();
  }

  fetch('questions.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(function () {
      main.innerHTML = '';
      main.appendChild(el('p', 'status error', 'Couldn’t load questions.json. Check you’re online for the first launch.'));
    });

  /* Service worker: checks for a new version on every launch and whenever the
     app comes back to the foreground, then reloads once to apply it. */
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloading) { hadController = true; return; }
      reloading = true;
      window.location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        reg.update();
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') reg.update();
        });
      }).catch(function () {});
    });
  }

  // exposed for testing only
  window.__cyberDaily = { drawDailySet: drawDailySet, freshState: freshState };
})();
