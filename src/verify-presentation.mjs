import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {benchmarkScope,findingsDigest} from './presentation.mjs';

const tracks=['stage','generalization','longHorizon'];
const panelsIn=html=>[...html.matchAll(/<section\b[^>]*data-finding-panel="([^"]+)"[^>]*>[\s\S]*?<\/section>/g)];
const tabsIn=html=>[...html.matchAll(/<button\b[^>]*data-finding-tab="([^"]+)"[^>]*>[\s\S]*?<\/button>/g)];
const attributes=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));

function verifyDocument(html,label){
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,`${label}: document IDs must be unique`);
  assert.equal([...html.matchAll(/<h1\b/g)].length,1,`${label}: use one primary page title`);
}

function verifyDigest(html,paper,label){
  const tabs=tabsIn(html),panels=panelsIn(html);
  assert.equal(tabs.length,3,`${label}: expose all three track controls`);
  assert.equal(panels.length,3,`${label}: server-render every track`);
  assert.deepEqual(tabs.map(match=>match[1]),tracks);
  assert.deepEqual(panels.map(match=>match[1]),tracks);
  for(const [index,id] of tracks.entries()){
    const tab=tabs[index][0],panel=panels[index][0];
    const tabAttributes=attributes(tab.slice(0,tab.indexOf('>')));
    const panelAttributes=attributes(panel.slice(0,panel.indexOf('>')));
    assert.equal(tabAttributes.type,'button',`${label}: native keyboard-operable buttons`);
    assert.equal(tabAttributes.id,`finding-tab-${id}`);
    assert(tab.includes(`>0${index+1}</span>`),`${label}: retain numbered controls`);
    assert.equal(panelAttributes.id,`finding-panel-${id}`);
    assert.equal(panelAttributes['aria-labelledby'],tabAttributes.id);
    assert(!/\s(?:hidden|inert)(?:\s|=|>)/.test(panel.slice(0,panel.indexOf('>')+1)),`${label}: all comparisons stay readable without JavaScript`);
    assert.notEqual(panelAttributes['aria-hidden'],'true');
    assert(!/\s(?:hidden|inert)(?:\s|=|>)/.test(tab.slice(0,tab.indexOf('>')+1)),`${label}: no initially hidden track controls`);
    assert(panel.includes(`href="/leaderboard/#results-${id}"`),`${label}: link to the matching leaderboard track`);
    assert(panel.includes('Success (%) · 0–100'),`${label}: state the common comparison scale`);
    assert(panel.includes('50 '),`${label}: disclose episode count`);
    if(id==='generalization'){
      assert(panel.includes('standard deviation across three scene averages'),`${label}: define scene uncertainty`);
      assert(panel.includes('not a confidence interval'),`${label}: do not imply confidence intervals`);
    }
    if(id==='longHorizon')assert(panel.includes('without resets between stages'),`${label}: disclose sequence evaluation semantics`);
    const expected=paper.models.map((model,i)=>({...model,...paper[id].reportedAverage[i]})).sort((a,b)=>b.mean-a.mean);
    const rows=[...panel.matchAll(/<li\b[^>]*data-finding-method="([^"]+)"\s+data-finding-score="([^"]+)"[^>]*>[\s\S]*?<\/li>/g)];
    assert.equal(rows.length,6,`${label}: compare all six policies in ${id}`);
    for(const [rank,row] of rows.entries()){
      const model=expected[rank];
      assert.equal(row[1],model.name,`${label}: policy ranking follows manuscript data`);
      assert.equal(row[2],model.mean.toFixed(1),`${label}: exact manuscript average for ${model.name}`);
      assert(row[0].includes(`--success:${model.mean}%`),`${label}: bars encode data on the stated scale`);
      assert(row[0].includes(`class="finding-score">${model.mean.toFixed(1)}`),`${label}: exact visible manuscript average`);
      if(model.std!==undefined)assert(row[0].includes(`± ${model.std.toFixed(1)}`),`${label}: preserve reported scene standard deviation`);
    }
    assert(tab.includes(`<strong>${expected[0].mean.toFixed(1)}<small>%</small></strong>`),`${label}: tab summary follows the winning method`);
  }
  assert(html.includes('Not a live submission ranking'),`${label}: distinguish manuscript results from live submissions`);
  assert(html.includes('href="/leaderboard/protocol/"'),`${label}: include the interpretation protocol`);
}

function verifyScope(home){
  for(const [name,value] of [['sequences','10'],['stages','30'],['episodes','3,000'],['combinations','90']]){
    assert(home.includes(`data-scope-value="${name}">${value}</dd>`),`Scale value ${name} must be server-rendered and correct`);
  }
  const groups=home.match(/<div class="scope-stage-groups">([\s\S]*?)<\/div><p>/)?.[1];
  assert(groups,'Include the sequence-to-stage map');
  const taskLinks=[...groups.matchAll(/<a\b[^>]*href="(\/tasks\/[^/]+\/)"[^>]*>[\s\S]*?<\/a>/g)];
  assert.equal(taskLinks.length,10,'Link every complete task from the architecture map');
  assert.equal(new Set(taskLinks.map(match=>match[1])).size,10,'Architecture map links must identify ten distinct tasks');
  assert.equal([...groups.matchAll(/<b><\/b>/g)].length,30,'Represent each canonical stage exactly once');
  for(const [index,task] of taskLinks.entries()){
    const segments=[...task[0].matchAll(/<b><\/b>/g)].length;
    assert(segments>=2&&segments<=5,'Each sequence contains two to five stages');
    assert(task[0].includes(`>${String(index+1).padStart(2,'0')}</span>`),'Task map numbers remain ordered');
    assert(task[0].includes(`: ${segments} stages"`),'Accessible task labels match stage segments');
  }
  const matrix=home.match(/<figure class="scope-scene-matrix"[^>]*>([\s\S]*?)<\/figure>/)?.[1];
  assert(matrix,'Include the scene-stage coverage matrix');
  assert.equal([...matrix.matchAll(/<b><\/b>/g)].length,90,'Show the complete 30 × 3 coverage matrix');
  assert.equal([...matrix.matchAll(/class="scope-scene-row /g)].length,3,'Show three native kitchen rows');
  for(const name of ['Blue stone','Light wood','Warm wood'])assert(matrix.includes(name));
  assert(home.includes('href="/docs/data/"')&&home.includes('href="/docs/randomization/"'),'Expose data and scene protocols');
}

function verifyEnhancement(js){
  function node(dataset={}){
    return {dataset,hidden:false,tabIndex:0,attributes:{},handlers:{},focusCount:0,
      setAttribute(name,value){this.attributes[name]=value},
      addEventListener(type,handler){(this.handlers[type]??=[]).push(handler)},
      emit(type,event={}){for(const handler of this.handlers[type]??[])handler(event)},
      focus(){this.focusCount++}};
  }
  function digest({missingList=false,missingPanel=false}={}){
    const tabs=tracks.map(id=>node({findingTab:id}));
    const panels=tracks.slice(0,missingPanel?2:3).map(id=>node({findingPanel:id}));
    const list=missingList?null:node();
    return Object.assign(node(),{tabs,panels,list,
      querySelectorAll(selector){return selector==='[data-finding-tab]'?tabs:selector==='[data-finding-panel]'?panels:[]},
      querySelector(selector){return selector==='[data-findings-tabs]'?list:null}});
  }
  const first=digest(),second=digest(),incomplete=digest({missingPanel:true}),noList=digest({missingList:true});
  runInNewContext(js,{document:{querySelectorAll:selector=>selector==='[data-findings]'?[first,second,incomplete,noList]:[]}});
  function check(target,index){
    assert.equal(target.dataset.enhanced,'true');
    assert.equal(target.list.attributes.role,'tablist');
    for(const [i,tab] of target.tabs.entries()){
      assert.equal(tab.attributes.role,'tab');
      assert.equal(tab.attributes['aria-controls'],`finding-panel-${tracks[i]}`);
      assert.equal(tab.attributes['aria-selected'],String(i===index));
      assert.equal(tab.tabIndex,i===index?0:-1,'Exactly the selected tab participates in sequential keyboard navigation');
      assert.equal(target.panels[i].hidden,i!==index,'Only the selected comparison remains visible after enhancement');
      assert.equal(target.panels[i].attributes.role,'tabpanel');
    }
  }
  function key(target,index,key,expected){
    const priorFocus=target.tabs.map(tab=>tab.focusCount);let prevented=false;
    target.tabs[index].emit('keydown',{key,preventDefault(){prevented=true}});
    check(target,expected);
    assert(prevented,`Handle ${key} with no browser scrolling`);
    assert.equal(target.tabs[expected].focusCount,priorFocus[expected]+1,`${key} transfers keyboard focus`);
  }
  check(first,0);check(second,0);
  key(first,0,'ArrowLeft',2);
  key(first,2,'ArrowRight',0);
  key(first,0,'ArrowRight',1);
  key(first,1,'ArrowRight',2);
  key(first,2,'Home',0);
  key(first,0,'End',2);
  first.tabs[1].emit('click');check(first,1);
  let prevented=false;
  first.tabs[1].emit('keydown',{key:'ArrowDown',preventDefault(){prevented=true}});
  assert.equal(prevented,false,'Unrelated keys preserve native behavior');check(first,1);
  check(second,0);
  second.tabs[2].emit('click');check(second,2);check(first,1);
  for(const malformed of [incomplete,noList]){
    assert.equal(malformed.dataset.enhanced,undefined,'Incomplete markup must fail open');
    assert(malformed.panels.every(panel=>!panel.hidden),'Incomplete markup remains fully readable');
    assert(malformed.tabs.every(tab=>Object.keys(tab.handlers).length===0),'Do not install partially functioning controls');
  }
  assert.doesNotThrow(()=>runInNewContext(js,{document:{querySelectorAll:()=>[]}}),'The script is safe on pages without findings');
}

export function verifyPresentation({home,evaluation,paper,js}){
  verifyDocument(home,'Home');verifyDocument(evaluation,'Evaluation');
  verifyScope(home);
  verifyDigest(home,paper,'Home');verifyDigest(evaluation,paper,'Evaluation');
  verifyEnhancement(js);
  // Verify that the presentation consumes result data rather than frozen HTML scores.
  const altered=structuredClone(paper);
  for(const [index,id] of tracks.entries()){
    altered[id].reportedAverage=altered.models.map((_,i)=>id==='generalization'?{mean:71.1+index+i,std:1.1+i}:{mean:71.1+index+i});
  }
  verifyDigest(findingsDigest(altered),altered,'Generated alternate data');
  const syntheticTasks=Array.from({length:10},(_,i)=>({slug:`task-${i}`,title:`Task ${i+1}`,stages:Array.from({length:3},()=>[])}));
  verifyScope(benchmarkScope(syntheticTasks,paper.protocol));
}
