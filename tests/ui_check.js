/*
 * 界面自动检查（由 Claude 在自动浏览器里运行）：
 *   node tests/ui_check.js <项目文件夹> <截图输出文件夹>
 * 检查：页面报错、指板结构、每个位置的音、深浅模式切换、调色面板、颜色全部来自配置文件。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] || '.');
const outDir = path.resolve(process.argv[3] || '.');
const Theory = require(path.join(root, 'js/theory.js'));

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
const url = f => 'file://' + path.join(root, f);

// ---------- 静态检查：颜色只能来自 js/theme.js ----------
const sandbox = { window: {}, document: null };
sandbox.window.document = { getElementById: () => null, createElement: () => ({}), documentElement: { setAttribute() {}, removeAttribute() {}, appendChild() {} } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/theme.js'), 'utf8'), sandbox);
const themeItems = sandbox.window.Theme.allItems();
const themeKeys = new Set(themeItems.map(i => i.key));
const hexRe = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
for (const f of ['css/style.css', 'index.html', '自检.html']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const lit = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => hexRe.test(l));
  check(`${f} 里没有写死的颜色`, lit.length === 0, lit.map(([n, l]) => n + ': ' + l.trim()).join(' | '));
  const used = [...src.matchAll(/var\(--([a-z0-9-]+)\)/g)].map(m => m[1]);
  const missing = [...new Set(used.filter(k => !themeKeys.has(k)))];
  check(`${f} 用到的颜色都在 theme.js 里定义`, missing.length === 0, missing.join(', '));
}
const badHex = themeItems.filter(i => !/^#[0-9a-f]{6}$/.test(i.light) || !/^#[0-9a-f]{6}$/.test(i.dark));
check('theme.js 每项都有浅色、深色两个 6 位色值', badHex.length === 0, badHex.map(i => i.key).join(', '));

const hexToRgb = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
const def = (scheme, key) => themeItems.find(i => i.key === key)[scheme];

(async () => {
  const browser = await chromium.launch();

  async function openPage(file, opts = {}) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 520 }, deviceScaleFactor: 2, ...opts });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url(file));
    return { context, page, errors };
  }
  const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const boardFill = page => page.evaluate(() => getComputedStyle(document.querySelector('.board')).fill);

  // ---------- 指板结构（系统浅色） ----------
  {
    const { context, page, errors } = await openPage('index.html', { colorScheme: 'light' });
    await page.waitForSelector('#fretboard .pos');
    const info = await page.evaluate(() => ({
      pos: document.querySelectorAll('.pos').length,
      strings: document.querySelectorAll('.string').length,
      frets: document.querySelectorAll('.fret').length,
      inlays: [...document.querySelectorAll('.inlay')].map(c => +c.dataset.fret),
      labels: [...document.querySelectorAll('.string-label')].map(t => t.textContent),
      nums: [...document.querySelectorAll('.fret-num')].map(t => t.textContent),
      pcs: [...document.querySelectorAll('.pos')].map(g => [+g.dataset.string, +g.dataset.fret, +g.dataset.pc]),
      stringYs: [...document.querySelectorAll('.string')].map(l => [+l.dataset.string, +l.getAttribute('y1')]),
      overflowX: document.documentElement.scrollWidth > window.innerWidth
    }));
    check('位置点数量 = 6 弦 × 16 = 96', info.pos === 96, info.pos);
    check('6 根弦', info.strings === 6, info.strings);
    check('15 根品丝', info.frets === 15, info.frets);
    check('品位点：3 5 7 9 15 单点，12 双点', JSON.stringify(info.inlays.sort((a, b) => a - b)) === JSON.stringify([3, 5, 7, 9, 12, 12, 15]), info.inlays);
    check('弦名从上到下 E B G D A E', info.labels.join('') === 'EBGDAE', info.labels.join(' '));
    check('品号 0～15', info.nums.join(',') === [...Array(16).keys()].join(','), info.nums.join(','));
    const ys = Object.fromEntries(info.stringYs);
    check('1 弦在最上面，6 弦在最下面', ys[1] < ys[2] && ys[2] < ys[3] && ys[5] < ys[6], ys);
    const wrong = info.pcs.filter(([s, f, pc]) => pc !== Theory.pcAt(s, f));
    check('页面上每个位置的音都与乐理核心一致', wrong.length === 0, wrong);
    const at = (s, f) => info.pcs.find(p => p[0] === s && p[1] === f)[2];
    check('标准答案 #10：6 弦 0 品 E、12 品 E、1 弦 15 品 G', at(6, 0) === 4 && at(6, 12) === 4 && at(1, 15) === 7);
    check('页面没有横向滚动条（1400 宽）', !info.overflowX);

    // ---------- 深浅模式按钮 ----------
    check('跟随系统（系统浅色）→ 浅色背景', await bodyBg(page) === hexToRgb(def('light', 'bg')));
    const checked = () => page.getAttribute('#mode-switch [aria-checked="true"]', 'data-mode');
    check('默认选中“跟随系统”', await checked() === 'system', await checked());
    await page.screenshot({ path: path.join(outDir, 'index_light.png') });
    await page.click('#mode-switch [data-mode="dark"]');
    check('点“深色”→ 深色背景', await bodyBg(page) === hexToRgb(def('dark', 'bg')), await bodyBg(page));
    check('点“深色”→ 指板也变深色', await boardFill(page) === hexToRgb(def('dark', 'board')), await boardFill(page));
    await page.reload();
    check('刷新后仍记得“深色”', await checked() === 'dark' && await bodyBg(page) === hexToRgb(def('dark', 'bg')));
    await page.click('#mode-switch [data-mode="system"]');
    check('切回“跟随系统”→ 浅色背景', await bodyBg(page) === hexToRgb(def('light', 'bg')));
    check(`页面无报错（指板/深浅切换）`, errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---------- 系统是深色 ----------
  {
    const { context, page, errors } = await openPage('index.html', { colorScheme: 'dark' });
    check('跟随系统（系统深色）→ 深色背景', await bodyBg(page) === hexToRgb(def('dark', 'bg')));
    await page.click('#mode-switch [data-mode="light"]');
    check('系统深色时手动选“浅色”→ 浅色背景', await bodyBg(page) === hexToRgb(def('light', 'bg')));
    await page.click('#mode-switch [data-mode="system"]');
    await page.screenshot({ path: path.join(outDir, 'index_dark.png') });
    check('页面无报错（系统深色）', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---------- 调色面板 ----------
  for (const scheme of ['light', 'dark']) {
    const { context, page, errors } = await openPage('index.html', { colorScheme: scheme, viewport: { width: 1400, height: 1000 } });
    const tag = scheme === 'light' ? '浅色' : '深色';
    check(`调色面板默认收起（${tag}）`, await page.isHidden('#color-panel'));
    await page.click('#color-btn');
    check(`点“调色”后面板展开（${tag}）`, await page.isVisible('#color-panel'));
    const n = await page.locator('.cp-item').count();
    check(`面板列出 theme.js 的全部 ${themeItems.length} 种颜色（${tag}）`, n === themeItems.length, n);
    const title = await page.textContent('.cp-title');
    check(`面板标题显示正在编辑${tag}模式`, title.includes(tag), title);

    // 改指板底色
    const newColor = scheme === 'light' ? '#c8e6c9' : '#3e2723';
    await page.$eval('.cp-item[data-key="board"] input[type="color"]', (el, v) => {
      el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
    }, newColor);
    check(`改“指板底色”→ 指板立刻变色（${tag}）`, await boardFill(page) === hexToRgb(newColor), await boardFill(page));
    check(`改过的颜色有“已修改”标记（${tag}）`, await page.isVisible('.cp-item[data-key="board"] .cp-dot'));
    // 用文字框改琴弦颜色
    await page.fill('.cp-item[data-key="string"] .cp-hex', '#ff0000');
    await page.press('.cp-item[data-key="string"] .cp-hex', 'Enter');
    const strokeNow = await page.evaluate(() => getComputedStyle(document.querySelector('.string')).stroke);
    check(`在色值框输入 #ff0000 → 琴弦变红（${tag}）`, strokeNow === 'rgb(255, 0, 0)', strokeNow);
    // 复制配置
    await page.click('#cp-copy');
    const exported = await page.inputValue('.cp-export');
    check(`“复制配置”内容包含修改项（${tag}）`, exported.includes(newColor) && exported.includes('#ff0000') && exported.includes('指板底色'), exported);
    // 刷新后仍保留
    await page.reload(); await page.click('#color-btn');
    check(`刷新后自定义颜色仍保留（${tag}）`, await boardFill(page) === hexToRgb(newColor));
    if (scheme === 'light') await page.screenshot({ path: path.join(outDir, 'panel_light.png'), fullPage: true });
    else await page.screenshot({ path: path.join(outDir, 'panel_dark.png'), fullPage: true });
    // 恢复默认
    await page.click('#cp-reset');
    check(`“恢复默认”→ 指板回到默认色（${tag}）`, await boardFill(page) === hexToRgb(def(scheme, 'board')), await boardFill(page));
    check(`“恢复默认”后没有“已修改”标记（${tag}）`, await page.locator('.cp-dot:visible').count() === 0);
    check(`页面无报错（调色面板 ${tag}）`, errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---------- 自检页 ----------
  {
    const { context, page, errors } = await openPage('自检.html', { viewport: { width: 1000, height: 900 } });
    const sum = JSON.parse(await page.getAttribute('body', 'data-summary'));
    check('自检页能打开且无报错', errors.length === 0, errors.join(' | '));
    check('自检页：没有失败项', sum.fail === 0, sum);
    check('自检页有深浅模式按钮', await page.locator('#mode-switch button').count() === 3);
    await page.screenshot({ path: path.join(outDir, 'selfcheck.png'), fullPage: true });
    await context.close();
  }

  await browser.close();
  for (const c of checks) console.log((c.ok ? '  ✓ ' : '  ✗ ') + c.name + (c.ok ? '' : '  → ' + c.detail));
  const failed = checks.filter(c => !c.ok).length;
  console.log(`\n界面检查 ${checks.length} 项：通过 ${checks.length - failed}，失败 ${failed}`);
  process.exit(failed ? 1 : 0);
})();
