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
    todo(G, '#1 C 大调');
    todo(G, '#2 F 大调（B♭ 而非 A♯）');
    todo(G, '#3 E 大调');
    todo(G, '#4 A 小调五声 5～8 品位置');
    todo(G, '#5 A 小调五声 音级显示');
    todo(G, '#6 A 布鲁斯（E♭）');
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
