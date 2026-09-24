/*
 * 全部乐理检查项。命令行测试（tests/run.js）和自检页（自检.html）共用这一份。
 * 每一项结果：pass = 通过，fail = 失败，todo = 功能还没做（待实现）
 */
(function (root) {
  'use strict';

  function runAll(T) {
    var results = [];

    function check(group, name, actual, expected) {
      var a = JSON.stringify(actual), e = JSON.stringify(expected);
      results.push({ group: group, name: name, status: a === e ? 'pass' : 'fail', actual: a, expected: e });
    }
    function todo(group, name) {
      results.push({ group: group, name: name, status: 'todo' });
    }
    function safe(group, name, fn) {
      try { fn(); } catch (err) {
        results.push({ group: group, name: name, status: 'fail', actual: '出错：' + err.message, expected: '' });
      }
    }
    var pc = function (n) { return T.parseNote(n).pc; };

    // ---------- 标准答案（需求文档第 4 节） ----------
    var G = '标准答案';
    var names = function (root, sc) { return T.scaleNotes(root, sc).map(function (n) { return n.name; }); };
    // 在音阶里时返回该音的音名，否则返回 null（模拟指板上某个位置显示什么）
    var labelAt = function (root, sc, s, f) { var n = T.findByPc(T.scaleNotes(root, sc), T.pcAt(s, f)); return n ? n.name : null; };
    safe(G, '#1 C 大调', function () {
      check(G, '#1a C 大调 = C D E F G A B', names('C', 'major'), ['C', 'D', 'E', 'F', 'G', 'A', 'B']);
      var n = T.findByPc(T.scaleNotes('C', 'major'), T.pcAt(5, 3));
      check(G, '#1b 5 弦 3 品是 C，且是根音', n && [n.name, n.role], ['C', 'root']);
    });
    safe(G, '#2 F 大调', function () {
      check(G, '#2a F 大调 = F G A B♭ C D E', names('F', 'major'), ['F', 'G', 'A', 'B♭', 'C', 'D', 'E']);
      check(G, '#2b 3 弦 3 品显示 B♭（不是 A♯）', labelAt('F', 'major', 3, 3), 'B♭');
    });
    safe(G, '#3 E 大调', function () {
      check(G, '#3 E 大调 = E F♯ G♯ A B C♯ D♯', names('E', 'major'), ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯']);
    });
    safe(G, '#4 A 小调五声', function () {
      var got = [];
      for (var s = 1; s <= 6; s++) for (var f = 5; f <= 8; f++) if (labelAt('A', 'minor-pentatonic', s, f)) got.push(s + '弦' + f + '品');
      check(G, '#4 A 小调五声 5～8 品的位置', got,
        ['1弦5品', '1弦8品', '2弦5品', '2弦8品', '3弦5品', '3弦7品', '4弦5品', '4弦7品', '5弦5品', '5弦7品', '6弦5品', '6弦8品']);
    });
    safe(G, '#5 A 小调五声 音级', function () {
      check(G, '#5 A 小调五声音级 = 1 ♭3 4 5 ♭7', T.scaleNotes('A', 'minor-pentatonic').map(function (n) { return n.degree; }), ['1', '♭3', '4', '5', '♭7']);
    });
    safe(G, '#6 A 布鲁斯', function () {
      check(G, '#6 A 布鲁斯 = A C D E♭ E G', names('A', 'blues'), ['A', 'C', 'D', 'E♭', 'E', 'G']);
    });
    todo(G, '#7 各和弦组成音');
    todo(G, '#8 C 大调 + G7 叠加');
    todo(G, '#9 C 大调 + E7 叠加（G♯ 为调外音）');
    safe(G, '#10 指板位置', function () {
      check(G, '#10a 6 弦 0 品是 E', T.pcAt(6, 0), pc('E'));
      check(G, '#10b 6 弦 12 品是 E', T.pcAt(6, 12), pc('E'));
      check(G, '#10c 1 弦 15 品是 G', T.pcAt(1, 15), pc('G'));
    });

    // ---------- 音名解析 ----------
    G = '音名解析';
    safe(G, '解析', function () {
      check(G, 'C = 0', pc('C'), 0);
      check(G, 'B♭ = 10', pc('B♭'), 10);
      check(G, 'Bb 与 B♭ 相同', T.parseNote('Bb').name, 'B♭');
      check(G, 'C# 与 C♯ 相同', T.parseNote('C#').name, 'C♯');
      check(G, 'B♯ = C（0）', pc('B♯'), 0);
      check(G, 'C♭ = B（11）', pc('C♭'), 11);
      check(G, 'F𝄪 = G（7）', pc('F𝄪'), 7);
      check(G, 'B𝄫 = A（9）', pc('B𝄫'), 9);
      check(G, 'E♯ = F（5）', pc('E♯'), 5);
    });

    // ---------- 标准调弦 ----------
    G = '标准调弦';
    safe(G, '空弦', function () {
      var expectOpen = { 1: 'E', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };
      for (var s = 1; s <= 6; s++) {
        check(G, s + ' 弦空弦是 ' + expectOpen[s], T.pcAt(s, 0), pc(expectOpen[s]));
      }
      check(G, '6 弦比 1 弦低两个八度', T.midiAt(1, 0) - T.midiAt(6, 0), 24);
      check(G, '5 弦 5 品 = 4 弦空弦（同音）', T.midiAt(5, 5), T.midiAt(4, 0));
      check(G, '3 弦 4 品 = 2 弦空弦（同音，G-B 弦差大三度）', T.midiAt(3, 4), T.midiAt(2, 0));
      check(G, '5 弦 3 品是 C', T.pcAt(5, 3), pc('C'));
      check(G, '3 弦 3 品是 B♭', T.pcAt(3, 3), pc('B♭'));
    });

    // ---------- 音级拼写与音程名 ----------
    G = '音级拼写与音程名';
    safe(G, '拼写', function () {
      [['C', '𝄫7', 'B𝄫'], ['B♭', '♭5', 'F♭'], ['E', '♯5', 'B♯'], ['D♯', '3', 'F𝄪'], ['G♭', '4', 'C♭'],
       ['A', '♭3', 'C'], ['F', '7', 'E'], ['C♯', '7', 'B♯'], ['A♭', '♭7', 'G♭']].forEach(function (x) {
        check(G, x[0] + ' 的 ' + x[1] + ' 级 = ' + x[2], T.spellDegree(x[0], x[1]).name, x[2]);
      });
      [['1', 'R'], ['2', 'M2'], ['♭3', 'm3'], ['3', 'M3'], ['4', 'P4'], ['♭5', 'd5'], ['5', 'P5'], ['♯5', 'A5'],
       ['♭6', 'm6'], ['6', 'M6'], ['𝄫7', 'd7'], ['♭7', 'm7'], ['7', 'M7']].forEach(function (x) {
        check(G, x[0] + ' 级的音程名 = ' + x[1], T.intervalName(x[0]), x[1]);
      });
    });

    // ---------- 常见调的音阶（对照乐理书） ----------
    G = '常见调的音阶';
    safe(G, '调', function () {
      var BOOK = [
        ['G', 'major', 'G A B C D E F♯'], ['D', 'major', 'D E F♯ G A B C♯'], ['A', 'major', 'A B C♯ D E F♯ G♯'],
        ['B', 'major', 'B C♯ D♯ E F♯ G♯ A♯'], ['F♯', 'major', 'F♯ G♯ A♯ B C♯ D♯ E♯'],
        ['B♭', 'major', 'B♭ C D E♭ F G A'], ['E♭', 'major', 'E♭ F G A♭ B♭ C D'], ['A♭', 'major', 'A♭ B♭ C D♭ E♭ F G'],
        ['D♭', 'major', 'D♭ E♭ F G♭ A♭ B♭ C'], ['G♭', 'major', 'G♭ A♭ B♭ C♭ D♭ E♭ F'],
        ['A', 'natural-minor', 'A B C D E F G'], ['E', 'natural-minor', 'E F♯ G A B C D'],
        ['C', 'natural-minor', 'C D E♭ F G A♭ B♭'], ['F♯', 'natural-minor', 'F♯ G♯ A B C♯ D E'],
        ['G', 'major-pentatonic', 'G A B D E'], ['C', 'major-pentatonic', 'C D E G A'],
        ['E', 'minor-pentatonic', 'E G A B D'], ['D', 'minor-pentatonic', 'D F G A C'],
        ['E', 'blues', 'E G A B♭ B D'], ['G', 'blues', 'G B♭ C D♭ D F']
      ];
      var CN = { 'major': '大调', 'natural-minor': '自然小调', 'major-pentatonic': '大调五声', 'minor-pentatonic': '小调五声', 'blues': '布鲁斯' };
      BOOK.forEach(function (x) {
        check(G, x[0] + ' ' + CN[x[1]] + ' = ' + x[2], names(x[0], x[1]).join(' '), x[2]);
      });
    });

    // ---------- 全面检查：17 个根音 × 5 种音阶 ----------
    G = '全面检查：17 个根音 × 5 种音阶';
    safe(G, '全部组合', function () {
      // 独立写的标准：每种音阶相对根音的半音数、字母相隔几个
      var SEMI = { 'major': [0, 2, 4, 5, 7, 9, 11], 'natural-minor': [0, 2, 3, 5, 7, 8, 10],
        'major-pentatonic': [0, 2, 4, 7, 9], 'minor-pentatonic': [0, 3, 5, 7, 10], 'blues': [0, 3, 5, 6, 7, 10] };
      var STEP = { 'major': [0, 1, 2, 3, 4, 5, 6], 'natural-minor': [0, 1, 2, 3, 4, 5, 6],
        'major-pentatonic': [0, 1, 2, 4, 5], 'minor-pentatonic': [0, 2, 3, 4, 6], 'blues': [0, 2, 3, 4, 4, 6] };
      var LET = 'CDEFGAB', PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      var ACC = { '': 0, '♭': -1, '𝄫': -2, '♯': 1, '𝄪': 2 };
      var ROOTS17 = ['C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];
      check(G, '可选根音正好是这 17 个', T.ROOTS, ROOTS17);
      check(G, '音阶正好是这 5 种', T.SCALES.map(function (x) { return x.id; }), Object.keys(SEMI));
      var badPc = [], badLetter = [], badAcc = [], count = 0;
      ROOTS17.forEach(function (root) {
        var rl = root[0], rpc = (PCS[rl] + ACC[root.slice(1)] + 12) % 12;
        Object.keys(SEMI).forEach(function (sc) {
          var ns = T.scaleNotes(root, sc);
          ns.forEach(function (n, i) {
            count++;
            var tag = root + ' ' + sc + ' 第' + (i + 1) + '音 ' + n.name;
            var letter = n.name[0], acc = n.name.slice(1);
            if (!(acc in ACC)) { badAcc.push(tag); return; }
            if ((PCS[letter] + ACC[acc] + 24) % 12 !== (rpc + SEMI[sc][i]) % 12) badPc.push(tag);
            if (letter !== LET[(LET.indexOf(rl) + STEP[sc][i]) % 7]) badLetter.push(tag);
          });
        });
      });
      check(G, '全部 ' + count + ' 个音的音高都正确', badPc, []);
      check(G, '全部音的字母都正确（七声音阶正好用到七个不同字母）', badLetter, []);
      check(G, '升降号都不超过两个', badAcc, []);
    });

    // ---------- 全面检查：每根弦每一品 ----------
    G = '全面检查：指板每个位置';
    safe(G, '逐品', function () {
      // 独立写一份标准（不借用 theory.js 里的数据），这样 theory.js 出错时才能被发现
      var CHROMATIC = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
      var OPEN = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 }; // E B G D A E
      var bad = [];
      for (var s = 1; s <= 6; s++) {
        for (var f = 0; f <= T.FRET_COUNT; f++) {
          var expected = pc(CHROMATIC[(OPEN[s] + f) % 12]);
          if (T.pcAt(s, f) !== expected) bad.push(s + '弦' + f + '品');
          if (f + 12 <= T.FRET_COUNT && T.pcAt(s, f + 12) !== T.pcAt(s, f)) bad.push(s + '弦' + f + '品与+12品不同');
        }
      }
      check(G, '6 弦 × 16 个位置全部正确，且隔 12 品同名', bad, []);
    });

    return results;
  }

  function summarize(results) {
    var s = { pass: 0, fail: 0, todo: 0, total: results.length };
    results.forEach(function (r) { s[r.status]++; });
    return s;
  }

  var api = { runAll: runAll, summarize: summarize };
  root.TheoryTests = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
