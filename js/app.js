/*
 * 界面：画指板。乐理计算都交给 theory.js。
 */
(function () {
  'use strict';
  var T = window.Theory;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // 布局尺寸（SVG 内部坐标，会自动缩放到窗口宽度）
  var L = {
    width: 1240,
    labelW: 36,     // 最左边弦名一栏
    openW: 60,      // 空弦（0 品）一栏
    right: 16,
    top: 30,        // 1 弦的 y 坐标
    stringGap: 42,  // 弦间距
    edge: 22        // 指板上下边缘超出最外侧弦的距离
  };
  L.nutX = L.labelW + L.openW;
  L.endX = L.width - L.right;
  L.bottomString = L.top + L.stringGap * 5;
  L.numY = L.bottomString + L.edge + 22;
  L.height = L.numY + 12;

  // 品丝位置：真实吉他越往高把位品格越窄。这里取“真实比例 60% + 等宽 40%”，
  // 既有真实感，高把位又不会挤得太窄
  function fretX(n) {
    var N = T.FRET_COUNT;
    var real = (1 - Math.pow(2, -n / 12)) / (1 - Math.pow(2, -N / 12));
    var t = 0.6 * real + 0.4 * (n / N);
    return L.nutX + t * (L.endX - L.nutX);
  }
  // 某一品的中心 x（按弦的位置），0 品在琴枕左边
  function slotX(fret) {
    return fret === 0 ? L.labelW + L.openW / 2 : (fretX(fret - 1) + fretX(fret)) / 2;
  }
  function stringY(s) { return L.top + (s - 1) * L.stringGap; }

  function el(name, attrs, parent) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  var SINGLE_INLAYS = [3, 5, 7, 9, 15];
  var DOUBLE_INLAYS = [12];
  var STRING_WIDTHS = { 1: 1.1, 2: 1.4, 3: 1.8, 4: 2.3, 5: 2.8, 6: 3.3 };

  function draw() {
    var svg = document.getElementById('fretboard');
    svg.setAttribute('viewBox', '0 0 ' + L.width + ' ' + L.height);
    svg.innerHTML = '';

    var yTop = L.top - L.edge, yBottom = L.bottomString + L.edge;

    // 指板底色
    el('rect', { class: 'board', x: L.nutX, y: yTop, width: L.endX - L.nutX, height: yBottom - yTop, rx: 3 }, svg);

    // 品位点：单点在 3、4 弦之间；12 品双点在 2、3 弦和 4、5 弦之间
    var inlays = el('g', { class: 'inlays' }, svg);
    var midY = (stringY(3) + stringY(4)) / 2;
    SINGLE_INLAYS.forEach(function (f) {
      el('circle', { class: 'inlay', cx: slotX(f), cy: midY, r: 7, 'data-fret': f }, inlays);
    });
    DOUBLE_INLAYS.forEach(function (f) {
      el('circle', { class: 'inlay', cx: slotX(f), cy: (stringY(2) + stringY(3)) / 2, r: 7, 'data-fret': f }, inlays);
      el('circle', { class: 'inlay', cx: slotX(f), cy: (stringY(4) + stringY(5)) / 2, r: 7, 'data-fret': f }, inlays);
    });

    // 品丝和琴枕
    var frets = el('g', { class: 'frets' }, svg);
    for (var n = 1; n <= T.FRET_COUNT; n++) {
      el('line', { class: 'fret', x1: fretX(n), y1: yTop, x2: fretX(n), y2: yBottom, 'data-fret': n }, frets);
    }
    el('rect', { class: 'nut', x: L.nutX - 3, y: yTop, width: 6, height: yBottom - yTop, rx: 1.5 }, svg);

    // 琴弦和弦名（1 弦在最上面）
    var strings = el('g', { class: 'strings' }, svg);
    T.STANDARD_TUNING.forEach(function (t) {
      var y = stringY(t.string);
      el('line', { class: 'string', x1: L.labelW + 8, y1: y, x2: L.endX, y2: y,
        'stroke-width': STRING_WIDTHS[t.string], 'data-string': t.string }, strings);
      var label = el('text', { class: 'string-label', x: L.labelW / 2, y: y, 'text-anchor': 'middle',
        'dominant-baseline': 'central' }, strings);
      label.textContent = t.name;
    });

    // 品号
    var nums = el('g', { class: 'fret-nums' }, svg);
    for (var f = 0; f <= T.FRET_COUNT; f++) {
      var marked = SINGLE_INLAYS.concat(DOUBLE_INLAYS).indexOf(f) >= 0;
      var txt = el('text', { class: 'fret-num' + (marked ? ' marked' : ''), x: slotX(f), y: L.numY,
        'text-anchor': 'middle', 'data-fret': f }, nums);
      txt.textContent = f;
    }

    // 每个位置一个占位点（以后音阶、和弦的彩色圆点就画在这里）
    var positions = el('g', { class: 'positions' }, svg);
    T.STANDARD_TUNING.forEach(function (t) {
      for (var f = 0; f <= T.FRET_COUNT; f++) {
        var g = el('g', { class: 'pos', 'data-string': t.string, 'data-fret': f,
          'data-pc': T.pcAt(t.string, f), 'data-midi': T.midiAt(t.string, f),
          transform: 'translate(' + slotX(f).toFixed(2) + ',' + stringY(t.string) + ')' }, positions);
        el('circle', { class: 'hit', r: 16 }, g);
        el('title', {}, g).textContent = t.string + ' 弦 ' + f + ' 品';
      }
    });
  }

  // ---------------- 圆点：音阶 + 和弦 ----------------

  var ROLE_NAMES = { root: '根音', third: '三音', fifth: '五音', seventh: '七音', other: '其他' };
  var KEY_VIEW = 'guitarTool.viewState';
  var DEFAULT_STATE = { root: 'C', scale: 'major', chordRoot: 'C', chord: 'none', label: 'name' };

  // 读取上次的设置（读不到或不合法就用默认值）
  function loadState() {
    var st = {};
    try { st = JSON.parse(window.localStorage.getItem(KEY_VIEW) || '{}') || {}; } catch (e) { st = {}; }
    var okRoot = function (r) { return T.ROOTS.indexOf(r) >= 0; };
    return {
      root: okRoot(st.root) ? st.root : DEFAULT_STATE.root,
      scale: st.scale === 'none' || T.SCALES.some(function (x) { return x.id === st.scale; }) ? st.scale : DEFAULT_STATE.scale,
      chordRoot: okRoot(st.chordRoot) ? st.chordRoot : DEFAULT_STATE.chordRoot,
      chord: st.chord === 'none' || T.CHORDS.some(function (x) { return x.id === st.chord; }) ? st.chord : DEFAULT_STATE.chord,
      label: ['name', 'degree', 'interval'].indexOf(st.label) >= 0 ? st.label : DEFAULT_STATE.label
    };
  }
  function saveState() {
    try { window.localStorage.setItem(KEY_VIEW, JSON.stringify(state)); } catch (e) {}
  }
  var state = loadState();

  function labelOf(note) {
    return state.label === 'degree' ? note.degree : state.label === 'interval' ? note.interval : note.name;
  }

  function renderDots() {
    var map = T.combine(state.root, state.scale, state.chordRoot, state.chord);
    var hasChord = state.chord !== 'none';
    document.querySelectorAll('#fretboard .pos').forEach(function (g) {
      var old = g.querySelector('.dot');
      if (old) g.removeChild(old);
      var info = map[+g.getAttribute('data-pc')];
      if (!info) return;
      var text = labelOf(info);
      var cls = 'dot kind-' + info.kind + ' role-' + info.role + (text.length > 2 ? ' small' : '');
      var dot = el('g', { class: cls, 'data-kind': info.kind, 'data-name': info.name, 'data-degree': info.degree,
        'data-interval': info.interval, 'data-role': info.role,
        'data-outside': info.outside ? '1' : '0', 'data-scale-root': info.scaleRoot && hasChord ? '1' : '0' }, g);
      if (info.scaleRoot && hasChord) el('circle', { class: 'ring scale-root-ring', r: 19 }, dot);
      if (info.outside) el('circle', { class: 'ring outside-ring', r: 19 }, dot);
      el('circle', { class: 'body', r: info.kind === 'muted' ? 13 : 15 }, dot);
      el('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0.5 }, dot).textContent = text;
    });
    renderLegend(map);
  }

  function chip(n, cls) {
    return '<span class="lg-note ' + cls + '"><b>' + n.name + '</b><small>' + n.degree + ' · ' + n.interval + '</small></span>';
  }

  function renderLegend(map) {
    var box = document.getElementById('legend');
    var hasScale = state.scale !== 'none', hasChord = state.chord !== 'none';
    if (!hasScale && !hasChord) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    var html = '<div class="lg-lines">';
    if (hasChord) {
      var cn = T.chordNotes(state.chordRoot, state.chord);
      html += '<div class="lg-notes" id="lg-chord"><span class="lg-title" id="lg-chord-title">'
        + T.chordSymbol(state.chordRoot, state.chord) + '</span>';
      cn.forEach(function (n) {
        var out = map[n.pc] && map[n.pc].outside;
        html += chip(n, 'role-' + n.role + (out ? ' outside' : ''));
      });
      html += '</div>';
    }
    if (hasScale) {
      var sc = T.getScale(state.scale);
      html += '<div class="lg-notes" id="lg-scale"><span class="lg-title" id="lg-title">' + state.root + ' ' + sc.name + '</span>';
      T.scaleNotes(state.root, state.scale).forEach(function (n) {
        html += chip(n, hasChord ? 'kind-muted' + (n.degree === '1' ? ' scale-root' : '') : 'role-' + n.role);
      });
      html += '</div>';
    }
    html += '</div><div class="lg-keys">';
    ['root', 'third', 'fifth', 'seventh', 'other'].forEach(function (r) {
      if (r === 'other' && hasChord) return; // 和弦里没有“其他”
      html += '<span class="lg-key role-' + r + '"><i></i>' + ROLE_NAMES[r] + '</span>';
    });
    if (hasChord && hasScale) {
      html += '<span class="lg-key kind-muted"><i></i>其他音阶音</span>'
        + '<span class="lg-key scale-root"><i></i>音阶根音</span>'
        + '<span class="lg-key outside"><i></i>调外音</span>';
    }
    box.innerHTML = html + '</div>';
  }

  function fillSelect(sel, items, withNone) {
    if (withNone) { var o = document.createElement('option'); o.value = 'none'; o.textContent = '（不显示）'; sel.appendChild(o); }
    items.forEach(function (it) {
      var op = document.createElement('option'); op.value = it[0]; op.textContent = it[1]; sel.appendChild(op);
    });
  }

  function setupControls() {
    var roots = T.ROOTS.map(function (r) { return [r, r]; });
    var bind = function (id, key, items, withNone) {
      var sel = document.getElementById(id);
      fillSelect(sel, items, withNone);
      sel.value = state[key];
      sel.addEventListener('change', function () { state[key] = sel.value; saveState(); renderDots(); });
    };
    bind('root-select', 'root', roots, false);
    bind('scale-select', 'scale', T.SCALES.map(function (x) { return [x.id, x.name]; }), true);
    bind('chord-root-select', 'chordRoot', roots, false);
    bind('chord-select', 'chord', T.CHORDS.map(function (x) { return [x.id, x.name + '（' + (x.symbol || '大三') + '）']; }), true);

    var seg = document.getElementById('label-mode');
    function syncSeg() {
      seg.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-checked', b.getAttribute('data-label') === state.label ? 'true' : 'false');
      });
    }
    seg.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { state.label = b.getAttribute('data-label'); saveState(); syncSeg(); renderDots(); });
    });
    syncSeg();
  }

  draw();
  setupControls();
  renderDots();
})();
