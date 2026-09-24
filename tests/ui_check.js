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

  // ---------- 悬停高亮：移开时不能闪一下（v0.1 后修复的 bug） ----------
  for (const scheme of ['light', 'dark']) {
    const { context, page } = await openPage('index.html', { colorScheme: scheme });
    await page.selectOption('#scale-select', 'none'); // 空位置更容易看清
    const box = await page.locator('.pos[data-string="3"][data-fret="4"] .hit').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(300);
    const hoverOp = await page.$eval('.pos[data-string="3"][data-fret="4"] .hit', el => +getComputedStyle(el).fillOpacity);
    await page.mouse.move(5, 5); // 移开
    // 移开后 0.15 秒内连续取样，透明度都不能超过悬停时的淡色
    const samples = await page.$eval('.pos[data-string="3"][data-fret="4"] .hit', el => new Promise(res => {
      const out = []; const t0 = performance.now();
      (function tick() {
        const cs = getComputedStyle(el);
        const visible = cs.fill !== 'none' && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.fill);
        out.push(visible ? +cs.fillOpacity : 0);
        if (performance.now() - t0 < 150) requestAnimationFrame(tick); else res(out);
      })();
    }));
    const tag = scheme === 'light' ? '浅色' : '深色';
    check(`悬停时显示淡色圆（${tag}）`, hoverOp > 0 && hoverOp <= 0.12, hoverOp);
    check(`光标移开时不会闪出不透明的圆（${tag}）`, Math.max(...samples) <= 0.12, 'max=' + Math.max(...samples));
    await context.close();
  }

  // ---------- 第 2 步：音阶圆点 ----------
  {
    const { context, page, errors } = await openPage('index.html', { colorScheme: 'light', viewport: { width: 1400, height: 760 } });
    // 独立写的标准：空弦音高 + 品数（不借用 theory.js）
    const OPEN = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 };
    const expectCount = pcs => { let c = 0; for (let s = 1; s <= 6; s++) for (let f = 0; f <= 15; f++) if (pcs.includes((OPEN[s] + f) % 12)) c++; return c; };
    const dots = () => page.evaluate(() => [...document.querySelectorAll('.pos')].filter(g => g.querySelector('.dot')).map(g => {
      const d = g.querySelector('.dot');
      return { s: +g.dataset.string, f: +g.dataset.fret, text: d.querySelector('text').textContent, role: d.dataset.role,
        fill: getComputedStyle(d.querySelector('.body')).fill };
    }));
    const at = (list, s, f) => list.find(d => d.s === s && d.f === f);
    const pick = async (sel, v) => { await page.selectOption(sel, v); };

    // 默认：C 大调，显示音名
    check('默认根音 C、音阶大调、显示音名',
      await page.inputValue('#root-select') === 'C' && await page.inputValue('#scale-select') === 'major'
      && await page.getAttribute('#label-mode [aria-checked="true"]', 'data-label') === 'name');
    let d = await dots();
    check('C 大调：圆点数量正确（只标音阶音）', d.length === expectCount([0, 2, 4, 5, 7, 9, 11]), d.length);
    check('标准答案 #1：5 弦 3 品显示 C，红色根音',
      at(d, 5, 3)?.text === 'C' && at(d, 5, 3)?.role === 'root' && at(d, 5, 3)?.fill === hexToRgb(def('light', 'deg-root')), at(d, 5, 3));
    check('C 大调：5 弦 4 品（C♯）没有圆点', !at(d, 5, 4));
    check('C 大调：三音 E（1 弦 0 品）是橙色', at(d, 1, 0)?.fill === hexToRgb(def('light', 'deg-third')), at(d, 1, 0));
    check('C 大调：五音 G（3 弦 0 品）是蓝色', at(d, 3, 0)?.fill === hexToRgb(def('light', 'deg-fifth')), at(d, 3, 0));
    check('C 大调：七音 B（2 弦 0 品）是紫色', at(d, 2, 0)?.fill === hexToRgb(def('light', 'deg-seventh')), at(d, 2, 0));
    check('C 大调：其他音 D（4 弦 0 品）是灰色', at(d, 4, 0)?.fill === hexToRgb(def('light', 'deg-other')), at(d, 4, 0));
    await page.screenshot({ path: path.join(outDir, 'step2_C_major_light.png') });

    // F 大调
    await pick('#root-select', 'F');
    d = await dots();
    check('标准答案 #2：F 大调 3 弦 3 品显示 B♭', at(d, 3, 3)?.text === 'B♭', at(d, 3, 3));
    check('F 大调：指板上没有出现 A♯', !d.some(x => x.text === 'A♯'));
    check('F 大调：图例显示 F G A B♭ C D E',
      (await page.$$eval('.lg-note b', bs => bs.map(b => b.textContent).join(' '))) === 'F G A B♭ C D E');
    await page.click('#label-mode [data-label="interval"]');
    await page.screenshot({ path: path.join(outDir, 'step2_F_major_interval_light.png') });

    // E 大调
    await page.click('#label-mode [data-label="name"]');
    await pick('#root-select', 'E');
    check('标准答案 #3：E 大调图例 E F♯ G♯ A B C♯ D♯',
      (await page.$$eval('.lg-note b', bs => bs.map(b => b.textContent).join(' '))) === 'E F♯ G♯ A B C♯ D♯');

    // A 小调五声
    await pick('#root-select', 'A');
    await pick('#scale-select', 'minor-pentatonic');
    d = await dots();
    const box = d.filter(x => x.f >= 5 && x.f <= 8).map(x => x.s + '-' + x.f).sort();
    check('标准答案 #4：A 小调五声 5～8 品的 12 个位置', JSON.stringify(box) === JSON.stringify(
      ['1-5', '1-8', '2-5', '2-8', '3-5', '3-7', '4-5', '4-7', '5-5', '5-7', '6-5', '6-8']), box);
    check('A 小调五声：图例标题', (await page.textContent('#lg-title')) === 'A 小调五声');
    await page.click('#label-mode [data-label="degree"]');
    d = await dots();
    check('标准答案 #5：切到音级，6 弦 5 品显示 1、8 品显示 ♭3', at(d, 6, 5)?.text === '1' && at(d, 6, 8)?.text === '♭3', [at(d, 6, 5), at(d, 6, 8)]);
    const degSet = [...new Set(d.map(x => x.text))].sort();
    check('A 小调五声：音级只出现 1 ♭3 4 5 ♭7', JSON.stringify(degSet) === JSON.stringify(['1', '4', '5', '♭3', '♭7'].sort()), degSet);
    await page.click('#label-mode [data-label="interval"]');
    d = await dots();
    check('切到音程：根音显示 R，C 显示 m3', at(d, 6, 5)?.text === 'R' && at(d, 6, 8)?.text === 'm3', [at(d, 6, 5), at(d, 6, 8)]);

    // A 布鲁斯
    await page.click('#label-mode [data-label="name"]');
    await pick('#scale-select', 'blues');
    d = await dots();
    check('标准答案 #6：A 布鲁斯图例 A C D E♭ E G',
      (await page.$$eval('.lg-note b', bs => bs.map(b => b.textContent).join(' '))) === 'A C D E♭ E G');
    check('A 布鲁斯：5 弦 6 品是 E♭（灰色蓝调音）', at(d, 5, 6)?.text === 'E♭' && at(d, 5, 6)?.role === 'other', at(d, 5, 6));
    check('A 布鲁斯：没有出现 D♯', !d.some(x => x.text === 'D♯'));

    // 不显示
    await pick('#scale-select', 'none');
    check('选“不显示”→ 没有圆点、图例隐藏', (await dots()).length === 0 && await page.isHidden('#legend'));

    // 记住设置
    await pick('#scale-select', 'minor-pentatonic');
    await page.click('#label-mode [data-label="degree"]');
    await page.reload();
    check('刷新后记住上次的根音、音阶、显示方式',
      await page.inputValue('#root-select') === 'A' && await page.inputValue('#scale-select') === 'minor-pentatonic'
      && await page.getAttribute('#label-mode [aria-checked="true"]', 'data-label') === 'degree');

    // 调色面板能调圆点颜色
    await page.click('#color-btn');
    await page.$eval('.cp-item[data-key="deg-root"] input[type="color"]', el => {
      el.focus(); el.value = '#00aa00'; el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    d = await dots();
    check('调色面板改“根音”颜色 → 根音圆点立刻变色', at(d, 6, 5)?.fill === 'rgb(0, 170, 0)', at(d, 6, 5));
    await page.click('#cp-reset');
    check('页面无报错（音阶）', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  {
    const { context, page } = await openPage('index.html', { colorScheme: 'dark', viewport: { width: 1400, height: 760 } });
    await page.selectOption('#root-select', 'A');
    await page.selectOption('#scale-select', 'minor-pentatonic');
    await page.click('#label-mode [data-label="degree"]');
    await page.screenshot({ path: path.join(outDir, 'step2_A_minpent_degree_dark.png') });
    await context.close();
  }

  // ---------- 第 3 步：和弦 + 叠加 ----------
  {
    const { context, page, errors } = await openPage('index.html', { colorScheme: 'light', viewport: { width: 1400, height: 820 } });
    const OPEN = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 };
    const expectCount = pcs => { let c = 0; for (let s = 1; s <= 6; s++) for (let f = 0; f <= 15; f++) if (pcs.includes((OPEN[s] + f) % 12)) c++; return c; };
    const dots = () => page.evaluate(() => [...document.querySelectorAll('.pos')].filter(g => g.querySelector('.dot')).map(g => {
      const d = g.querySelector('.dot');
      return { s: +g.dataset.string, f: +g.dataset.fret, text: d.querySelector('text').textContent, kind: d.dataset.kind,
        role: d.dataset.role, outside: d.dataset.outside === '1', ring: !!d.querySelector('.scale-root-ring'),
        dashed: !!d.querySelector('.outside-ring'), fill: getComputedStyle(d.querySelector('.body')).fill,
        dashStroke: d.querySelector('.outside-ring') ? getComputedStyle(d.querySelector('.outside-ring')).stroke : null };
    }));
    const at = (list, s, f) => list.find(d => d.s === s && d.f === f);
    const chips = sel => page.$$eval(sel + ' .lg-note b', bs => bs.map(b => b.textContent).join(' '));

    check('默认不显示和弦（第 2 步的行为不变）', await page.inputValue('#chord-select') === 'none');
    check('和弦类型有 9 种 + “不显示”', await page.locator('#chord-select option').count() === 10);

    // 标准答案 #8：C 大调 + G7
    await page.selectOption('#root-select', 'C');
    await page.selectOption('#scale-select', 'major');
    await page.selectOption('#chord-root-select', 'G');
    await page.selectOption('#chord-select', '7');
    let d = await dots();
    check('#8 C 大调 + G7：七个音阶音全部显示', d.length === expectCount([0, 2, 4, 5, 7, 9, 11]), d.length);
    const chordPcsShown = d.filter(x => x.kind === 'chord').map(x => x.text);
    check('#8 高亮的只有 G B D F', JSON.stringify([...new Set(chordPcsShown)].sort()) === JSON.stringify(['B', 'D', 'F', 'G']), [...new Set(chordPcsShown)]);
    check('#8 G（6 弦 3 品）是红色根音', at(d, 6, 3)?.kind === 'chord' && at(d, 6, 3)?.fill === hexToRgb(def('light', 'deg-root')), at(d, 6, 3));
    check('#8 C（5 弦 3 品）是淡色，并有音阶根音描边',
      at(d, 5, 3)?.kind === 'muted' && at(d, 5, 3)?.ring && at(d, 5, 3)?.fill === hexToRgb(def('light', 'scale-muted')), at(d, 5, 3));
    check('#8 A、E 是淡色', at(d, 6, 5)?.kind === 'muted' && at(d, 6, 0)?.kind === 'muted');
    check('#8 没有调外音', !d.some(x => x.outside));
    check('#8 图例：G7 = G B D F', (await page.textContent('#lg-chord-title')) === 'G7' && await chips('#lg-chord') === 'G B D F');
    await page.screenshot({ path: path.join(outDir, 'step3_C_major_G7_light.png') });
    await page.click('#label-mode [data-label="degree"]');
    d = await dots();
    check('#8 音级以和弦根音为准：G=1、B=3、C=4、F=♭7',
      at(d, 6, 3)?.text === '1' && at(d, 5, 2)?.text === '3' && at(d, 5, 3)?.text === '4' && at(d, 6, 1)?.text === '♭7',
      [at(d, 6, 3), at(d, 5, 2), at(d, 5, 3), at(d, 6, 1)]);
    await page.click('#label-mode [data-label="interval"]');
    d = await dots();
    check('#8 音程：G=R、B=M3、F=m7、A=M2', at(d, 6, 3)?.text === 'R' && at(d, 5, 2)?.text === 'M3' && at(d, 6, 1)?.text === 'm7' && at(d, 6, 5)?.text === 'M2');
    await page.click('#label-mode [data-label="degree"]');
    await page.screenshot({ path: path.join(outDir, 'step3_C_major_G7_degree_light.png') });

    // 标准答案 #9：C 大调 + E7
    await page.click('#label-mode [data-label="name"]');
    await page.selectOption('#chord-root-select', 'E');
    d = await dots();
    check('#9 C 大调 + E7：G♯（6 弦 4 品）是调外音，有虚线圈',
      at(d, 6, 4)?.text === 'G♯' && at(d, 6, 4)?.outside && at(d, 6, 4)?.dashed && at(d, 6, 4)?.dashStroke === hexToRgb(def('light', 'outside-mark')), at(d, 6, 4));
    check('#9 G♯ 是橙色三音', at(d, 6, 4)?.fill === hexToRgb(def('light', 'deg-third')));
    check('#9 G（6 弦 3 品）是淡色音阶音，不是和弦音', at(d, 6, 3)?.kind === 'muted');
    check('#9 只有 G♯ 是调外音', d.filter(x => x.outside).every(x => x.text === 'G♯') && d.some(x => x.outside));
    check('#9 图例：E7 = E G♯ B D', await chips('#lg-chord') === 'E G♯ B D');
    await page.screenshot({ path: path.join(outDir, 'step3_C_major_E7_light.png') });

    // 只开和弦
    await page.selectOption('#scale-select', 'none');
    await page.selectOption('#chord-root-select', 'A');
    await page.selectOption('#chord-select', 'm7');
    d = await dots();
    check('只开和弦 Am7：只标 A C E G，没有淡色音', d.length === expectCount([9, 0, 4, 7]) && d.every(x => x.kind === 'chord'), d.length);
    check('只开和弦：没有描边和虚线圈', !d.some(x => x.ring || x.dashed));
    check('只开和弦：图例只有和弦一行', await page.locator('#lg-scale').count() === 0 && await chips('#lg-chord') === 'A C E G');

    // 减七：重降号
    await page.selectOption('#chord-root-select', 'C');
    await page.selectOption('#chord-select', 'dim7');
    check('Cdim7 图例 = C E♭ G♭ B𝄫', await chips('#lg-chord') === 'C E♭ G♭ B𝄫');

    // 两个都关
    await page.selectOption('#chord-select', 'none');
    check('音阶、和弦都不显示 → 没有圆点、图例隐藏', (await dots()).length === 0 && await page.isHidden('#legend'));

    // 记住设置
    await page.selectOption('#scale-select', 'natural-minor');
    await page.selectOption('#root-select', 'A');
    await page.selectOption('#chord-root-select', 'E');
    await page.selectOption('#chord-select', '7');
    await page.reload();
    check('刷新后记住音阶和和弦设置',
      await page.inputValue('#root-select') === 'A' && await page.inputValue('#scale-select') === 'natural-minor'
      && await page.inputValue('#chord-root-select') === 'E' && await page.inputValue('#chord-select') === '7');
    d = await dots();
    check('A 自然小调 + E7：G♯ 是调外音（和声小调的来源）', at(d, 6, 4)?.outside === true);

    // 调色面板能调叠加颜色
    await page.click('#color-btn');
    await page.$eval('.cp-item[data-key="scale-muted"] input[type="color"]', el => {
      el.focus(); el.value = '#123456'; el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    d = await dots();
    check('调色面板改“其他音阶音”颜色 → 淡色圆点立刻变色', d.some(x => x.kind === 'muted' && x.fill === 'rgb(18, 52, 86)'));
    await page.click('#cp-reset');
    check('页面无报错（和弦叠加）', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  {
    const { context, page } = await openPage('index.html', { colorScheme: 'dark', viewport: { width: 1400, height: 820 } });
    await page.selectOption('#root-select', 'A');
    await page.selectOption('#scale-select', 'natural-minor');
    await page.selectOption('#chord-root-select', 'E');
    await page.selectOption('#chord-select', '7');
    await page.click('#label-mode [data-label="degree"]');
    await page.screenshot({ path: path.join(outDir, 'step3_A_minor_E7_degree_dark.png') });
    await context.close();
  }

  // ---------- v0.2：品数 12～24 ----------
  {
    const { context, page, errors } = await openPage('index.html', { colorScheme: 'light', viewport: { width: 1400, height: 820 } });
    const OPEN = { 1: 4, 2: 11, 3: 7, 4: 2, 5: 9, 6: 4 };
    const board = () => page.evaluate(() => {
      const svg = document.getElementById('fretboard');
      const xs = [...document.querySelectorAll('.fret')].map(l => +l.getAttribute('x1'));
      const nut = +document.querySelector('.nut').getAttribute('x') + 3;
      const widths = xs.map((x, i) => x - (i ? xs[i - 1] : nut));
      return {
        frets: +svg.dataset.frets, pos: document.querySelectorAll('.pos').length, fretLines: xs.length,
        inlays: [...document.querySelectorAll('.inlay')].map(c => +c.dataset.fret).sort((a, b) => a - b),
        nums: [...document.querySelectorAll('.fret-num')].map(t => +t.textContent),
        minSlot: Math.min(...widths), dots: document.querySelectorAll('.dot').length,
        pcAt: (s, f) => null,
        pc_1_24: (document.querySelector('.pos[data-string="1"][data-fret="24"]') || {}).dataset?.pc,
        overflowX: document.documentElement.scrollWidth > window.innerWidth,
        wrapScrolls: (w => w.scrollWidth > w.clientWidth + 1)(document.querySelector('.board-wrap'))
      };
    });
    const opts = await page.$$eval('#fret-select option', os => os.map(o => +o.value));
    check('品数下拉有 12～24 共 13 项', JSON.stringify(opts) === JSON.stringify([...Array(13).keys()].map(i => i + 12)), opts);
    check('默认 15 品', await page.inputValue('#fret-select') === '15');
    const countScale = (pcs, N) => { let c = 0; for (let s = 1; s <= 6; s++) for (let f = 0; f <= N; f++) if (pcs.includes((OPEN[s] + f) % 12)) c++; return c; };
    const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
    const EXPECT_INLAYS = { 12: [3, 5, 7, 9, 12, 12], 15: [3, 5, 7, 9, 12, 12, 15], 19: [3, 5, 7, 9, 12, 12, 15, 17, 19],
      22: [3, 5, 7, 9, 12, 12, 15, 17, 19, 21], 24: [3, 5, 7, 9, 12, 12, 15, 17, 19, 21, 24, 24] };
    for (const N of [12, 19, 22, 24]) {
      await page.selectOption('#fret-select', String(N));
      const b = await board();
      check(`${N} 品：位置数 = 6 × ${N + 1}，品丝 ${N} 根，品号 0～${N}`,
        b.frets === N && b.pos === 6 * (N + 1) && b.fretLines === N && b.nums.join() === [...Array(N + 1).keys()].join(), b);
      check(`${N} 品：品位点正确`, JSON.stringify(b.inlays) === JSON.stringify(EXPECT_INLAYS[N]), b.inlays);
      check(`${N} 品：最窄的品格也放得下带圈的圆点（≥ 40）`, b.minSlot >= 40, b.minSlot.toFixed(1));
      check(`${N} 品：C 大调圆点数量正确`, b.dots === countScale(C_MAJOR, N), b.dots);
      check(`${N} 品：页面没有横向滚动条（1400 宽）`, !b.overflowX);
      check(`${N} 品：1400 宽窗口里指板完整显示，不用左右拖`, !b.wrapScrolls);
      if (N === 24) {
        check('24 品：1 弦 24 品是 E', b.pc_1_24 === '4', b.pc_1_24);
        await page.selectOption('#chord-root-select', 'G');
        await page.selectOption('#chord-select', '7');
        await page.screenshot({ path: path.join(outDir, 'v02_24frets_light.png') });
        await page.selectOption('#chord-select', 'none');
      }
    }
    await page.reload();
    check('刷新后记住品数（24）', await page.inputValue('#fret-select') === '24' && (await board()).frets === 24);
    await page.selectOption('#fret-select', '12');
    await page.screenshot({ path: path.join(outDir, 'v02_12frets_light.png') });
    check('页面无报错（品数）', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ---------- v0.2：自适应宽度 + 界面缩放 ----------
  {
    const { context, page, errors } = await openPage('index.html', { colorScheme: 'light', viewport: { width: 2400, height: 1300 }, deviceScaleFactor: 1 });
    const boardW = () => page.evaluate(() => document.getElementById('fretboard').getBoundingClientRect().width);
    const w = await boardW();
    check('大屏（2400 宽）：指板宽度跟随窗口，超过 2000 像素', w > 2000, Math.round(w));
    const h1 = () => page.evaluate(() => document.querySelector('header h1').getBoundingClientRect().height);
    const h0 = await h1();
    check('缩放按钮默认显示 100%', (await page.textContent('#zoom-reset')) === '100%');
    await page.click('#zoom-in'); await page.click('#zoom-in');
    check('点两次 A+ → 120%', (await page.textContent('#zoom-reset')) === '120%');
    const h2 = await h1();
    check('放大后标题文字变大（约 1.2 倍）', h2 / h0 > 1.15 && h2 / h0 < 1.25, (h2 / h0).toFixed(3));
    const w2 = await boardW();
    // 页面四周留白会随缩放变大，所以允许 2% 以内的差距
    check('放大后指板宽度基本不变（差距 < 2%，不超出窗口）', Math.abs(w2 - w) / w < 0.02 && w2 <= 2400, [Math.round(w), Math.round(w2)]);
    const bh = await page.evaluate(() => document.getElementById('fretboard').getBoundingClientRect().height);
    check('指板高度不超过窗口高度的 78%', bh <= 1300 * 0.78 + 1, Math.round(bh));
    await page.reload();
    check('刷新后记住缩放 120%', (await page.textContent('#zoom-reset')) === '120%');
    await page.screenshot({ path: path.join(outDir, 'v02_2400_zoom120.png') });
    for (let i = 0; i < 20; i++) await page.click('#zoom-out', { force: true }).catch(() => {});
    check('缩小到下限 70% 后 A− 变灰不可点', (await page.textContent('#zoom-reset')) === '70%' && await page.isDisabled('#zoom-out'));
    await page.click('#zoom-reset');
    check('点中间的百分比 → 恢复 100%', (await page.textContent('#zoom-reset')) === '100%');
    for (let i = 0; i < 20; i++) await page.click('#zoom-in', { force: true }).catch(() => {});
    check('放大到上限 200% 后 A+ 变灰不可点', (await page.textContent('#zoom-reset')) === '200%' && await page.isDisabled('#zoom-in'));
    check('页面无报错（缩放）', errors.length === 0, errors.join(' | '));
    await context.close();
  }
  {
    // 手机宽度：页面本身不能左右晃，指板在自己的框里左右滑动
    const { context, page, errors } = await openPage('index.html', { colorScheme: 'dark', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const info = await page.evaluate(() => {
      const wrap = document.querySelector('.board-wrap');
      return { pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
        wrapScrolls: wrap.scrollWidth > wrap.clientWidth };
    });
    check('手机宽度（390）：页面整体没有横向滚动', !info.pageOverflow, info);
    check('手机宽度：指板可以在框内左右滑动', info.wrapScrolls, info);
    await page.screenshot({ path: path.join(outDir, 'v02_phone_dark.png'), fullPage: true });
    check('页面无报错（手机宽度）', errors.length === 0, errors.join(' | '));
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
