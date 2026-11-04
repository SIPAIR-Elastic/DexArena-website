import {methodCatalog,resultSnapshot,leaderboardUpdates} from './leaderboard-catalog.mjs';

const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const percent=value=>`${value.mean.toFixed(1)}${value.std===undefined?'':` <small>± ${value.std.toFixed(1)}</small>`}`;
const familyId=family=>family.toLowerCase().includes('vla')?'vla':family.toLowerCase().includes('imitation')?'imitation':'rl';
const colors={rl:'#8093ad',imitation:'#2a72d5',vla:'#143e7a'};
const column=model=>`data-method-column data-method="${escape(model.name)}" data-family="${escape(model.family.toLowerCase())}"`;
const visual=model=>`data-visual-method data-method="${escape(model.name)}" data-family="${escape(model.family.toLowerCase())}"`;
const dot=model=>`<i class="method-dot" aria-hidden="true" style="--method-color:${colors[familyId(model.family)]}"></i>`;
const rowLabel=id=>id==='longHorizon'?'tasks':'stages';
const methodId=name=>methodCatalog.find(model=>model.name===name).id;
const methodAnchor=name=>`#method-${methodId(name)}`;
const dateLabel=iso=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T00:00:00Z`));
export function heatmapInk(mean){
  const lightness=(98-mean*.52)/100,saturation=.72;
  const a=saturation*Math.min(lightness,1-lightness);
  const channel=n=>{const k=(n+217/30)%12;return lightness-a*Math.max(-1,Math.min(k-3,9-k,1))};
  const linear=value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
  const luminance=.2126*linear(channel(0))+.7152*linear(channel(8))+.0722*linear(channel(4));
  return (luminance+.05)/.05>=1.05/(luminance+.05)?'#000':'#fff';
}

export function leaderboardMetrics(paper,id){
  const data=paper[id];
  const ranked=paper.models.map((model,index)=>({...model,index,value:data.reportedAverage[index]})).sort((a,b)=>b.value.mean-a.value.mean);
  ranked.forEach(model=>{model.rank=1+ranked.filter(other=>other.value.mean>model.value.mean).length});
  const leader=ranked[0];
  return {ranked,leader,gap:leader.value.mean-ranked[1].value.mean,
    nonzero:data.rows.filter(row=>row.values[leader.index].mean>0).length,
    best:data.rows.filter(row=>row.values[leader.index].mean>0&&row.values[leader.index].mean===Math.max(...row.values.map(value=>value.mean))).length,
    distributions:paper.models.map((model,index)=>({...model,index,counts:[
      data.rows.filter(row=>row.values[index].mean===0).length,
      data.rows.filter(row=>row.values[index].mean>0&&row.values[index].mean<50).length,
      data.rows.filter(row=>row.values[index].mean>=50&&row.values[index].mean<100).length,
      data.rows.filter(row=>row.values[index].mean===100).length
    ]}))};
}

function taskRow(tasks,id,index){
  const task=id==='longHorizon'?tasks[index]:tasks.find(task=>index>=task.cover&&index<task.cover+task.stages.length);
  return {task,label:id==='longHorizon'?task.title:task.stages[index-task.cover][0]};
}

function rankingChart(paper,track){
  const {ranked}=leaderboardMetrics(paper,track.id);
  const detail=track.id==='longHorizon'?Math.max(1,Math.ceil(ranked[0].value.mean)):100;
  return `<section class="ranking-panel"><div class="visual-heading"><div><span class="insight-eyebrow">Policy comparison</span><h3>Average success</h3></div>${track.id==='longHorizon'?'<span class="chart-detail-hint">Small differences matter here.</span>':'<span class="chart-detail-hint">Higher is better</span>'}</div>
    <div class="ranking-chart" data-ranking-chart data-full-scale="100" data-detail-scale="${detail}">
      ${track.id==='longHorizon'?`<div class="chart-scale-controls" aria-label="Chart scale"><button type="button" data-chart-scale="full" aria-pressed="true">Full scale · 0–100%</button><button type="button" data-chart-scale="detail" aria-pressed="false">Detail · 0–${detail}%</button></div>`:''}
      <div class="chart-axis" aria-hidden="true"><span>Method / global rank</span><div>${[0,25,50,75,100].map(tick=>`<span data-axis-tick>${tick}</span>`).join('')}</div><span>Success (%)</span></div>
      ${ranked.map((model,index)=>{
        const value=model.value,left=Math.max(0,value.mean-(value.std||0)),right=Math.min(100,value.mean+(value.std||0));
        return `<div class="chart-row${index===0?' is-leading':''}" ${visual(model)} data-rank="${model.rank}" data-mean="${value.mean}"${value.std===undefined?'':` data-std="${value.std}"`}>
          <span class="chart-label"><small>${String(model.rank).padStart(2,'0')}</small><b><a href="${methodAnchor(model.name)}">${dot(model)}${escape(model.name)}</a></b><em>${escape(model.family)}</em></span>
          <div class="chart-track" role="img" aria-label="${escape(model.name)}: ${value.mean.toFixed(1)} percent success${value.std===undefined?'':`, scene standard deviation ${value.std.toFixed(1)} percentage points`}"><div class="chart-bar" style="width:${value.mean}%;--method-color:${colors[familyId(model.family)]}"></div>${value.std===undefined?'':`<div class="chart-whisker" style="left:${left}%;width:${right-left}%"></div>`}</div>
          <span class="chart-value">${percent(value)}<small>%</small></span>
        </div>`;
      }).join('')}
      <p class="chart-note" data-scale-note role="status" aria-live="polite">Shared 0–100% scale.${track.id==='generalization'?' Whiskers show ±1 standard deviation across three scenes, not confidence intervals.':track.id==='longHorizon'?' Use Detail to inspect low non-zero results; the scale will be explicitly changed.':''}</p>
    </div>
    <div class="method-key" aria-label="Method families">${[['rl','Demo-guided RL'],['imitation','Imitation learning'],['vla','VLA']].map(([id,label])=>`<span><i class="method-dot" aria-hidden="true" style="--method-color:${colors[id]}"></i>${label}</span>`).join('')}</div>
  </section>`;
}

function insight(paper,track){
  const metrics=leaderboardMetrics(paper,track.id),total=paper[track.id].rows.length;
  return `<aside class="track-insight" aria-label="${escape(track.label)} context"><span class="insight-eyebrow">Highest reported average</span><h3 class="insight-leader">${escape(metrics.leader.name)}</h3><p class="insight-score">${percent(metrics.leader.value)}<small>%</small></p><p class="insight-description">${track.id==='longHorizon'?'Complete sequences remain substantially harder than isolated skills.':track.id==='generalization'?'The leading reported average across the three held-out kitchens.':'The leading reported average in the training scene.'}</p>
    <dl class="insight-facts"><div><dt>Gap to second reported mean</dt><dd>${metrics.gap.toFixed(1)} <small>pp</small></dd></div><div><dt>${rowLabel(track.id)==='tasks'?'Tasks':'Stages'} with non-zero success</dt><dd>${metrics.nonzero}<small> / ${total}</small></dd></div><div><dt>Positive row-best results</dt><dd>${metrics.best}<small> / ${total}</small></dd></div></dl>
    <p class="insight-note">Context uses all six methods. Row-best counts include positive ties. Non-zero means a reported row mean above 0%, not a guarantee of reliable execution.</p><a href="/leaderboard/protocol/">Understand the protocol <span aria-hidden="true">↗</span></a>
  </aside>`;
}

function distribution(paper,track){
  const total=paper[track.id].rows.length,metrics=leaderboardMetrics(paper,track.id);
  const buckets=[['Reported 0%','#dce3ed'],['Above 0%, below 50%','#bdd3f4'],['50% to below 100%','#4c87dd'],['Reported 100%','#174f9f']];
  return `<section class="distribution-panel"><div class="visual-heading"><div><span class="insight-eyebrow">Beyond the average</span><h3>Where does each policy succeed?</h3><p>Distribution of reported ${track.id==='generalization'?'scene-average ':''}success across ${total} ${rowLabel(track.id)}. Each strip contains the same number of benchmark rows.</p></div><span class="distribution-total">${total} ${rowLabel(track.id)} / method</span></div>
    <div class="distribution-legend">${buckets.map(([label,color])=>`<span><i aria-hidden="true" style="background:${color}"></i>${label}</span>`).join('')}</div>
    ${metrics.ranked.map(({index,rank})=>({...metrics.distributions[index],rank})).map(model=>`<div class="distribution-row" ${visual(model)} data-rank="${model.rank}" data-mean="${paper[track.id].reportedAverage[model.index].mean}" data-distribution-method="${escape(model.name)}" data-distribution-counts="${model.counts.join(',')}"><span class="distribution-name">${dot(model)}${escape(model.name)}</span><div class="distribution-track" role="img" aria-label="${escape(model.name)}: ${model.counts.map((count,index)=>`${count} ${rowLabel(track.id)} with ${buckets[index][0].toLowerCase()}`).join('; ')}">${model.counts.map((count,index)=>count?`<span style="width:${count/total*100}%;--segment-color:${buckets[index][1]};--segment-ink:${index===3?'#fff':'#000'}" title="${escape(model.name)} · ${buckets[index][0]}: ${count} of ${total}"><b>${count}</b></span>`:'').join('')}</div><span class="distribution-count">${model.counts[0]} <small>at 0%</small></span></div>`).join('')}
    <p class="chart-note distribution-zero-note">Numbers inside segments are row counts, not success percentages. Segment boundaries use reported means; a reported 100% mean is not a claim of universal reliability.</p>
  </section>`;
}

function methodProfiles(paper,tracks){
  return `<details class="compare-details"><summary>Compare methods across all three tracks <span aria-hidden="true">↗</span></summary><p class="chart-note">Reported average success (%). Mini-bars retain a shared 0–100% scale; numeric labels preserve low sequence scores.</p><div class="table-scroll method-matrix"><table><caption class="sr-only">All methods across stage, cross-scene and complete-sequence evaluation</caption><thead><tr><th scope="col">Method</th>${tracks.map(track=>`<th scope="col">${escape(track.label)}</th>`).join('')}</tr></thead><tbody>${paper.models.map((model,index)=>`<tr ${visual(model)}><th scope="row">${dot(model)}${escape(model.name)}</th>${tracks.map(track=>`<td class="signature-cell"><b>${percent(paper[track.id].reportedAverage[index])}<small>%</small></b><span class="signature-bar" aria-hidden="true"><i style="width:${paper[track.id].reportedAverage[index].mean}%"></i></span></td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}

function heatmap(paper,tasks,track){
  const rows=paper[track.id].rows;
  const groups=tasks.map(task=>({task,rows:rows.map((row,index)=>({row,index,...taskRow(tasks,track.id,index)})).filter(record=>record.task.slug===task.slug)}));
  const inspector=`<div class="heatmap-inspector" data-heat-detail role="status" aria-live="polite" aria-atomic="true"><div><span class="inspector-label" data-detail-method>Result inspector</span><div class="inspector-main"><b data-detail-stage>Select a cell below</b><span data-detail-task>Inspect any method and task.</span></div></div><div><strong class="inspector-value" data-detail-value>—</strong><span data-detail-uncertainty>${track.id==='generalization'?'± indicates standard deviation across scenes.':'Success rate across 50 evaluation episodes.'}</span></div></div>`;
  return `<section data-heatmap data-row-label="${rowLabel(track.id)}"><div class="heatmap-header"><div class="visual-heading"><div><span class="insight-eyebrow">Task-level detail</span><h3>${track.id==='longHorizon'?'Sequence':'Stage'} performance map</h3></div></div><div class="heatmap-legend"><span>0%</span><i aria-hidden="true"></i><span>100%</span></div></div>
    <div class="heatmap-tools"><label><span>Find a ${track.id==='longHorizon'?'task':'stage'}</span><input type="search" data-heat-search placeholder="Task or skill name…" autocomplete="off"></label><span class="heatmap-count" data-heat-count role="status" aria-live="polite">${rows.length} of ${rows.length} ${rowLabel(track.id)}</span></div>
    <p class="chart-note">Select a cell for the exact result. Use arrow keys to move through visible cells.${track.id==='generalization'?' Colors encode the mean only; scene standard deviation appears in the result inspector.':''}</p>${inspector}
    <div class="table-scroll heatmap-scroll" tabindex="0" aria-label="Scrollable ${escape(track.label)} heatmap"><table class="heatmap-table"><caption class="sr-only">Success rates in percent, grouped by complete task. Family filters affect method columns.</caption><thead><tr><th scope="col">${track.id==='longHorizon'?'Complete task':'Task / stage'}</th>${paper.models.map(model=>`<th scope="col" ${column(model)}><span class="heatmap-method">${dot(model)}${escape(model.name)}</span></th>`).join('')}</tr></thead>
      ${groups.map(group=>`<tbody data-task-group>${track.id==='longHorizon'?'':`<tr class="heatmap-group"><th data-group-heading colspan="7"><a href="/tasks/${group.task.slug}/">${escape(group.task.title)}</a><span>${group.rows.length} stages</span></th></tr>`}${group.rows.map(({row,index,task,label})=>`<tr data-heat-row data-search-text="${escape(`${task.title} ${label} ${row.name}`.toLowerCase())}"><th scope="row"><a href="/tasks/${task.slug}/">${escape(label)}</a></th>${row.values.map((value,col)=>`<td ${column(paper.models[col])} data-heat-cell data-task="${escape(task.title)}" data-stage="${escape(label)}" data-source-name="${escape(row.name)}" data-row="${index}" data-col="${col}" data-mean="${value.mean}"${value.std===undefined?'':` data-std="${value.std}"`} tabindex="${index===0&&col===0?'0':'-1'}" style="--cell-bg:hsl(217 72% ${98-value.mean*.52}%);--cell-fg:${heatmapInk(value.mean)}" aria-label="${escape(paper.models[col].name)} · ${escape(task.title)} · ${escape(label)}: ${value.mean.toFixed(1)} percent${value.std===undefined?'':`, scene standard deviation ${value.std.toFixed(1)} percentage points`}">${value.mean.toFixed(1)}</td>`).join('')}</tr>`).join('')}</tbody>`).join('')}
    </table></div><p class="heatmap-no-results" data-heat-empty hidden>No matching tasks or stages. Try a shorter name.</p><p class="table-scroll-hint">Scroll horizontally for additional methods. Row labels stay pinned.</p>
  </section>`;
}

function fullTable(paper,tasks,track){
  const data=paper[track.id];
  return `<div class="table-scroll results-scroll" tabindex="0" aria-label="Scrollable ${escape(track.label)} results"><table class="results-table"><caption class="sr-only">${escape(track.label)} success rates in percent. Row highlights identify the positive best result across all six methods, including ties.</caption><thead><tr><th scope="col">${track.id==='longHorizon'?'Task':'Stage'}</th>${paper.models.map(model=>`<th scope="col" ${column(model)}>${escape(model.name)}</th>`).join('')}</tr></thead><tbody>${data.rows.map((row,index)=>{const best=Math.max(...row.values.map(value=>value.mean));const {task,label}=taskRow(tasks,track.id,index);return `<tr data-source-row="${escape(row.name)}"><th scope="row"><a href="/tasks/${task.slug}/">${escape(label)}</a><small>${escape(task.title)}</small></th>${row.values.map((value,col)=>`<td ${column(paper.models[col])} class="score-cell ${value.mean===best&&best>0?'best-score':''}">${percent(value)}</td>`).join('')}</tr>`}).join('')}</tbody><tfoot><tr><th scope="row">Reported average</th>${data.reportedAverage.map((value,col)=>`<td ${column(paper.models[col])} class="score-cell">${percent(value)}</td>`).join('')}</tr></tfoot></table></div>`;
}

function renderUpdates(){
  return `<section class="leaderboard-updates" id="lb-updates" aria-labelledby="lb-updates-title"><header class="lb-section-heading"><span>Release notes</span><h2 id="lb-updates-title">What changed.</h2><p>Data snapshots and interface improvements are recorded separately.</p></header><ol class="lb-update-list">${leaderboardUpdates.map(update=>`<li><time datetime="${update.date}">${dateLabel(update.date)}</time><div><span class="lb-update-kind">${escape(update.kind)}</span><h3>${escape(update.title)}</h3><p>${escape(update.description)}</p></div></li>`).join('')}</ol></section>`;
}

function renderMethodCatalog(paper){
  return `<section class="lb-methods" id="lb-methods" aria-labelledby="lb-methods-title"><header class="lb-section-heading"><span>Method reference</span><h2 id="lb-methods-title">The methods behind the numbers.</h2><p>Open a profile for the original research and the DexArena adaptation. Reference links are not claims that upstream authors submitted or verified these scores.</p></header><div class="lb-method-grid">${methodCatalog.map(model=>{
    const index=paper.models.findIndex(method=>method.name===model.name);
    const references=[['paperUrl','Original paper'],['projectUrl','Project'],['codeUrl','Upstream code']].filter(([key])=>model[key]);
    return `<details class="lb-method-card" id="method-${model.id}" data-method-card data-method="${escape(model.name)}" data-family="${escape(model.family.toLowerCase())}"><summary><span>${escape(model.name)}</span><small>${escape(model.family)}</small></summary><div class="lb-method-body"><p>${escape(model.description)}</p><div class="lb-method-scores"><dl>${[['stage','Stage'],['generalization','Cross-scene'],['longHorizon','Sequence']].map(([id,label])=>`<div><dt>${label} success</dt><dd>${percent(paper[id].reportedAverage[index])}<small>%</small></dd></div>`).join('')}</dl></div><div class="lb-method-resources">${references.map(([key,label])=>`<a href="${escape(model[key])}" target="_blank" rel="noreferrer">${label} ↗</a>`).join('')}</div><p class="lb-method-note">${escape(model.benchmarkNote)}</p></div></details>`;
  }).join('')}</div><p class="lb-evidence-note">Method profiles follow the filters in the results explorer. Scored policy checkpoints and run-level artifacts are not linked in this snapshot. <a href="/evaluation/evidence/">Read the evidence requirements →</a></p></section>`;
}

function renderRelease(snapshot,paperUrl,citation){
  return `<section class="lb-release" id="lb-provenance" aria-labelledby="lb-provenance-title"><header class="lb-section-heading"><span>Source & reproducibility</span><h2 id="lb-provenance-title">One identifiable result snapshot.</h2><p>The score source stays fixed when the website presentation changes.</p></header><article class="lb-release-panel"><dl><div><dt>Result snapshot</dt><dd><code>${escape(snapshot.id)}</code></dd></div><div><dt>Snapshot recorded in website source</dt><dd><time datetime="${snapshot.sourceRecorded}">${dateLabel(snapshot.sourceRecorded)}</time></dd></div><div><dt>Source commit</dt><dd><a href="${escape(snapshot.sourceUrl)}" target="_blank" rel="noreferrer"><code>${escape(snapshot.sourceCommit.slice(0,12))}</code> ↗</a></dd></div><div><dt>Coverage</dt><dd>6 methods · 3 tracks · ${snapshot.scoreCount} task-level results</dd></div><div><dt>Result file · SHA-256</dt><dd><code>${escape(snapshot.sha256)}</code></dd></div><div><dt>Publication status</dt><dd>Manuscript baselines · community intake not open</dd></div></dl><p>${escape(snapshot.description)}</p><div class="lb-release-actions"><a href="/assets/results/paper-results.json" download>Complete results · JSON ↓</a><a href="/assets/results/release.json" download>Snapshot manifest · JSON ↓</a><a href="${paperUrl}" target="_blank" rel="noreferrer">DexArena paper ↗</a><a href="/leaderboard/protocol/">Evaluation protocol →</a><a href="/assets/docs/dexarena-citation.bib" download>BibTeX ↓</a></div><p class="lb-evidence-note">Demonstration videos illustrate tasks; they are not scored policy rollouts. Checkpoints, evaluation seeds and episode logs must accompany any future reproducible result record. <a href="/evaluation/evidence/">Evidence checklist →</a></p>${citation?`<details class="lb-citation"><summary>Cite DexArena</summary><pre tabindex="0" aria-label="DexArena BibTeX citation"><code id="paper-bibtex">${escape(citation)}</code></pre><button type="button" data-copy-citation>Copy BibTeX</button><p data-citation-status role="status" aria-live="polite"></p></details>`:''}</article></section>`;
}

export function renderLeaderboard({paper,tasks,tracks,paperUrl,snapshot=resultSnapshot,citation=''}){
  const panels=tracks.map((track,index)=>{
    const {ranked}=leaderboardMetrics(paper,track.id);
    const ranking=ranked.map(model=>`<tr data-method-row data-method="${escape(model.name)}" data-family="${escape(model.family.toLowerCase())}" data-rank="${model.rank}" data-mean="${model.value.mean}"><td><span class="rank">${String(model.rank).padStart(2,'0')}</span></td><th scope="row">${dot(model)}${escape(model.name)}</th><td>${escape(model.family)}</td><td class="score-cell">${percent(model.value)}<small>%</small></td><td><a href="${methodAnchor(model.name)}">Method profile →</a></td></tr>`).join('');
    return `<section data-result-panel="${track.id}" id="results-${track.id}" aria-labelledby="tab-${track.id}"><div class="board-head"><div><span>${escape(track.scope)}</span><h2>${escape(track.label)}</h2><p>${escape(track.description)}</p></div><a class="arrow-link" href="/assets/results/${track.id}.csv" download><span>Download CSV</span><b aria-hidden="true">↓</b></a></div>
      <div data-result-view="charts" class="result-visual"><div class="result-dashboard">${rankingChart(paper,track)}${insight(paper,track)}</div>${distribution(paper,track)}${methodProfiles(paper,tracks)}</div>
      <div data-result-view="heatmap" class="result-visual">${heatmap(paper,tasks,track)}</div>
      <div data-result-view="tables"><div class="table-scroll"><table class="leaderboard-table"><caption class="sr-only">${escape(track.label)} global method ranking</caption><thead><tr><th scope="col">Rank</th><th scope="col">Method</th><th scope="col">Family</th><th scope="col">Average success (%) ↑</th><th scope="col">Method reference</th></tr></thead><tbody>${ranking}</tbody></table></div><div class="result-full"><div class="visual-heading"><div><span class="insight-eyebrow">Complete data</span><h3>All ${paper[track.id].rows.length} ${rowLabel(track.id)}</h3><p>Highest positive results are highlighted across all six methods, including ties.${track.id==='generalization'?' ± denotes scene standard deviation.':''}</p></div></div>${fullTable(paper,tasks,track)}<p class="table-scroll-hint">Scroll horizontally to compare methods. Stage and task names link to their definitions.</p></div></div>
    </section>`;
  }).join('');
  return `<section class="leaderboard-page" data-leaderboard-enhanced><a class="protocol-banner" href="/leaderboard/protocol/"><span><b>Evaluation protocol</b> Reproducible tasks. Fixed horizons. Shared scene definitions.</span><em>Read protocol →</em></a>
    <div class="leaderboard-head" id="lb-overview"><span>DexArena benchmark</span><h1>Leaderboard</h1><p>A closer look at dexterous policy performance.</p><div class="release-chip">Manuscript baselines · six methods · three evaluation tracks</div></div>
    <div class="board-context" aria-label="Evaluation context"><div><b>50</b><span>episodes per environment</span></div><div><b>30 / 10</b><span>stage tasks / complete sequences</span></div><div><b>3 scenes</b><span>cross-scene mean ± scene std</span></div><p>Public manuscript results.<br>Community submissions are not yet open.</p></div>
    <nav class="leaderboard-jump-nav" aria-label="Leaderboard sections">${[['lb-overview','Overview'],['lb-updates','Updates'],['lb-results','Results'],['lb-methods','Methods'],['lb-provenance','Release & evidence']].map(([id,label])=>`<a href="#${id}">${label}</a>`).join('')}</nav>
    ${renderUpdates()}
    <section id="lb-results" aria-labelledby="lb-results-title"><header class="lb-section-heading"><span>Result explorer</span><h2 id="lb-results-title">Compare on the same terms.</h2><p>Choose a track, then inspect the same reported data as charts, a task map or complete tables.</p></header><div class="leaderboard-tabs" aria-label="Result tracks">${tracks.map((track,index)=>{const {leader}=leaderboardMetrics(paper,track.id);return `<button type="button" id="tab-${track.id}" class="${index===0?'active':''}" data-result-tab="${track.id}" aria-controls="results-${track.id}" aria-pressed="${index===0}"><span class="track-tab-index">0${index+1}</span><span class="track-tab-copy"><b>${escape(track.label)}</b><small>${escape(track.scope)}</small></span><span class="track-tab-score"><strong>${leader.value.mean.toFixed(1)}<small>%</small></strong><small>highest average</small></span></button>`}).join('')}</div>
    <section class="leaderboard-board" aria-label="Interactive benchmark results"><div class="board-filter"><div class="view-switch" aria-label="Result presentation">${[['charts','Charts'],['heatmap','Heatmap'],['tables','Tables']].map(([id,label],index)=>`<button type="button" data-view-button="${id}" aria-pressed="${index===0}" class="${index===0?'active':''}">${label}</button>`).join('')}</div><span class="board-filter-meta" data-family-status role="status" aria-live="polite">6 of 6 methods</span><label><span class="board-filter-label">Method family</span><select data-method-filter><option value="all">All families</option><option value="imitation">Imitation learning</option><option value="rl">Demo-guided RL</option><option value="vla">VLA</option></select></label></div>
      <div class="lb-explorer-tools"><label><span>Find a method</span><input type="search" data-method-search placeholder="PPO, ACT, GR00T…" autocomplete="off" maxlength="100"></label><label><span>Display order</span><select data-rank-order><option value="score">Success · high to low</option><option value="name">Method name · A–Z</option></select></label><button type="button" data-copy-board-link>Copy view link</button><button type="button" data-reset-board>Reset filters</button><p data-board-link-status role="status" aria-live="polite"></p></div><p class="lb-filter-empty" data-method-empty role="status" hidden>No methods match these filters. Clear the method name or reset the filters.</p>
      ${panels}<p class="result-source">Source: DexArena manuscript experiment tables. Ranks and highlighted best results refer to all six methods; equal reported averages share a rank. Display order and filters do not change global ranks. Cross-scene ± denotes scene standard deviation, not confidence intervals. <a href="#lb-provenance">Inspect the result snapshot →</a> · <a href="/assets/results/paper-results.json" download>Download complete results (JSON) ↓</a></p>
    </section></section>${renderMethodCatalog(paper)}${renderRelease(snapshot,paperUrl,citation)}<section class="submission-cta"><div><span>Research preview</span><h2>A shared reference for the next generation.</h2><p>These are manuscript baselines, not a live community ranking. Submission intake is not yet open.</p></div><a href="/leaderboard/protocol/" class="arrow-link"><span>Evaluation protocol</span><b aria-hidden="true">↗</b></a></section>
  </section>`;
}
