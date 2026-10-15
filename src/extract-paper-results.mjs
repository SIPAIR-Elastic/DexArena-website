import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || join(root, '..', '_ICLR_2027__DexArena_Benchmark', 'main.tex');
const latex = (await readFile(source, 'utf8')).split('\n').map(line => line.replace(/(?<!\\)%.*$/, '')).join('\n').replace(/\\iffalse[\s\S]*?\\fi/g, '');
const models = ['PPO', 'RLPD', 'ACT', 'Diffusion Policy', 'GR00T', 'π0.5'];
const families = ['Demo-guided RL', 'Demo-guided RL', 'Imitation learning', 'Imitation learning', 'VLA', 'VLA'];
const clean = value => value.replace(/\\(?:cellcolor|rowcolor)\{[^}]*\}/g, '').replace(/\\(?:textbf|mathbf)\{/g, '').replace(/[{}$]/g, '').replace(/\\pm/g, ' ± ').replace(/_/g, '').trim();
function extract(label, count, stage) {
  const start = latex.indexOf(`\\label{${label}}`);
  if (start < 0) throw new Error(`Missing table ${label}`);
  const table = latex.slice(start, latex.indexOf('\\end{table', start));
  const rows = [];
  for (const line of table.split('\n')) {
    const cells = line.split('&').map(clean);
    const isAverage = /\\textbf\{Average\}/.test(line);
    const name = isAverage ? 'Average' : cells[stage ? 1 : 0];
    const values = cells.slice(isAverage ? 1 : stage ? 2 : 1).map(cell => cell.replace(/\\\\.*$/, '').trim());
    if (!name || !values.length || !values.every(v => /^\d+(?:\.\d+)?(?:\s*±\s*\d+(?:\.\d+)?)?$/.test(v))) continue;
    rows.push({ name, values: values.map(v => { const [mean, std] = v.split('±').map(Number); return std === undefined ? { mean } : { mean, std }; }) });
  }
  // The cross-scene average is formatted across multiple lines in the paper.
  let average = rows.find(r => r.name === 'Average');
  if (!average) {
    const summary = table.slice(table.lastIndexOf('\\multicolumn{2}{l}{\\textbf{Average}}'));
    const values = [...summary.matchAll(/(\d+\.\d+)_\{\\pm (\d+\.\d+)\}/g)].map(m => ({mean:Number(m[1]), std:Number(m[2])}));
    if (values.length === 6) average = { name:'Average', values };
  }
  const data = rows.filter(r => r.name !== 'Average');
  if (data.length !== count || data.some(r => r.values.length !== 6) || !average) throw new Error(`Invalid ${label}: ${data.length} rows`);
  const calculated = models.map((_, i) => Number((data.reduce((sum, r) => sum + r.values[i].mean, 0) / count).toFixed(1)));
  return { label, rows:data, reportedAverage:average.values, calculatedAverage:calculated };
}
const results = {
  source:'main.tex', sourceDescription:'DexArena ICLR 2027 manuscript source supplied by the benchmark authors',
  models:models.map((name,i)=>({name,family:families[i]})),
  protocol:{episodes:50,scenes:3,stageTasks:30,longHorizonTasks:10},
  stage:extract('tab:stage-level-tasks-performance',30,true),
  generalization:extract('tab:generalization-performance',30,true),
  longHorizon:extract('tab:long-horizon-performance',10,false),
};
await writeFile(join(root,'src','paper-results.json'),JSON.stringify(results,null,2)+'\n');
await mkdir(join(root,'dist','assets','results'),{recursive:true});
await writeFile(join(root,'dist','assets','results','paper-results.json'),JSON.stringify(results,null,2)+'\n');
for (const [track, data] of Object.entries(results).filter(([,v])=>v?.rows)) {
  const header=['Task',...models.flatMap(m=>track==='generalization'?[m+' mean (%)',m+' scene std (%)']:[m+' success (%)'])];
  const rows=data.rows.map(row=>[row.name,...row.values.flatMap(v=>track==='generalization'?[v.mean,v.std]:[v.mean])].join(','));
  await writeFile(join(root,'dist','assets','results',track+'.csv'),[header.join(','),...rows].join('\n')+'\n');
  console.log(track, JSON.stringify({reported:data.reportedAverage.map(v=>v.mean),calculated:data.calculatedAverage}));
}
