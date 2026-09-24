/*
 * 颜色配置 —— 整个工具用到的所有颜色都在这里（css/style.css 里不写任何具体颜色）。
 *
 * 每一项：
 *   key   程序里的名字（对应 CSS 里的 var(--key)）
 *   label 中文名（调色面板里显示）
 *   light 浅色模式的颜色
 *   dark  深色模式的颜色
 *
 * 以后新加元素的颜色，一律加在这里；页面上的“调色”面板会自动列出每一项。
 * 这个文件放在 <head> 里最先加载，页面一打开就是正确的颜色，不会闪一下。
 */
(function (root) {
  'use strict';

  var GROUPS = [
    { name: '页面', items: [
      { key: 'bg',     label: '页面背景', light: '#f6f5f2', dark: '#15171a' },
      { key: 'panel',  label: '卡片背景', light: '#ffffff', dark: '#1d2024' },
      { key: 'text',   label: '主要文字', light: '#1f2328', dark: '#e7e7e7' },
      { key: 'muted',  label: '次要文字', light: '#6b6f76', dark: '#9aa0a8' },
      { key: 'line',   label: '边框线',   light: '#e2dfd8', dark: '#2d3137' }
    ]},
    { name: '指板', items: [
      { key: 'board',      label: '指板底色',     light: '#ede6d9', dark: '#22252a' },
      { key: 'board-edge', label: '指板边线',     light: '#d8cfbf', dark: '#30343a' },
      { key: 'fret',       label: '品丝',         light: '#a39c92', dark: '#4f555e' },
      { key: 'nut',        label: '琴枕',         light: '#4a4540', dark: '#cfd3d8' },
      { key: 'string',     label: '琴弦',         light: '#7b746b', dark: '#8d949d' },
      { key: 'inlay',      label: '品位点',       light: '#d3c8b5', dark: '#353a42' },
      { key: 'hover',      label: '鼠标悬停高亮（半透明显示）', light: '#000000', dark: '#ffffff' }
    ]},
    { name: '音级颜色（指板上的圆点）', items: [
      { key: 'deg-root',     label: '根音',               light: '#d9443f', dark: '#e5534b' },
      { key: 'deg-third',    label: '三音',               light: '#d9730d', dark: '#e8912d' },
      { key: 'deg-fifth',    label: '五音',               light: '#2f6fdb', dark: '#4c8dff' },
      { key: 'deg-seventh',  label: '七音',               light: '#8250df', dark: '#a371f7' },
      { key: 'deg-other',    label: '其他音阶音',         light: '#8b929a', dark: '#5c636c' },
      { key: 'dot-text',     label: '彩色圆点上的文字',   light: '#ffffff', dark: '#ffffff' },
      { key: 'dot-outline',  label: '圆点描边（与指板分隔）', light: '#ffffff', dark: '#1d2024' }
    ]},
    { name: '自检页', items: [
      { key: 'pass', label: '通过 ✓',   light: '#1a7f37', dark: '#4ac26b' },
      { key: 'fail', label: '失败 ✗',   light: '#cf222e', dark: '#ff7b72' },
      { key: 'todo', label: '待实现 ○', light: '#8c959f', dark: '#6e7681' }
    ]}
  ];

  var MODES = ['system', 'light', 'dark'];
  var KEY_MODE = 'guitarTool.themeMode';
  var KEY_COLORS = 'guitarTool.colorOverrides';

  // 浏览器存储：某些情况下（隐私模式等）会读写失败，失败就当作没有保存过
  function readStore(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function writeStore(k, v) { try { if (v === null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, v); } catch (e) {} }

  function allItems() {
    var out = [];
    GROUPS.forEach(function (g) { g.items.forEach(function (it) { out.push(it); }); });
    return out;
  }

  var overrides = (function () {
    try {
      var o = JSON.parse(readStore(KEY_COLORS) || '{}');
      return { light: o.light || {}, dark: o.dark || {} };
    } catch (e) { return { light: {}, dark: {} }; }
  })();

  var mode = readStore(KEY_MODE);
  if (MODES.indexOf(mode) < 0) mode = 'system';

  var listeners = [];
  function notify() { listeners.forEach(function (fn) { fn(); }); }

  function colorOf(scheme, key) {
    if (overrides[scheme][key]) return overrides[scheme][key];
    var it = allItems().filter(function (i) { return i.key === key; })[0];
    return it ? it[scheme] : null;
  }

  function varsCss(scheme) {
    return allItems().map(function (it) { return '--' + it.key + ':' + colorOf(scheme, it.key) + ';'; }).join('')
      + 'color-scheme:' + scheme + ';';
  }

  // 生成 CSS：默认浅色；系统是深色且没有手动选浅色时用深色；手动选深色时用深色
  function apply() {
    var doc = root.document;
    var css = ':root{' + varsCss('light') + '}'
      + '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + varsCss('dark') + '}}'
      + ':root[data-theme="dark"]{' + varsCss('dark') + '}';
    var style = doc.getElementById('theme-vars');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'theme-vars';
      (doc.head || doc.documentElement).appendChild(style);
    }
    style.textContent = css;
    if (mode === 'system') doc.documentElement.removeAttribute('data-theme');
    else doc.documentElement.setAttribute('data-theme', mode);
  }

  function effectiveScheme() {
    if (mode !== 'system') return mode;
    return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var Theme = {
    GROUPS: GROUPS,
    allItems: allItems,
    getMode: function () { return mode; },
    setMode: function (m) {
      if (MODES.indexOf(m) < 0) return;
      mode = m; writeStore(KEY_MODE, m); apply(); notify();
    },
    effectiveScheme: effectiveScheme,
    colorOf: colorOf,
    defaultOf: function (scheme, key) {
      var it = allItems().filter(function (i) { return i.key === key; })[0];
      return it ? it[scheme] : null;
    },
    isModified: function (scheme, key) { return !!overrides[scheme][key]; },
    setColor: function (scheme, key, hex) {
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
      hex = hex.toLowerCase();
      if (hex === Theme.defaultOf(scheme, key)) delete overrides[scheme][key];
      else overrides[scheme][key] = hex;
      writeStore(KEY_COLORS, JSON.stringify(overrides)); apply(); notify();
      return true;
    },
    resetColors: function (scheme) {
      if (scheme) overrides[scheme] = {}; else overrides = { light: {}, dark: {} };
      writeStore(KEY_COLORS, JSON.stringify(overrides)); apply(); notify();
    },
    // 导出改过的颜色，发给 Claude 写进本文件
    exportText: function () {
      var lines = ['【吉他指板 · 颜色配置修改】'];
      ['light', 'dark'].forEach(function (s) {
        allItems().forEach(function (it) {
          if (overrides[s][it.key]) {
            lines.push((s === 'light' ? '浅色' : '深色') + ' · ' + it.label + '（' + it.key + '）：'
              + it[s] + ' → ' + overrides[s][it.key]);
          }
        });
      });
      if (lines.length === 1) lines.push('（没有修改）');
      lines.push('JSON：' + JSON.stringify(overrides));
      return lines.join('\n');
    },
    onChange: function (fn) { listeners.push(fn); }
  };

  // 系统深浅色变化时，“跟随系统”模式下要通知界面刷新
  if (root.matchMedia) {
    var mq = root.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', notify);
  }

  apply();
  root.Theme = Theme;
})(window);
