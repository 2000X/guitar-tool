/*
 * 深浅模式按钮 + 调色面板（颜色数据都来自 js/theme.js）
 */
(function () {
  'use strict';
  var Theme = window.Theme;
  var MODE_LABELS = { system: '跟随系统', light: '浅色', dark: '深色' };

  function h(tag, attrs, children) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  // ---------- 深浅模式按钮 ----------
  function buildModeSwitch(box) {
    var group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': '深浅模式' });
    ['system', 'light', 'dark'].forEach(function (m) {
      group.appendChild(h('button', { type: 'button', role: 'radio', 'data-mode': m, text: MODE_LABELS[m],
        onclick: function () { Theme.setMode(m); } }));
    });
    box.appendChild(group);
    function sync() {
      group.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-checked', b.getAttribute('data-mode') === Theme.getMode() ? 'true' : 'false');
      });
    }
    Theme.onChange(sync); sync();
  }

  // ---------- 调色面板 ----------
  function buildColorPanel(btn, panel) {
    var body = h('div', { class: 'cp-body' });
    var title = h('span', { class: 'cp-title' });
    var out = h('textarea', { class: 'cp-export', readonly: '', rows: '4', hidden: '' });
    var tip = h('span', { class: 'cp-tip' });

    function copy() {
      out.value = Theme.exportText();
      out.hidden = false;
      out.focus(); out.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      tip.textContent = ok ? '已复制，粘贴发给 Claude 即可' : '请手动全选下面的文字并复制';
    }

    panel.appendChild(h('div', { class: 'cp-head' }, [
      title,
      h('div', { class: 'cp-actions' }, [
        h('button', { type: 'button', class: 'btn', id: 'cp-copy', text: '复制配置', onclick: copy }),
        h('button', { type: 'button', class: 'btn', id: 'cp-reset', text: '恢复默认（当前模式）',
          onclick: function () { Theme.resetColors(Theme.effectiveScheme()); tip.textContent = ''; out.hidden = true; } }),
        h('button', { type: 'button', class: 'btn', id: 'cp-close', text: '收起', onclick: toggle })
      ])
    ]));
    panel.appendChild(h('p', { class: 'cp-note',
      text: '改动会立刻显示，并保存在这台电脑的浏览器里。浅色、深色两套颜色分开调：先用右上角按钮切到对应模式。' }));
    panel.appendChild(body);
    panel.appendChild(h('div', { class: 'cp-foot' }, [tip]));
    panel.appendChild(out);

    function render() {
      var scheme = Theme.effectiveScheme();
      title.textContent = '调色 · 正在编辑：' + (scheme === 'dark' ? '深色' : '浅色') + '模式';
      body.innerHTML = '';
      Theme.GROUPS.forEach(function (g) {
        var list = h('div', { class: 'cp-grid' });
        g.items.forEach(function (it) {
          var val = Theme.colorOf(scheme, it.key);
          var picker = h('input', { type: 'color', value: val, 'data-key': it.key, 'aria-label': it.label });
          var hex = h('input', { type: 'text', class: 'cp-hex', value: val, maxlength: '7', spellcheck: 'false', 'aria-label': it.label + ' 色值' });
          picker.addEventListener('input', function () { hex.value = picker.value; Theme.setColor(scheme, it.key, picker.value); mark(); });
          hex.addEventListener('change', function () {
            var v = hex.value.trim(); if (v[0] !== '#') v = '#' + v;
            if (Theme.setColor(scheme, it.key, v)) { picker.value = v.toLowerCase(); hex.value = v.toLowerCase(); }
            else hex.value = picker.value;
            mark();
          });
          var dot = h('span', { class: 'cp-dot', title: '已修改' });
          function mark() { dot.hidden = !Theme.isModified(scheme, it.key); }
          mark();
          list.appendChild(h('label', { class: 'cp-item', 'data-key': it.key }, [picker, h('span', { class: 'cp-label', text: it.label }), dot, hex]));
        });
        body.appendChild(h('div', { class: 'cp-group' }, [h('h3', { text: g.name }), list]));
      });
    }

    function toggle() {
      panel.hidden = !panel.hidden;
      btn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      if (!panel.hidden) render();
    }
    btn.addEventListener('click', toggle);
    // 切换深浅模式 / 恢复默认后重新渲染（输入过程中不重渲染，避免打断取色）
    Theme.onChange(function () {
      if (panel.hidden) return;
      var active = document.activeElement;
      if (active && panel.contains(active) && active.tagName === 'INPUT') return;
      render();
    });
  }

  var modeBox = document.getElementById('mode-switch');
  if (modeBox) buildModeSwitch(modeBox);
  var btn = document.getElementById('color-btn'), panel = document.getElementById('color-panel');
  if (btn && panel) buildColorPanel(btn, panel);
})();
