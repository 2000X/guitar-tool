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

  var FRET_COUNT = 15; // 显示 0～15 品

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
  var MAJOR_SEMITONES = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
  var ALTER_SYMBOL = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };

  // 解析音级写法：'1'、'♭3'、'♯5'、'𝄫7'（也接受 b3、#5、bb7）
  function parseDegree(text) {
    var m = /^(𝄫|♭♭|bb|♭|b|♯|#|𝄪|##|x)?([1-7])$/.exec(String(text).trim());
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

  // 音程名：1 级显示 R（根音），其余如 m3、M3、P5、d5、A5
  function intervalName(degreeText) {
    var d = parseDegree(degreeText);
    if (d.number === 1 && d.alter === 0) return 'R';
    var perfect = d.number === 1 || d.number === 4 || d.number === 5;
    var q = perfect
      ? { '-2': 'dd', '-1': 'd', '0': 'P', '1': 'A', '2': 'AA' }[d.alter]
      : { '-2': 'd', '-1': 'm', '0': 'M', '1': 'A', '2': 'AA' }[d.alter];
    return q + d.number;
  }

  // 音级在和弦骨架里的角色，决定颜色：根音 / 三音 / 五音 / 七音 / 其他
  function roleOf(degreeText) {
    var n = parseDegree(degreeText).number;
    return { 1: 'root', 3: 'third', 5: 'fifth', 7: 'seventh' }[n] || 'other';
  }

  // ---------------- 音阶 ----------------
  // roles 可以单独指定某个音级的角色（如布鲁斯的 ♭5 是“蓝调音”，不算五音）
  var SCALES = [
    { id: 'major',            name: '大调',     degrees: ['1', '2', '3', '4', '5', '6', '7'] },
    { id: 'natural-minor',    name: '自然小调', degrees: ['1', '2', '♭3', '4', '5', '♭6', '♭7'] },
    { id: 'major-pentatonic', name: '大调五声', degrees: ['1', '2', '3', '5', '6'] },
    { id: 'minor-pentatonic', name: '小调五声', degrees: ['1', '♭3', '4', '5', '♭7'] },
    { id: 'blues',            name: '布鲁斯',   degrees: ['1', '♭3', '4', '♭5', '5', '♭7'], roles: { '♭5': 'other' } }
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
        role: (sc.roles && sc.roles[deg]) || roleOf(deg)
      };
    });
  }

  // 在一组音里找某个音高（找不到返回 null）
  function findByPc(notes, pc) {
    for (var i = 0; i < notes.length; i++) if (notes[i].pc === pc) return notes[i];
    return null;
  }

  var Theory = {
    LETTERS: LETTERS,
    LETTER_PC: LETTER_PC,
    ACCIDENTALS: ACCIDENTALS,
    STANDARD_TUNING: STANDARD_TUNING,
    FRET_COUNT: FRET_COUNT,
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
    ROOTS: ROOTS,
    getScale: getScale,
    scaleNotes: scaleNotes,
    findByPc: findByPc
  };

  root.Theory = Theory;
  if (typeof module !== 'undefined' && module.exports) module.exports = Theory;
})(typeof window !== 'undefined' ? window : globalThis);
