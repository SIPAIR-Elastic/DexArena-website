const html=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export function benchmarkScope(tasks,protocol){
  const stages=tasks.reduce((sum,task)=>sum+task.stages.length,0);
  const scenes=protocol.scenes,episodes=stages*100;
  return `<section class="home-scale section" id="benchmark-scale" aria-labelledby="scope-title">
    <div class="home-scale-heading"><span>Benchmark at a glance</span><h2 id="scope-title">Built for connected manipulation.</h2></div>
    <div class="home-scale-facts">
      <div><dl><dt>Long-horizon tasks</dt><dd data-scope-value="sequences">${tasks.length}</dd></dl><p>Dependent sequences with two to five stages.</p><a href="/tasks/">Browse the tasks ↗</a></div>
      <div><dl><dt>Canonical stage tasks</dt><dd data-scope-value="stages">${stages}</dd></dl><p>Physically grounded success conditions.</p><a href="/tasks/">Explore stage definitions ↗</a></div>
      <div><dl><dt>Replay-validated episodes</dt><dd data-scope-value="episodes">${episodes.toLocaleString('en-US')}</dd></dl><p>100 per stage · 9.1 hours · 20 Hz.</p><a href="#data-pipeline">View the data pipeline ↗</a></div>
      <div><dl><dt>Stage–scene combinations</dt><dd data-scope-value="combinations">${stages*scenes}</dd></dl><p>${stages} stages across ${scenes} native kitchens.</p><a href="/leaderboard/#evaluation-scenes">Explore scene settings ↗</a></div>
    </div>
  </section>`;
}

export function findingsDigest(paper){
  const rows=id=>paper.models.map((model,i)=>({...model,...paper[id].reportedAverage[i]})).sort((a,b)=>b.mean-a.mean);
  const stage=rows('stage'),generalization=rows('generalization'),sequence=rows('longHorizon');
  const transferLeader=generalization[0],transferIndex=paper.models.findIndex(model=>model.name===transferLeader.name);
  const gap=paper.stage.reportedAverage[transferIndex].mean-transferLeader.mean;
  const successfulMethods=sequence.filter(model=>model.mean>0).map(model=>model.name);
  const definitions=[
    {id:'stage',name:'Stage execution',title:'Strong individual skills.',copy:`${stage[0].name} records the highest average success in the training scene. ${stage[1].name} and ${stage[2].name} follow, but no method consistently solves every stage.`,scope:'30 stages · training scene',link:'Stage-level results',insight:`advantage over ${stage[1].name}`,note:'50 evaluation episodes per stage. Scores are averaged over 30 canonical stages.'},
    {id:'generalization',name:'Visual generalization',title:'A different scene changes the ranking.',copy:`${transferLeader.name} leads across three held-out kitchens. Its average is ${Math.abs(gap).toFixed(1)} percentage points ${gap>=0?'below':'above'} the training-scene result; the same policy is evaluated without adaptation.`,scope:'30 stages × 3 native scenes',link:'Cross-scene results',insight:`advantage over ${generalization[1].name}`,note:'50 episodes per stage per scene. ± denotes standard deviation across three scene averages, not a confidence interval.'},
    {id:'longHorizon',name:'Full task completion',title:'The sequence remains the challenge.',copy:`${successfulMethods.join(' and ')} report non-zero average success on complete sequences. Successful individual stages do not yet translate into reliable end-to-end behavior.`,scope:'10 sequences · no stage resets',link:'Complete-sequence results',insight:'methods with non-zero sequence success',note:'50 episodes per complete task. Success requires reaching the final task condition without resets between stages.'}
  ];
  return `<div class="findings-digest" data-findings>
    <div class="findings-tabs" data-findings-tabs aria-label="Compare evaluation tracks">${definitions.map((track,i)=>`<button type="button" id="finding-tab-${track.id}" data-finding-tab="${track.id}"><span class="finding-tab-index">0${i+1}</span><span class="finding-tab-label">${track.name}</span><strong>${rows(track.id)[0].mean.toFixed(1)}<small>%</small></strong><span class="finding-tab-detail">Best average success</span></button>`).join('')}</div>
    ${definitions.map((track,index)=>{
      const ranked=rows(track.id),winner=ranked[0];
      return `<section class="finding-panel" id="finding-panel-${track.id}" data-finding-panel="${track.id}" aria-labelledby="finding-tab-${track.id}">
        <div class="finding-story"><span class="editorial-label">0${index+1} / ${track.scope}</span><h3>${track.title}</h3><p>${track.copy}</p><div class="finding-insight">${track.id==='longHorizon'?`<strong>${ranked.filter(r=>r.mean>0).length}<small> / ${ranked.length}</small></strong>`:`<strong>+${(winner.mean-ranked[1].mean).toFixed(1)}<small> pp</small></strong>`}<span>${track.insight}</span></div><a class="editorial-link" href="/leaderboard/#results-${track.id}">${track.link} <span aria-hidden="true">↗</span></a></div>
        <figure class="finding-comparison"><figcaption><span>Average success by policy</span><span>Success (%) · 0–100</span></figcaption><div class="finding-axis" aria-hidden="true"><span>0</span><span>50</span><span>100</span></div><ol>${ranked.map((model,i)=>`<li class="${i===0?'is-leading':''}" data-finding-method="${html(model.name)}" data-finding-score="${model.mean.toFixed(1)}"><span class="finding-method">${html(model.name)}</span><span class="finding-bar" aria-hidden="true"><i style="--success:${model.mean}%"></i></span><span class="finding-score">${model.mean.toFixed(1)}${model.std===undefined?'':`<small> ± ${model.std.toFixed(1)}</small>`}<span class="sr-only"> percent success</span></span></li>`).join('')}</ol><p>${track.note}</p></figure>
      </section>`;
    }).join('')}
    <div class="findings-source"><span>Manuscript baseline results · ${paper.models.length} methods · Not a live submission ranking</span><a href="/leaderboard/protocol/">How to read these results ↗</a></div>
  </div>`;
}
