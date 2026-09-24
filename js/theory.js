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
    pcAt: pcAt
  };

  root.Theory = Theory;
  if (typeof module !== 'undefined' && module.exports) module.exports = Theory;
})(typeof window !== 'undefined' ? window : globalThis);
