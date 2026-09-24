/*
 * 界面自动检查（由 Claude 在自动浏览器里运行）：
 *   node tests/ui_check.js <项目文件夹> <截图输出文件夹>
 * 检查页面报错、指板结构、每个位置的音，并截取浅色/深色截图。
 */
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(process.argv[2] || '.');
const outDir = path.resolve(process.argv[3] || '.');
const Theory = require(path.join(root, 'js/theory.js'));

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

(async () => {
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 520 }, colorScheme: scheme, deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('file://' + path.join(root, 'index.html'));
    await page.waitForSelector('#fretboard .pos');

    if (scheme === 'light') {
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
      check('品位点：3 5 7 9 15 单点，12 双点', JSON.stringify(info.inlays.sort((a,b)=>a-b)) === JSON.stringify([3,5,7,9,12,12,15]), info.inlays);
      check('弦名从上到下 E B G D A E', info.labels.join('') === 'EBGDAE', info.labels.join(' '));
      check('品号 0～15', info.nums.join(',') === [...Array(16).keys()].join(','), info.nums.join(','));
      const ys = Object.fromEntries(info.stringYs);
      check('1 弦在最上面，6 弦在最下面', ys[1] < ys[2] && ys[2] < ys[3] && ys[5] < ys[6], JSON.stringify(ys));
      const wrong = info.pcs.filter(([s, f, pc]) => pc !== Theory.pcAt(s, f));
      check('页面上每个位置的音都与乐理核心一致', wrong.length === 0, JSON.stringify(wrong));
      const at = (s, f) => info.pcs.find(p => p[0] === s && p[1] === f)[2];
      check('标准答案 #10：6 弦 0 品 E、12 品 E、1 弦 15 品 G',
        at(6, 0) === 4 && at(6, 12) === 4 && at(1, 15) === 7);
      check('页面没有横向滚动条（1400 宽）', !info.overflowX);
    }
    check(`页面无报错（${scheme === 'light' ? '浅色' : '深色'}）`, errors.length === 0, errors.join(' | '));
    await page.screenshot({ path: path.join(outDir, `index_${scheme}.png`), fullPage: true });
    await page.close();
  }

  // 自检页
  const p = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(root, '自检.html'));
  const sum = JSON.parse(await p.getAttribute('body', 'data-summary'));
  check('自检页能打开且无报错', errs.length === 0, errs.join(' | '));
  check('自检页：没有失败项', sum.fail === 0, JSON.stringify(sum));
  await p.screenshot({ path: path.join(outDir, 'selfcheck.png'), fullPage: true });
  await browser.close();

  for (const c of checks) console.log((c.ok ? '  ✓ ' : '  ✗ ') + c.name + (c.ok ? '' : '  → ' + c.detail));
  const failed = checks.filter(c => !c.ok).length;
  console.log(`\n界面检查 ${checks.length} 项：通过 ${checks.length - failed}，失败 ${failed}`);
  process.exit(failed ? 1 : 0);
})();
