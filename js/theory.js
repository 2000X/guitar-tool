/*
 * 乐理核心：只负责计算，不碰界面。
 * 这个文件既能在浏览器里用（window.Theory），也能在测试程序里用（require）。
 */
(function (root) {
  'use strict';

  // 七个字母音名，以及它们各自的音高（C = 0，每升一个半音 +1，一个八度 12 个半音）
  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // 升降记号：重降、降、还原、升、重升
  var ACCIDENTALS = { '𝄫': -2, '♭': -1, '': 0, '♯': 1, '𝄪': 2 };

  // 标准调弦，按弦号排：1 弦 = 最细的高音 E，6 弦 = 最粗的低音 E
  // midi 是音高编号（中央 C = 60），用来区分同名但不同八度的音
  var STANDARD_TUNING = [
    { string: 1, name: 'E', midi: 64 },
    { string: 2, name: 'B', midi: 59 },
    { string: 3, name: 'G', midi: 55 },
    { string: 4, name: 'D', midi: 50 },
    { string: 5, name: 'A', midi: 45 },
    { string: 6, name: 'E', midi: 40 }
  ];

  var FRET_COUNT = 15; // 默认显示 0～15 品
  var MIN_FRETS = 12, MAX_FRETS = 24; // 品数可在 12～24 之间调整

  function mod12(n) { return ((n % 12) + 12) % 12; }

  // 把 'B♭'、'Bb'、'C#'、'F##'、'Cx' 等写法统一解析
  function parseNote(name) {
    var m = /^([A-Ga-g])(.*)$/.exec(String(name).trim());
    if (!m) throw new Error('无法识别的音名：' + name);
    var letter = m[1].toUpperCase();
    var acc = m[2]
      .replace(/##|x/g, '𝄪')
      .replace(/bb/g, '𝄫')
      .replace(/#/g, '♯')
      .replace(/b/g, '♭');
    if (!Object.prototype.hasOwnProperty.call(ACCIDENTALS, acc)) {
      throw new Error('无法识别的升降号：' + name);
    }
    var alter = ACCIDENTALS[acc];
    return { letter: letter, alter: alter, pc: mod12(LETTER_PC[letter] + alter), name: letter + acc };
  }

  function openString(stringNo, tuning) {
    var t = (tuning || STANDARD_TUNING).filter(function (s) { return s.string === stringNo; })[0];
    if (!t) throw new Error('没有第 ' + stringNo + ' 弦');
    return t;
  }

  // 某根弦某一品的音高编号
  function midiAt(stringNo, fret, tuning) {
    return openString(stringNo, tuning).midi + fret;
  }

  // 某根弦某一品的音级类别（0～11，不分八度）
  function pcAt(stringNo, fret, tuning) {
    return mod12(midiAt(stringNo, fret, tuning));
  }


  // ---------------- 音级、拼写、音程 ----------------

  // 大调里各级相对根音的半音数：1 级 0，2 级 2，3 级 4……（音级的“基准”）
  // 9、11、13 是高八度的 2、4、6（延伸音），在和弦里按和弦习惯写成 9、11、13
  var MAJOR_SEMITONES = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 };
  var ALTER_SYMBOL = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };

  // 解析音级写法：'1'、'♭3'、'♯5'、'𝄫7'、'9'、'♯9'、'11'、'13'（也接受 b3、#5、bb7）
  function parseDegree(text) {
    var m = /^(𝄫|♭♭|bb|♭|b|♯|#|𝄪|##|x)?(1[13]|[1-79])$/.exec(String(text).trim());
    if (!m) throw new Error('无法识别的音级：' + text);
    var acc = m[1] || '';
    var alter = { '': 0, '♭': -1, 'b': -1, '𝄫': -2, '♭♭': -2, 'bb': -2, '♯': 1, '#': 1, '𝄪': 2, '##': 2, 'x': 2 }[acc];
    return { number: +m[2], alter: alter, text: ALTER_SYMBOL[alter] + m[2] };
  }

  // 按“根音字母 + 音级”严格拼写：例如 F 的 4 级 → 字母 B，比 B 低半音 → B♭
  function spellDegree(rootName, degreeText) {
    var root = parseNote(rootName), d = parseDegree(degreeText);
    var letter = LETTERS[(LETTERS.indexOf(root.letter) + d.number - 1) % 7];
    var pc = mod12(root.pc + MAJOR_SEMITONES[d.number] + d.alter);
    var alter = mod12(pc - LETTER_PC[letter] + 6) - 6; // 化到 -6～5 之间
    if (alter < -2 || alter > 2) throw new Error(rootName + ' 的 ' + degreeText + ' 需要三个升降号，无法拼写');
    return { letter: letter, alter: alter, pc: pc, name: letter + ALTER_SYMBOL[alter] };
  }

  // 音程名：1 级显示 R（根音），其余如 m3、M3、P5、d5、A5；延伸音如 M9、A9、P11、M13
  function intervalName(degreeText) {
    var d = parseDegree(degreeText);
    if (d.number === 1 && d.alter === 0) return 'R';
    var perfect = d.number === 1 || d.number === 4 || d.number === 5 || d.number === 11;
    var q = perfect
      ? { '-2': 'dd', '-1': 'd', '0': 'P', '1': 'A', '2': 'AA' }[d.alter]
      : { '-2': 'd', '-1': 'm', '0': 'M', '1': 'A', '2': 'AA' }[d.alter];
    return q + d.number;
  }

  // 音级在和弦骨架里的角色，决定颜色：根音 / 三音 / 五音 / 七音 / 其他
  // inChord 为真时（和弦里），2、4、6、9、11、13 算“延伸音”（ext，单独一种颜色）；音阶里仍算“其他”
  function roleOf(degreeText, inChord) {
    var n = parseDegree(degreeText).number;
    return { 1: 'root', 3: 'third', 5: 'fifth', 7: 'seventh' }[n] || (inChord ? 'ext' : 'other');
  }

  // ---------------- 音阶 ----------------
  // group：下拉框里的分组；label：下拉框里显示的名字（调式附英文名，方便对照资料）
  // roles 可以单独指定某个音级的角色（如布鲁斯的 ♭5 是“蓝调音”，不算五音）
  // parent 是“母音阶”：五声、布鲁斯不是七声音阶，顺阶和弦按母音阶来算
  // modeOf：是大调的第几个调式（关系说明：D 多利亚 = C 大调从第 2 个音开始）
  // character + compare：特征音 = 和 compare 音阶相比不一样的音（v0.5，指板上加特殊描边）
  var SCALE_GROUPS = [
    { id: 'basic', name: '大调与小调' },
    { id: 'mode',  name: '调式' },
    { id: 'penta', name: '五声与布鲁斯' }
  ];
  var SCALES = [
    { id: 'major',            name: '大调',     label: '大调（伊奥尼亚 Ionian）', group: 'basic', degrees: ['1', '2', '3', '4', '5', '6', '7'] },
    { id: 'natural-minor',    name: '自然小调', label: '自然小调（爱奥利亚 Aeolian）', group: 'basic', degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'], modeOf: 6 },
    { id: 'harmonic-minor',   name: '和声小调', label: '和声小调', group: 'basic', degrees: ['1', '2', '♭3', '4', '5', '♭6', '7'], character: ['7'], compare: 'natural-minor' },
    { id: 'melodic-minor',    name: '旋律小调', label: '旋律小调', group: 'basic', degrees: ['1', '2', '♭3', '4', '5', '6', '7'], character: ['6', '7'], compare: 'natural-minor' },
    { id: 'dorian',           name: '多利亚',   label: '多利亚 Dorian', group: 'mode', degrees: ['1', '2', '♭3', '4', '5', '6', '♭7'], modeOf: 2, character: ['6'], compare: 'natural-minor' },
    { id: 'phrygian',         name: '弗里几亚', label: '弗里几亚 Phrygian', group: 'mode', degrees: ['1', '♭2', '♭3', '4', '5', '♭6', '♭7'], modeOf: 3, character: ['♭2'], compare: 'natural-minor' },
    { id: 'lydian',           name: '利底亚',   label: '利底亚 Lydian', group: 'mode', degrees: ['1', '2', '3', '♯4', '5', '6', '7'], modeOf: 4, character: ['♯4'], compare: 'major' },
    { id: 'mixolydian',       name: '混合利底亚', label: '混合利底亚 Mixolydian', group: 'mode', degrees: ['1', '2', '3', '4', '5', '6', '♭7'], modeOf: 5, character: ['♭7'], compare: 'major' },
    { id: 'locrian',          name: '洛克里亚', label: '洛克里亚 Locrian', group: 'mode', degrees: ['1', '♭2', '♭3', '4', '♭5', '♭6', '♭7'], modeOf: 7, character: ['♭5'], compare: 'natural-minor' },
    { id: 'major-pentatonic', name: '大调五声', label: '大调五声', group: 'penta', degrees: ['1', '2', '3', '5', '6'], parent: 'major' },
    { id: 'minor-pentatonic', name: '小调五声', label: '小调五声', group: 'penta', degrees: ['1', '♭3', '4', '5', '♭7'], parent: 'natural-minor' },
    { id: 'blues',            name: '布鲁斯',   label: '布鲁斯', group: 'penta', degrees: ['1', '♭3', '4', '♭5', '5', '♭7'], roles: { '♭5': 'other' }, parent: 'natural-minor' }
  ];

  // 可选的根音（17 种写法）
  var ROOTS = ['C', 'C♯', 'D♭', 'D', 'D♯', 'E♭', 'E', 'F', 'F♯', 'G♭', 'G', 'G♯', 'A♭', 'A', 'A♯', 'B♭', 'B'];

  function getScale(id) {
    var sc = SCALES.filter(function (x) { return x.id === id; })[0];
    if (!sc) throw new Error('没有这个音阶：' + id);
    return sc;
  }

  // 某个根音上的音阶：每个音的音级、音名、音高、音程名、角色
  function scaleNotes(rootName, scaleId) {
    var sc = getScale(scaleId);
    return sc.degrees.map(function (deg) {
      var n = spellDegree(rootName, deg);
      return {
        degree: parseDegree(deg).text, name: n.name, pc: n.pc,
        interval: intervalName(deg),
        role: (sc.roles && sc.roles[deg]) || roleOf(deg),
        character: !!(sc.character && sc.character.indexOf(deg) >= 0) // 特征音（v0.5）
      };
    });
  }

  // 音阶的补充说明（v0.5）：
  //   relation：调式和大调的关系。例如 D 多利亚 → { root: 'C', simple: 'C', step: 2 }（= C 大调从第 2 个音开始）
  //             root 按字母严格拼写（和音阶里的音一致），可能是 A𝄫 这种理论写法，simple 是常用写法
  //   character：特征音，每项 { degree, name, pc, diff }，diff = 比 compare 音阶高（+1）还是低（-1）半音
  function scaleInfo(rootName, scaleId) {
    var sc = getScale(scaleId), out = { relation: null, character: [], compare: sc.compare || null };
    if (sc.modeOf) {
      // 从调式根音往上数到“母大调”根音的音级：第 2 个调式 → 往上 ♭7，第 3 个 → ♭6 ……
      var up = { 2: '♭7', 3: '♭6', 4: '5', 5: '4', 6: '♭3', 7: '♭2' }[sc.modeOf];
      var p = spellDegree(rootName, up);
      out.relation = { root: p.name, simple: simplifyNote(p.name), scale: 'major', step: sc.modeOf };
    }
    (sc.character || []).forEach(function (deg) {
      var d = parseDegree(deg), n = spellDegree(rootName, deg);
      var cmp = getScale(sc.compare).degrees.map(parseDegree).filter(function (x) { return x.number === d.number; })[0];
      out.character.push({ degree: d.text, name: n.name, pc: n.pc, diff: d.alter - cmp.alter });
    });
    return out;
  }

  // 在一组音里找某个音高（找不到返回 null）
  function findByPc(notes, pc) {
    for (var i = 0; i < notes.length; i++) if (notes[i].pc === pc) return notes[i];
    return null;
  }

  // ---------------- 和弦 ----------------
  // group：下拉框里的分组。degrees 按从低到高的“理论顺序”写（识别和弦、顺阶和弦都靠它比对）
  // 注意：id '7'、'9'、'11'、'13'、'5' 像数字，Object.keys 会把它们排到最前，遍历请直接用这个数组
  var CHORD_GROUPS = [
    { id: 'triad',  name: '三和弦' },
    { id: 'sus',    name: '挂留 / 强力和弦' },
    { id: 'sixth',  name: '六和弦' },
    { id: 'seventh', name: '七和弦' },
    { id: 'ext',    name: '九和弦及以上' }
  ];
  var CHORDS = [
    { id: 'maj',    name: '大三',     symbol: '',        group: 'triad',   degrees: ['1', '3', '5'] },
    { id: 'm',      name: '小三',     symbol: 'm',       group: 'triad',   degrees: ['1', '♭3', '5'] },
    { id: 'dim',    name: '减三',     symbol: 'dim',     group: 'triad',   degrees: ['1', '♭3', '♭5'] },
    { id: 'aug',    name: '增三',     symbol: 'aug',     group: 'triad',   degrees: ['1', '3', '♯5'] },
    { id: 'maj7',   name: '大七',     symbol: 'maj7',    group: 'seventh', degrees: ['1', '3', '5', '7'] },
    { id: 'm7',     name: '小七',     symbol: 'm7',      group: 'seventh', degrees: ['1', '♭3', '5', '♭7'] },
    { id: '7',      name: '属七',     symbol: '7',       group: 'seventh', degrees: ['1', '3', '5', '♭7'] },
    { id: 'm7b5',   name: '半减七',   symbol: 'm7♭5',    group: 'seventh', degrees: ['1', '♭3', '♭5', '♭7'] },
    { id: 'dim7',   name: '减七',     symbol: 'dim7',    group: 'seventh', degrees: ['1', '♭3', '♭5', '𝄫7'] },
    // ---- v0.4 新增 ----
    { id: 'sus2',   name: '挂二',     symbol: 'sus2',    group: 'sus',     degrees: ['1', '2', '5'] },
    { id: 'sus4',   name: '挂四',     symbol: 'sus4',    group: 'sus',     degrees: ['1', '4', '5'] },
    { id: '7sus4',  name: '属七挂四', symbol: '7sus4',   group: 'sus',     degrees: ['1', '4', '5', '♭7'] },
    { id: '5',      name: '强力和弦', symbol: '5',       group: 'sus',     degrees: ['1', '5'] },
    { id: '6',      name: '大六',     symbol: '6',       group: 'sixth',   degrees: ['1', '3', '5', '6'] },
    { id: 'm6',     name: '小六',     symbol: 'm6',      group: 'sixth',   degrees: ['1', '♭3', '5', '6'] },
    { id: 'mMaj7',  name: '小大七',   symbol: 'm(maj7)', group: 'seventh', degrees: ['1', '♭3', '5', '7'] },
    { id: 'maj7s5', name: '增大七',   symbol: 'maj7♯5',  group: 'seventh', degrees: ['1', '3', '♯5', '7'] },
    { id: '7s5',    name: '增七',     symbol: '7♯5',     group: 'seventh', degrees: ['1', '3', '♯5', '♭7'] },
    { id: 'add9',   name: '加九',     symbol: 'add9',    group: 'ext',     degrees: ['1', '3', '5', '9'] },
    { id: 'madd9',  name: '小加九',   symbol: 'madd9',   group: 'ext',     degrees: ['1', '♭3', '5', '9'] },
    { id: '6/9',    name: '六九',     symbol: '6/9',     group: 'ext',     degrees: ['1', '3', '5', '6', '9'] },
    { id: '9',      name: '属九',     symbol: '9',       group: 'ext',     degrees: ['1', '3', '5', '♭7', '9'] },
    { id: 'm9',     name: '小九',     symbol: 'm9',      group: 'ext',     degrees: ['1', '♭3', '5', '♭7', '9'] },
    { id: 'maj9',   name: '大九',     symbol: 'maj9',    group: 'ext',     degrees: ['1', '3', '5', '7', '9'] },
    { id: '7b9',    name: '属七降九', symbol: '7♭9',     group: 'ext',     degrees: ['1', '3', '5', '♭7', '♭9'] },
    { id: '7s9',    name: '属七升九', symbol: '7♯9',     group: 'ext',     degrees: ['1', '3', '5', '♭7', '♯9'] },
    // 十一、十三和弦：11 写全六个音；13 按吉他上的通行写法省略 11 音（11 和 3 音相差小九度，很刺耳）
    { id: '11',     name: '属十一',   symbol: '11',      group: 'ext',     degrees: ['1', '3', '5', '♭7', '9', '11'] },
    { id: '13',     name: '属十三',   symbol: '13',      group: 'ext',     degrees: ['1', '3', '5', '♭7', '9', '13'] }
  ];

  function getChord(id) {
    var c = CHORDS.filter(function (x) { return x.id === id; })[0];
    if (!c) throw new Error('没有这个和弦：' + id);
    return c;
  }

  // 和弦写法，例如 C、Am、Bm7♭5
  function chordSymbol(rootName, chordId) {
    return parseNote(rootName).name + getChord(chordId).symbol;
  }

  function chordNotes(rootName, chordId) {
    return getChord(chordId).degrees.map(function (deg) {
      var n = spellDegree(rootName, deg);
      return { degree: parseDegree(deg).text, name: n.name, pc: n.pc, interval: intervalName(deg), role: roleOf(deg, true) };
    });
  }

  // 从 fromName 到 toName 是几级：按字母相隔 + 半音数判断。例如 G → F 是 ♭7，G → C 是 4
  // 超出重升/重降范围时返回 null
  function degreeBetween(fromName, toName) {
    var a = parseNote(fromName), b = parseNote(toName);
    var number = ((LETTERS.indexOf(b.letter) - LETTERS.indexOf(a.letter)) + 7) % 7 + 1;
    var alter = mod12(b.pc - a.pc - MAJOR_SEMITONES[number] + 6) - 6;
    if (alter < -2 || alter > 2) return null;
    return ALTER_SYMBOL[alter] + number;
  }

  // ---------------- 顺阶和弦 ----------------
  // 在七声音阶上，从每一级开始“隔一个音取一个音”（1-3-5，七和弦再加 7），得到的就是顺阶和弦。
  // 五声、布鲁斯没法这样叠，改用它们的母音阶（parent）来算。
  // 和弦类型不是写死的，而是由叠出来的音算出来的——以后加和声小调等音阶，可以自动得到它的顺阶和弦。
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  // 罗马数字：大写 = 三音是大三度，小写 = 小三度；后缀表示和弦类型（小写 + 7 就是小七和弦，如 ii7）
  // mMaj7、maj7s5 是给 v0.5 和声小调 / 旋律小调预备的：i(maj7)、III+maj7
  var ROMAN_SUFFIX = { maj: '', m: '', dim: '°', aug: '+', maj7: 'maj7', m7: '7', '7': '7', m7b5: 'ø7', dim7: '°7',
    mMaj7: '(maj7)', maj7s5: '+maj7' };

  // 算顺阶和弦用哪个七声音阶；没选音阶或无法计算时返回 null
  function diatonicBase(scaleId) {
    if (!scaleId || scaleId === 'none') return null;
    var sc = getScale(scaleId);
    if (sc.parent) return sc.parent;
    return sc.degrees.length === 7 ? sc.id : null;
  }

  // 按音级组成找和弦类型（找不到返回 null）
  function chordByDegrees(degrees) {
    var key = degrees.join(',');
    for (var i = 0; i < CHORDS.length; i++) if (CHORDS[i].degrees.join(',') === key) return CHORDS[i];
    return null;
  }

  // 某个调的 7 个顺阶和弦。size：3 = 三和弦，4 = 七和弦
  // 每项：step 第几级、numeral 罗马数字（如 ii）、roman 带后缀（如 ii7）、root 和弦根音（按调拼写）、
  //       chord 和弦类型 id、symbol 和弦写法（如 Dm7）、notes 组成音
  function diatonicChords(rootName, scaleId, size) {
    var baseId = diatonicBase(scaleId);
    if (!baseId) return [];
    var n = size === 4 ? 4 : 3;
    var notes = scaleNotes(rootName, baseId);
    return notes.map(function (bn, i) {
      var tones = [];
      for (var k = 0; k < n; k++) tones.push(notes[(i + 2 * k) % notes.length]);
      var degs = tones.map(function (t) { return degreeBetween(bn.name, t.name); });
      var c = chordByDegrees(degs);
      if (!c) throw new Error(rootName + ' ' + scaleId + ' 第 ' + (i + 1) + ' 级叠出的和弦（' + degs.join(' ') + '）还不在和弦库里');
      var numeral = degs[1] === '♭3' ? ROMAN[i].toLowerCase() : ROMAN[i];
      return { step: i + 1, numeral: numeral, roman: numeral + ROMAN_SUFFIX[c.id], root: bn.name, pc: bn.pc,
        chord: c.id, symbol: bn.name + c.symbol, notes: tones.map(function (t) { return t.name; }) };
    });
  }

  // 当前和弦是不是这个调的顺阶和弦：按音高比（C♯ 和 D♭ 算同一个），三和弦、七和弦都找
  // 返回 { size: 3 或 4, item: diatonicChords 里的那一项 }，不是就返回 null
  function diatonicMatch(rootName, scaleId, chordRoot, chordId) {
    if (!chordId || chordId === 'none' || !diatonicBase(scaleId)) return null;
    var pc = parseNote(chordRoot).pc, sizes = [3, 4];
    for (var s = 0; s < sizes.length; s++) {
      var list = diatonicChords(rootName, scaleId, sizes[s]);
      for (var i = 0; i < list.length; i++) {
        if (list[i].pc === pc && list[i].chord === chordId) return { size: sizes[s], item: list[i] };
      }
    }
    return null;
  }

  // 把理论写法（E♯、F𝄪、C♭、B𝄫……）换成 17 个常用写法之一：有本位音用本位音，否则升号写法换升号、降号写法换降号
  function simplifyNote(name) {
    var n = parseNote(name);
    if (ROOTS.indexOf(n.name) >= 0) return n.name;
    var same = ROOTS.filter(function (r) { return parseNote(r).pc === n.pc; });
    var natural = same.filter(function (r) { return r.length === 1; })[0];
    if (natural) return natural;
    return same.filter(function (r) { return n.alter > 0 ? r.indexOf('♯') > 0 : r.indexOf('♭') > 0; })[0] || same[0];
  }

  // ---------------- 识别和弦（v0.4 第 2 步） ----------------
  // 输入：按了哪些弦的哪一品（每根弦最多一个），输出：最可能的和弦 + 其他候选。
  // 规则（2026-09-24 与用户确认）：
  //   1. 按到的每个音都必须属于这个和弦（不能多出音）；根音必须按到
  //   2. 可以缺的音：4 个音以上的和弦可缺纯五度 5；13 和弦还可缺 9；11 和弦还可缺 3；其他音都不能缺
  //   3. 排序：缺的音少的优先 → 根音在最低音的优先 → 结构简单的优先（按和弦分组顺序）
  //   4. 写法：C13(no5, no9)；低音不是根音时加斜线 Am7/C
  //   5. 增三、减七等对称和弦：同样成立的名字合并成一项（equivalents）
  // 注意：这里只影响识别结果，不改指板上和弦的显示（指板仍显示全部组成音）

  // 默认写法（单个音、没有调可参考时）
  var DEFAULT_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  // 两个音之间的音程（半音数 → 名称），用于只按了两个音的情况
  var INTERVAL_CN = ['纯一度', '小二度', '大二度', '小三度', '大三度', '纯四度', '三全音', '纯五度', '小六度', '大六度', '小七度', '大七度'];

  function degreeSemitones(degreeText) {
    var d = parseDegree(degreeText);
    return MAJOR_SEMITONES[d.number] + d.alter;
  }

  // 这个和弦允许缺哪些音级
  function canOmit(chord, degreeText) {
    if (degreeText === '5') return chord.degrees.length >= 4;
    if (degreeText === '9') return chord.id === '13';
    if (degreeText === '3') return chord.id === '11';
    return false;
  }

  // 某个音高做根音、配某种和弦时，根音怎么写：
  //   有调时，根音在调里就按调拼写；否则在两种写法（升号/降号）里选整个和弦升降号最少的，一样多时选升号
  function spellRoot(pc, chordId, keyNotes) {
    var inKey = keyNotes ? findByPc(keyNotes, pc) : null;
    if (inKey) {
      try { chordNotes(inKey.name, chordId); return inKey.name; } catch (e) { /* 拼不出来就用下面的办法 */ }
    }
    var options = ROOTS.filter(function (r) { return parseNote(r).pc === pc; });
    var best = null, bestScore = Infinity;
    options.forEach(function (r) {
      var score;
      try {
        score = chordNotes(r, chordId).reduce(function (s, n) { return s + Math.abs(parseNote(n.name).alter); }, 0);
      } catch (e) { return; }
      score = score * 2 + (r.indexOf('♭') > 0 ? 1 : 0); // 一样多时升号（或本位音）优先
      if (score < bestScore) { bestScore = score; best = r; }
    });
    return best;
  }

  // 指法写法，从 6 弦到 1 弦，如 x32010；有两位数品格时用“-”隔开，如 x-10-12-12-11-x
  function shapeText(marks, stringCount) {
    var n = stringCount || 6, byString = {};
    marks.forEach(function (m) { byString[m.string] = m.fret; });
    var parts = [], wide = false;
    for (var s = n; s >= 1; s--) {
      var f = byString[s];
      if (f === undefined || f === null) parts.push('x');
      else { parts.push(String(f)); if (f >= 10) wide = true; }
    }
    return parts.join(wide ? '-' : '');
  }

  // marks：[{ string: 弦号, fret: 品 }]，没按的弦不写（= 不弹 ×）；每根弦最多一个
  // opts：{ tuning 调弦（默认标准调弦）, keyRoot 调的根音, scaleId 音阶（用来按调拼写、给出级数） }
  // 返回：{ kind: 'none' | 'note' | 'interval' | 'chord' | 'unknown', shape, notes, bass, interval, candidates }
  //   candidates 每项：{ root, chord, symbol, missing, bass, text, equivalents, roman }
  function identifyChord(marks, opts) {
    opts = opts || {};
    var tuning = opts.tuning || STANDARD_TUNING;
    var played = (marks || []).filter(function (m) { return typeof m.fret === 'number' && m.fret >= 0; })
      .map(function (m) {
        var midi = midiAt(m.string, m.fret, tuning);
        return { string: m.string, fret: m.fret, midi: midi, pc: mod12(midi) };
      })
      .sort(function (a, b) { return a.midi - b.midi || b.string - a.string; });

    var base = diatonicBase(opts.scaleId) || (opts.scaleId && opts.scaleId !== 'none' ? opts.scaleId : null);
    var keyNotes = null;
    if (opts.keyRoot && base) { try { keyNotes = scaleNotes(opts.keyRoot, base); } catch (e) { keyNotes = null; } }
    var nameOf = function (pc) { var k = keyNotes && findByPc(keyNotes, pc); return k ? k.name : DEFAULT_NAMES[pc]; };

    var pcs = [];
    played.forEach(function (n) { if (pcs.indexOf(n.pc) < 0) pcs.push(n.pc); });
    var out = { kind: 'none', shape: shapeText(played, tuning.length), notes: played, bass: null, interval: null, candidates: [] };
    if (!played.length) return out;
    var bassPc = played[0].pc;
    out.bass = { pc: bassPc, name: nameOf(bassPc) };
    played.forEach(function (n) { n.name = nameOf(n.pc); });
    if (pcs.length === 1) { out.kind = 'note'; return out; }
    if (pcs.length === 2) {
      var semis = mod12(pcs[1] - pcs[0]);
      out.interval = { low: nameOf(pcs[0]), high: nameOf(pcs[1]), semitones: semis, name: INTERVAL_CN[semis] };
    }

    var groupOrder = CHORD_GROUPS.map(function (g) { return g.id; });
    var list = [];
    pcs.forEach(function (rootPc, rootOrder) {
      CHORDS.forEach(function (c, ci) {
        var chordPcs = c.degrees.map(function (d) { return mod12(rootPc + degreeSemitones(d)); });
        if (!pcs.every(function (p) { return chordPcs.indexOf(p) >= 0; })) return;          // 多出了音
        var missing = c.degrees.filter(function (d, i) { return pcs.indexOf(chordPcs[i]) < 0; });
        if (!missing.every(function (d) { return canOmit(c, d); })) return;                // 缺了不能缺的音
        var rootName = spellRoot(rootPc, c.id, keyNotes);
        if (!rootName) return;
        var cn = chordNotes(rootName, c.id);
        var slash = rootPc === bassPc ? null : findByPc(cn, bassPc).name;
        var symbol = rootName + c.symbol;
        var m = null;
        if (opts.keyRoot && opts.scaleId) { try { m = diatonicMatch(opts.keyRoot, opts.scaleId, rootName, c.id); } catch (e) { m = null; } }
        list.push({
          root: rootName, chord: c.id, symbol: symbol, missing: missing, bass: slash,
          text: symbol + (missing.length ? '(' + missing.map(function (d) { return 'no' + d; }).join(', ') + ')' : '') + (slash ? '/' + slash : ''),
          equivalents: [symbol], roman: m ? m.item.roman : null,
          notes: cn.map(function (n) { return n.name; }),
          _key: [missing.length, slash ? 1 : 0, groupOrder.indexOf(c.group), ci, rootOrder],
          _same: c.id + '|' + chordPcs.slice().sort(function (a, b) { return a - b; }).join(',') + '|' + missing.length
        });
      });
    });
    list.sort(function (a, b) {
      for (var i = 0; i < a._key.length; i++) if (a._key[i] !== b._key[i]) return a._key[i] - b._key[i];
      return 0;
    });
    // 对称和弦（增三、减七……）：音完全一样、类型一样的合并成一项
    var merged = [];
    list.forEach(function (x) {
      var first = merged.filter(function (y) { return y._same === x._same; })[0];
      if (first) first.equivalents.push(x.symbol); else merged.push(x);
    });
    merged.forEach(function (x) { delete x._key; delete x._same; });
    out.candidates = merged;
    out.kind = merged.length ? 'chord' : (pcs.length === 2 ? 'interval' : 'unknown');
    // 有识别结果时，音名按最可能的和弦拼写
    if (merged.length) {
      var best = chordNotes(merged[0].root, merged[0].chord);
      played.forEach(function (n) { n.name = findByPc(best, n.pc).name; });
      out.bass.name = findByPc(best, bassPc).name;
      if (out.interval) { out.interval.low = findByPc(best, pcs[0]).name; out.interval.high = findByPc(best, pcs[1]).name; }
    }
    return out;
  }

  // ---------------- 叠加：音阶 + 和弦 ----------------
  // 返回 { 音高(0～11): 该音在指板上怎么显示 }，没有的音高就不显示
  //   kind: 'scale'（只有音阶）/ 'chord'（和弦内音）/ 'muted'（叠加时的其他音阶音，淡色）
  //   outside: 和弦音不在音阶里（调外音）
  //   scaleRoot: 是音阶根音（叠加时加描边）
  // 有和弦时，degree / interval 都以和弦根音为准
  function combine(scaleRoot, scaleId, chordRoot, chordId) {
    var sn = scaleId && scaleId !== 'none' ? scaleNotes(scaleRoot, scaleId) : [];
    var cn = chordId && chordId !== 'none' ? chordNotes(chordRoot, chordId) : [];
    var out = {};
    for (var pc = 0; pc < 12; pc++) {
      var c = findByPc(cn, pc), sc = findByPc(sn, pc);
      if (!c && !sc) continue;
      if (!cn.length) {
        out[pc] = { kind: 'scale', name: sc.name, degree: sc.degree, interval: sc.interval, role: sc.role, outside: false, scaleRoot: false, character: sc.character };
      } else if (c) {
        out[pc] = { kind: 'chord', name: c.name, degree: c.degree, interval: c.interval, role: c.role,
          outside: sn.length > 0 && !sc, scaleRoot: !!(sc && sc.degree === '1'), character: !!(sc && sc.character) };
      } else {
        var d = degreeBetween(chordRoot, sc.name);
        out[pc] = { kind: 'muted', name: sc.name, degree: d || sc.name, interval: d ? intervalName(d) : sc.name,
          role: 'muted', outside: false, scaleRoot: sc.degree === '1', character: sc.character };
      }
    }
    return out;
  }

  var Theory = {
    LETTERS: LETTERS,
    LETTER_PC: LETTER_PC,
    ACCIDENTALS: ACCIDENTALS,
    STANDARD_TUNING: STANDARD_TUNING,
    FRET_COUNT: FRET_COUNT,
    MIN_FRETS: MIN_FRETS,
    MAX_FRETS: MAX_FRETS,
    mod12: mod12,
    parseNote: parseNote,
    openString: openString,
    midiAt: midiAt,
    pcAt: pcAt,
    parseDegree: parseDegree,
    spellDegree: spellDegree,
    intervalName: intervalName,
    roleOf: roleOf,
    SCALES: SCALES,
    SCALE_GROUPS: SCALE_GROUPS,
    scaleInfo: scaleInfo,
    ROOTS: ROOTS,
    getScale: getScale,
    scaleNotes: scaleNotes,
    findByPc: findByPc,
    CHORDS: CHORDS,
    CHORD_GROUPS: CHORD_GROUPS,
    getChord: getChord,
    chordSymbol: chordSymbol,
    chordNotes: chordNotes,
    degreeBetween: degreeBetween,
    diatonicBase: diatonicBase,
    chordByDegrees: chordByDegrees,
    diatonicChords: diatonicChords,
    diatonicMatch: diatonicMatch,
    simplifyNote: simplifyNote,
    combine: combine,
    DEFAULT_NAMES: DEFAULT_NAMES,
    canOmit: canOmit,
    shapeText: shapeText,
    identifyChord: identifyChord
  };

  root.Theory = Theory;
  if (typeof module !== 'undefined' && module.exports) module.exports = Theory;
})(typeof window !== 'undefined' ? window : globalThis);
