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

  draw();
})();
