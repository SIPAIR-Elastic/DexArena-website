import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {leaderboardMetrics,heatmapInk} from '../src/leaderboard.mjs';
const paper=JSON.parse(await readFile(new URL('../src/paper-results.json',import.meta.url),'utf8'));
const trackIds=['stage','generalization','longHorizon'];
const metrics=Object.fromEntries(trackIds.map(id=>[id,leaderboardMetrics(paper,id)]));

test('Leaderboard summaries use reported averages, positive row results and positive best ties',()=>{
  for(const [id,leader,score,gap,nonzero,best] of [['stage','GR00T',61.4,3.4,29,9],['generalization','π0.5',49.2,3.8,27,14],['longHorizon','π0.5',1.6,.4,2,2]]){
    const result=metrics[id];
    assert.equal(result.leader.name,leader);
    assert.equal(result.leader.value.mean,score);
    assert(Math.abs(result.gap-gap)<1e-10);
    assert.equal(result.nonzero,nonzero);
    assert.equal(result.best,best);
  }
  assert.equal(metrics.generalization.leader.value.std,2.3);
  assert.deepEqual(metrics.longHorizon.ranked.map(model=>model.rank),[1,2,3,3,3,3],'Equal zero averages share a rank instead of implying a meaningful ordering');
});
test('Success-distribution segments partition every original row without inventing outcomes',()=>{
  const expected={stage:[[18,3,6,3],[9,5,7,9],[4,9,12,5],[4,15,9,2],[1,9,16,4],[4,9,14,3]],generalization:[[13,11,5,1],[18,7,4,1],[4,12,13,1],[9,15,6,0],[0,19,9,2],[3,12,13,2]],longHorizon:[[10,0,0,0],[10,0,0,0],[8,2,0,0],[10,0,0,0],[10,0,0,0],[8,2,0,0]]};
  for(const id of trackIds){
    assert.deepEqual(metrics[id].distributions.map(model=>model.counts),expected[id]);
    for(const model of metrics[id].distributions)assert.equal(model.counts.reduce((a,b)=>a+b,0),paper[id].rows.length);
  }
});
test('The enhanced page preserves all 420 original method/row values and scene deviations',async()=>{
  const html=await readFile(new URL('../dist/leaderboard/index.html',import.meta.url),'utf8');
  let count=0;
  for(const id of trackIds){
    const panel=html.split(`data-result-panel="${id}"`)[1].split('<section data-result-panel=')[0];
    // Cell identity is explicit, independent of the human-readable stage label.
    const cells=[...panel.matchAll(/<td\b(?=[^>]*\bdata-heat-cell\b)[^>]*>/g)].map(([tag])=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value])));
    assert.equal(cells.length,paper[id].rows.length*paper.models.length,`${id}: complete heatmap data`);
    for(const cell of cells){
      const row=paper[id].rows[Number(cell['data-row'])],method=Number(cell['data-col']),value=row.values[method];
      assert.equal(cell['data-source-name'],row.name);
      assert.equal(cell['data-method'],paper.models[method].name);
      assert.equal(Number(cell['data-mean']),value.mean);
      assert.equal(cell['data-std']===undefined?undefined:Number(cell['data-std']),value.std);
      count++;
    }
  }
  assert.equal(count,420);
  assert.deepEqual(JSON.parse(await readFile(new URL('../dist/assets/results/paper-results.json',import.meta.url),'utf8')),paper);
});
test('Heatmap foreground chooses a high-contrast neutral for the entire success scale',()=>{
  for(let mean=0;mean<=100;mean+=.5)assert(['#000','#fff'].includes(heatmapInk(mean)));
  assert.equal(heatmapInk(0),'#000');
  assert.equal(heatmapInk(100),'#fff');
});
test('The result UI has accessible inspectors, truthful scales and unchanged export routes',async()=>{
  const html=await readFile(new URL('../dist/leaderboard/index.html',import.meta.url),'utf8');
  assert(html.includes('data-leaderboard-enhanced'));
  assert.equal([...html.matchAll(/data-ranking-chart\b/g)].length,3);
  assert.equal([...html.matchAll(/data-heatmap\b/g)].length,3);
  assert.equal([...html.matchAll(/data-heat-detail\b/g)].length,3);
  assert.equal([...html.matchAll(/data-distribution-method=/g)].length,18);
  assert(html.includes('data-full-scale="100" data-detail-scale="2"'));
  assert(html.includes('data-chart-scale="detail" aria-pressed="false"'));
  for(const id of trackIds)assert(html.includes(`/assets/results/${id}.csv" download`));
  assert(/scene standard deviation, not confidence intervals/.test(html));
  assert(!/href="[^\"]*\/docs\//.test(html));
});
