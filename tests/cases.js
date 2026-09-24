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
    var chord = function (root, id) { return T.chordNotes(root, id).map(function (n) { return n.name; }).join(' '); };
    safe(G, '#7 各和弦组成音', function () {
      check(G, '#7a G = G B D', chord('G', 'maj'), 'G B D');
      check(G, '#7b Cmaj7 = C E G B', chord('C', 'maj7'), 'C E G B');
      check(G, '#7c Dm7 = D F A C', chord('D', 'm7'), 'D F A C');
      check(G, '#7d G7 = G B D F', chord('G', '7'), 'G B D F');
      check(G, '#7e Bm7♭5 = B D F A', chord('B', 'm7b5'), 'B D F A');
    });
    // 把叠加结果整理成“音名:类型”，便于和写死的答案比较
    var summary = function (m) {
      return Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).map(function (pc) {
        var v = m[pc]; return v.name + ':' + v.kind + (v.outside ? ':调外' : '') + (v.scaleRoot ? ':描边' : '');
      });
    };
    safe(G, '#8 C 大调 + G7', function () {
      var m = T.combine('C', 'major', 'G', '7');
      check(G, '#8a 七个音阶音都显示；G B D F 高亮，C 有描边', summary(m),
        ['C:muted:描边', 'D:chord', 'E:muted', 'F:chord', 'G:chord', 'A:muted', 'B:chord']);
      check(G, '#8b G 是红色根音', m[7].role, 'root');
      check(G, '#8c 以和弦根音为准：C 显示 4、B 显示 3、F 显示 ♭7', [m[0].degree, m[11].degree, m[5].degree], ['4', '3', '♭7']);
    });
    safe(G, '#9 C 大调 + E7', function () {
      var m = T.combine('C', 'major', 'E', '7');
      check(G, '#9a E G♯ B D 高亮，G♯ 标为调外音', summary(m),
        ['C:muted:描边', 'D:chord', 'E:chord', 'F:muted', 'G:muted', 'G♯:chord:调外', 'A:muted', 'B:chord']);
    });
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

    // ---------- 和弦（对照乐理书） ----------
    G = '和弦组成音';
    safe(G, '和弦', function () {
      var BOOK = [
        ['C', 'maj', 'C', 'C E G'], ['C', 'm', 'Cm', 'C E♭ G'], ['C', 'dim', 'Cdim', 'C E♭ G♭'], ['C', 'aug', 'Caug', 'C E G♯'],
        ['C', 'maj7', 'Cmaj7', 'C E G B'], ['C', 'm7', 'Cm7', 'C E♭ G B♭'], ['C', '7', 'C7', 'C E G B♭'],
        ['C', 'm7b5', 'Cm7♭5', 'C E♭ G♭ B♭'], ['C', 'dim7', 'Cdim7', 'C E♭ G♭ B𝄫'],
        ['F♯', 'm7', 'F♯m7', 'F♯ A C♯ E'], ['B♭', '7', 'B♭7', 'B♭ D F A♭'], ['E♭', 'maj7', 'E♭maj7', 'E♭ G B♭ D'],
        ['A', 'dim7', 'Adim7', 'A C E♭ G♭'], ['G', 'aug', 'Gaug', 'G B D♯'], ['B', 'dim', 'Bdim', 'B D F'],
        ['D♭', 'maj7', 'D♭maj7', 'D♭ F A♭ C'], ['E', 'm', 'Em', 'E G B'], ['A♭', '7', 'A♭7', 'A♭ C E♭ G♭'],
        ['C♯', 'm7b5', 'C♯m7♭5', 'C♯ E G B'], ['D', '7', 'D7', 'D F♯ A C']
      ];
      BOOK.forEach(function (x) {
        check(G, x[2] + ' = ' + x[3], [T.chordSymbol(x[0], x[1]), chord(x[0], x[1])], [x[2], x[3]]);
      });
    });

    G = '两音之间是几级（叠加时用）';
    safe(G, '音级', function () {
      [['G', 'F', '♭7'], ['G', 'C', '4'], ['G', 'A', '2'], ['G', 'E', '6'], ['E', 'C', '♭6'], ['E', 'F', '♭2'],
       ['A', 'C', '♭3'], ['C', 'F♯', '♯4'], ['C', 'G♭', '♭5'], ['B♭', 'A', '7'], ['D', 'D', '1']].forEach(function (x) {
        check(G, x[0] + ' → ' + x[1] + ' = ' + x[2], T.degreeBetween(x[0], x[1]), x[2]);
      });
      var m = T.combine('C', 'none', 'A', 'm7');
      check(G, '只开和弦（Am7）：只有 A C E G，没有淡色音', summary(m), ['C:chord', 'E:chord', 'G:chord', 'A:chord']);
      var m2 = T.combine('A', 'minor-pentatonic', 'none', 'none');
      check(G, '只开音阶：和第 2 步一样', summary(m2), ['C:scale', 'D:scale', 'E:scale', 'G:scale', 'A:scale']);
      var m3 = T.combine('C', 'major', 'C', 'maj');
      check(G, 'C 大调 + C：C 既是和弦根音也有描边', m3[0].kind + (m3[0].scaleRoot ? ':描边' : ''), 'chord:描边');
    });

    G = '全面检查：17 个根音 × 9 种和弦';
    safe(G, '全部组合', function () {
      var SEMI = { 'maj': [0, 4, 7], 'm': [0, 3, 7], 'dim': [0, 3, 6], 'aug': [0, 4, 8], 'maj7': [0, 4, 7, 11],
        'm7': [0, 3, 7, 10], '7': [0, 4, 7, 10], 'm7b5': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9] };
      var LET = 'CDEFGAB', PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      var ACC = { '': 0, '♭': -1, '𝄫': -2, '♯': 1, '𝄪': 2 };
      var ROOTS17 = ['C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];
      var ORDER = ['maj', 'm', 'dim', 'aug', 'maj7', 'm7', '7', 'm7b5', 'dim7']; // 注意：不能用 Object.keys，数字名“7”会被排到最前
      check(G, '和弦正好是这 9 种', T.CHORDS.map(function (x) { return x.id; }), ORDER);
      var bad = [], count = 0;
      ROOTS17.forEach(function (root) {
        var rl = root[0], rpc = (PCS[rl] + ACC[root.slice(1)] + 12) % 12;
        ORDER.forEach(function (id) {
          T.chordNotes(root, id).forEach(function (n, i) {
            count++;
            var letter = n.name[0], acc = n.name.slice(1);
            var okPc = (acc in ACC) && (PCS[letter] + ACC[acc] + 24) % 12 === (rpc + SEMI[id][i]) % 12;
            var okLetter = letter === LET[(LET.indexOf(rl) + 2 * i) % 7]; // 三度叠置：字母隔一个
            if (!okPc || !okLetter) bad.push(root + id + ' 第' + (i + 1) + '音 ' + n.name);
          });
        });
      });
      check(G, '全部 ' + count + ' 个和弦音的音高和字母都正确（按三度叠置）', bad, []);
    });

    // ---------- v0.3 顺阶和弦：标准答案（全部独立写死，不借用 theory.js 的数据） ----------
    G = '顺阶和弦（标准答案）';
    var dia = function (root, sc, size) {
      return T.diatonicChords(root, sc, size).map(function (x) { return x.roman + ' ' + x.symbol; }).join(' | ');
    };
    safe(G, '顺阶和弦', function () {
      var BOOK = [
        ['C', 'major', 3, 'I C | ii Dm | iii Em | IV F | V G | vi Am | vii° Bdim'],
        ['C', 'major', 4, 'Imaj7 Cmaj7 | ii7 Dm7 | iii7 Em7 | IVmaj7 Fmaj7 | V7 G7 | vi7 Am7 | viiø7 Bm7♭5'],
        ['F', 'major', 3, 'I F | ii Gm | iii Am | IV B♭ | V C | vi Dm | vii° Edim'],
        ['F', 'major', 4, 'Imaj7 Fmaj7 | ii7 Gm7 | iii7 Am7 | IVmaj7 B♭maj7 | V7 C7 | vi7 Dm7 | viiø7 Em7♭5'],
        ['E', 'major', 3, 'I E | ii F♯m | iii G♯m | IV A | V B | vi C♯m | vii° D♯dim'],
        ['E', 'major', 4, 'Imaj7 Emaj7 | ii7 F♯m7 | iii7 G♯m7 | IVmaj7 Amaj7 | V7 B7 | vi7 C♯m7 | viiø7 D♯m7♭5'],
        ['A', 'natural-minor', 3, 'i Am | ii° Bdim | III C | iv Dm | v Em | VI F | VII G'],
        ['A', 'natural-minor', 4, 'i7 Am7 | iiø7 Bm7♭5 | IIImaj7 Cmaj7 | iv7 Dm7 | v7 Em7 | VImaj7 Fmaj7 | VII7 G7'],
        // 理论调：根音会用到 E♯、B♯
        ['C♯', 'major', 3, 'I C♯ | ii D♯m | iii E♯m | IV F♯ | V G♯ | vi A♯m | vii° B♯dim'],
        // 五声、布鲁斯按母音阶
        ['C', 'major-pentatonic', 3, 'I C | ii Dm | iii Em | IV F | V G | vi Am | vii° Bdim'],
        ['A', 'minor-pentatonic', 4, 'i7 Am7 | iiø7 Bm7♭5 | IIImaj7 Cmaj7 | iv7 Dm7 | v7 Em7 | VImaj7 Fmaj7 | VII7 G7'],
        ['E', 'blues', 3, 'i Em | ii° F♯dim | III G | iv Am | v Bm | VI C | VII D']
      ];
      var CN = { 'major': '大调', 'natural-minor': '自然小调', 'major-pentatonic': '大调五声（按大调）',
        'minor-pentatonic': '小调五声（按自然小调）', 'blues': '布鲁斯（按自然小调）' };
      BOOK.forEach(function (x) {
        check(G, x[0] + ' ' + CN[x[1]] + (x[2] === 4 ? ' 七和弦' : ' 三和弦') + '：' + x[3], dia(x[0], x[1], x[2]), x[3]);
      });
      var notesOf = function (root, sc, size, step) { return T.diatonicChords(root, sc, size)[step - 1].notes.join(' '); };
      check(G, 'C 大调 V7 = G B D F', notesOf('C', 'major', 4, 5), 'G B D F');
      check(G, 'F 大调 IVmaj7 = B♭ D F A', notesOf('F', 'major', 4, 4), 'B♭ D F A');
      check(G, 'C♯ 大调 iii = E♯ G♯ B♯', notesOf('C♯', 'major', 3, 3), 'E♯ G♯ B♯');
      check(G, '没选音阶时没有顺阶和弦', T.diatonicChords('C', 'none', 3), []);
      check(G, '母音阶：大调五声→大调，小调五声、布鲁斯→自然小调，大调/自然小调→自己',
        ['major', 'natural-minor', 'major-pentatonic', 'minor-pentatonic', 'blues'].map(T.diatonicBase),
        ['major', 'natural-minor', 'major', 'natural-minor', 'natural-minor']);
      var mt = function (r, sc, cr, c) { var m = T.diatonicMatch(r, sc, cr, c); return m ? m.size + ':' + m.item.roman : null; };
      check(G, '认出顺阶和弦：C 大调里 G7 是 V7、G 是 V、Bm7♭5 是 viiø7', [mt('C', 'major', 'G', '7'), mt('C', 'major', 'G', 'maj'), mt('C', 'major', 'B', 'm7b5')], ['4:V7', '3:V', '4:viiø7']);
      check(G, '不是顺阶和弦：C 大调里 E7、Gm、C7 都不是', [mt('C', 'major', 'E', '7'), mt('C', 'major', 'G', 'm'), mt('C', 'major', 'C', '7')], [null, null, null]);
      check(G, '按音高认：C♯ 大调里下拉框选 Fm 也算 iii', mt('C♯', 'major', 'F', 'm'), '3:iii');
      check(G, '没开和弦时不算', mt('C', 'major', 'C', 'none'), null);
      check(G, '理论写法换常用写法：E♯→F、B♯→C、F𝄪→G、C𝄪→D、C♭→B、B𝄫→A、F♭→E',
        ['E♯', 'B♯', 'F𝄪', 'C𝄪', 'C♭', 'B𝄫', 'F♭'].map(T.simplifyNote), ['F', 'C', 'G', 'D', 'B', 'A', 'E']);
      check(G, '没有本位音时跟原来的升降号走：B𝄪→C♯、F𝄫→E♭', ['B𝄪', 'F𝄫'].map(T.simplifyNote), ['C♯', 'E♭']);
      check(G, '常用写法保持不变：C♯、D♭、G♭、A♯', ['C♯', 'D♭', 'G♭', 'A♯'].map(T.simplifyNote), ['C♯', 'D♭', 'G♭', 'A♯']);
    });

    G = '全面检查：17 个根音 × 大调/自然小调的顺阶和弦';
    safe(G, '全部组合', function () {
      var ROOTS17 = ['C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];
      // 独立写的标准：大调、自然小调每一级的和弦类型和罗马数字
      var EXPECT = {
        'major': { 3: ['maj', 'm', 'm', 'maj', 'maj', 'm', 'dim'], 4: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'],
          r3: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], r4: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'] },
        'natural-minor': { 3: ['m', 'dim', 'maj', 'm', 'm', 'maj', 'maj'], 4: ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'],
          r3: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'], r4: ['i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'VImaj7', 'VII7'] }
      };
      var badType = [], badRoman = [], badRoot = [], badNotes = [], count = 0;
      ROOTS17.forEach(function (root) {
        ['major', 'natural-minor'].forEach(function (sc) {
          var scaleNames = T.scaleNotes(root, sc).map(function (n) { return n.name; });
          [3, 4].forEach(function (size) {
            var list = T.diatonicChords(root, sc, size);
            list.forEach(function (x, i) {
              count++;
              var tag = root + ' ' + sc + ' ' + size + '音 第' + (i + 1) + '级 ' + x.symbol;
              if (x.chord !== EXPECT[sc][size][i]) badType.push(tag);
              if (x.roman !== EXPECT[sc]['r' + size][i]) badRoman.push(tag + ' ' + x.roman);
              if (x.root !== scaleNames[i]) badRoot.push(tag);
              // 组成音：和和弦库算出来的一致，且每个音都是音阶里的音（拼写也一样）
              var cn = T.chordNotes(x.root, x.chord).map(function (n) { return n.name; });
              if (cn.join(' ') !== x.notes.join(' ') || !cn.every(function (nm) { return scaleNames.indexOf(nm) >= 0; })) badNotes.push(tag);
            });
            if (list.length !== 7) badType.push(root + ' ' + sc + ' 不是 7 个');
          });
        });
      });
      check(G, '全部 ' + count + ' 个顺阶和弦的类型正确', badType, []);
      check(G, '罗马数字全部正确', badRoman, []);
      check(G, '和弦根音就是音阶第几级的音（按调拼写）', badRoot, []);
      check(G, '组成音全部在音阶里，拼写一致', badNotes, []);
    });

    // ---------- 全面检查：每根弦每一品 ----------
    G = '全面检查：指板每个位置';
    safe(G, '逐品', function () {
      // 独立写一份标准（不借用 theory.js 里的数据），这样 theory.js 出错时才能被发现
      var CHROMATIC = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
      var OPEN = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 }; // E B G D A E
      var bad = [];
      for (var s = 1; s <= 6; s++) {
        for (var f = 0; f <= 24; f++) { // 按最多 24 品检查
          var expected = pc(CHROMATIC[(OPEN[s] + f) % 12]);
          if (T.pcAt(s, f) !== expected) bad.push(s + '弦' + f + '品');
          if (f + 12 <= 24 && T.pcAt(s, f + 12) !== T.pcAt(s, f)) bad.push(s + '弦' + f + '品与+12品不同');
        }
      }
      check(G, '6 弦 × 25 个位置（0～24 品）全部正确，且隔 12 品同名', bad, []);
      check(G, '品数可选范围 12～24，默认 15', [T.MIN_FRETS, T.MAX_FRETS, T.FRET_COUNT], [12, 24, 15]);
      check(G, '1 弦 24 品是 E（高两个八度）', [T.pcAt(1, 24), T.midiAt(1, 24) - T.midiAt(1, 0)], [4, 24]);
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
