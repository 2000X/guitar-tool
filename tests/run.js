// 命令行运行全部乐理检查：node tests/run.js
const Theory = require('../js/theory.js');
const { runAll, summarize } = require('./cases.js');

const results = runAll(Theory);
const sum = summarize(results);
let lastGroup = '';
for (const r of results) {
  if (r.group !== lastGroup) { console.log('\n【' + r.group + '】'); lastGroup = r.group; }
  const mark = { pass: '✓', fail: '✗', todo: '○' }[r.status];
  let line = '  ' + mark + ' ' + r.name;
  if (r.status === 'fail') line += '\n      实际：' + r.actual + '\n      应为：' + r.expected;
  console.log(line);
}
console.log(`\n合计 ${sum.total} 项：通过 ${sum.pass}，失败 ${sum.fail}，待实现 ${sum.todo}`);
process.exit(sum.fail > 0 ? 1 : 0);
