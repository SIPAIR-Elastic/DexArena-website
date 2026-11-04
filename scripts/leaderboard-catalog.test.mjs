import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {methodCatalog, resultSnapshot, leaderboardUpdates} from '../src/leaderboard-catalog.mjs';

const raw = await readFile(new URL('../src/paper-results.json', import.meta.url), 'utf8');
const paper = JSON.parse(raw);

test('Method references cover exactly the six score columns without changing method identities', () => {
  assert.deepEqual(methodCatalog.map(({name, family}) => ({name, family})), paper.models);
  assert.equal(new Set(methodCatalog.map(method => method.id)).size, 6);
  assert(methodCatalog.every(method => /^[a-z0-9-]+$/.test(method.id)));
  for (const method of methodCatalog) {
    assert(method.description.length > 35);
    assert(method.benchmarkNote.length > 60, `${method.name}: explain the benchmark adaptation`);
    for (const key of ['paperUrl', 'projectUrl', 'codeUrl']) {
      if (!method[key]) continue;
      const url = new URL(method[key]);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.username, '');
      assert.equal(url.password, '');
      assert.equal(url.search, '');
    }
    assert(!('scoreContributor' in method), 'Original method authors are not presented as score contributors');
    assert(!('checkpointUrl' in method), 'Unpublished evaluation checkpoints must not be invented');
  }
});

test('Primary references identify the cited methods rather than unrelated papers or newer GR00T variants', () => {
  const papers = Object.fromEntries(methodCatalog.map(method => [method.name, method.paperUrl]));
  assert.deepEqual(papers, {
    PPO: 'https://arxiv.org/abs/1707.06347',
    RLPD: 'https://proceedings.mlr.press/v202/ball23a.html',
    ACT: 'https://arxiv.org/abs/2304.13705',
    'Diffusion Policy': 'https://arxiv.org/abs/2303.04137',
    GR00T: 'https://arxiv.org/abs/2503.14734',
    'π0.5': 'https://arxiv.org/abs/2504.16054'
  });
  const groot = methodCatalog.find(method => method.name === 'GR00T');
  assert.match(groot.benchmarkNote, /cites GR00T N1/);
  assert.match(groot.benchmarkNote, /does not specify an exact checkpoint revision/);
  assert(!/N1\.7/.test(JSON.stringify(methodCatalog)));
});

test('Result provenance records the original source import without inventing an experiment date', () => {
  assert.equal(resultSnapshot.id, 'manuscript-baselines-v1');
  assert.equal(resultSnapshot.sourceRecorded, '2026-10-15');
  assert.equal(resultSnapshot.sourceRecordedLabel, 'Website data snapshot recorded');
  assert.equal(resultSnapshot.sourceCommit, '411442196821048611c1172977163bc96f8eaf12');
  assert.equal(resultSnapshot.sourceUrl, `https://github.com/SIPAIR-Elastic/DexArena-website/blob/${resultSnapshot.sourceCommit}/${resultSnapshot.sourcePath}`);
  assert.equal(resultSnapshot.paperUrl, 'https://arxiv.org/abs/2611.02629');
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'f2b997f0650d70322e9dda65346bd1680de4f61a2262977194f556cdb9b26d60', 'Data remains byte-identical to the original source import');
  assert.deepEqual(resultSnapshot.sourceTables, Object.fromEntries(['stage', 'generalization', 'longHorizon'].map(id => [id, paper[id].label])));
  assert.equal(resultSnapshot.scoreCount, ['stage', 'generalization', 'longHorizon'].reduce((sum, id) => sum + paper[id].rows.length * paper.models.length, 0));
  assert.match(resultSnapshot.description, /not when the experiments were run/);
  assert(!('dataLastUpdated' in resultSnapshot));
  assert(!('experimentDate' in resultSnapshot));
});

test('Release notes distinguish the existing data snapshot from later interface-only changes', () => {
  assert.deepEqual(leaderboardUpdates.map(update => update.date), ['2026-11-04', '2026-10-15']);
  assert.equal(leaderboardUpdates[0].kind, 'Interface update');
  assert.match(leaderboardUpdates[0].description, /not a new evaluation run/);
  assert.equal(leaderboardUpdates[1].kind, 'Data snapshot');
  assert.match(leaderboardUpdates[1].description, /not the experiment dates/);
  const text = JSON.stringify({methodCatalog, resultSnapshot, leaderboardUpdates});
  assert(!/[\u3400-\u9fff]/u.test(text), 'Public catalog and release metadata are English only');
  assert(!/\/home\/pair|file:\/\//.test(text), 'Do not publish workstation-local source paths');
  assert(!/verified badge|independently verified|certified result|new models added/i.test(text));
  assert.deepEqual(JSON.parse(text), {methodCatalog, resultSnapshot, leaderboardUpdates}, 'Metadata is safely serializable without runtime filesystem access');
});
