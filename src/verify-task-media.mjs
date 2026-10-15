import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';

export function verifyTaskMedia(js){
  const events=()=>({handlers:{},addEventListener(name,fn){(this.handlers[name]??=[]).push(fn)},emit(name){for(const fn of this.handlers[name]??[])fn()}});
  function fixture(initial='https://example.test/DexArena/',withObserver=true){
    const video=()=>{
      const classes=new Set();
      const card={classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},classes};
      const element={...events(),dataset:{taskPreview:'/DexArena/assets/task-previews/test.mp4'},paused:true,readyState:0,playCalls:0,
        hasAttribute(name){return this[name]!==undefined},closest(){return card},pause(){this.paused=true},
        play(){this.paused=false;this.playCalls++;this.readyState=2;this.emit('playing');return Promise.resolve()}};
      card.querySelector=()=>element;
      return element;
    };
    const videos=[video(),video()];
    const buttons=['images','videos'].map(mode=>({...events(),dataset:{taskMediaMode:mode},attributes:{},setAttribute(k,v){this.attributes[k]=v}}));
    const pause={...events(),attributes:{},setAttribute(k,v){this.attributes[k]=v}};
    const note={},tools={hidden:true};
    const showcase={dataset:{},querySelectorAll:s=>s==='[data-task-preview]'?videos:buttons,querySelector:s=>s==='[data-task-media-pause]'?pause:s==='[data-task-video-note]'?note:tools};
    const document={...events(),hidden:false,querySelector:()=>showcase};
    const window={...events(),location:{href:initial},history:{replaceState(a,b,url){window.location.href=url}}};
    let observer;
    class Observer{constructor(callback){this.callback=callback;observer=this}observe(){}send(video,isIntersecting){this.callback([{target:video.closest(),isIntersecting}])}}
    if(withObserver)window.IntersectionObserver=Observer;
    runInNewContext(js.slice(js.indexOf('const taskShowcase=')),{document,window,URL,IntersectionObserver:Observer});
    return {videos,buttons,pause,note,tools,showcase,document,window,observer};
  }
  const f=fixture();
  f.observer.send(f.videos[0],true);
  assert.equal(f.showcase.dataset.taskMedia,'images');
  assert(f.videos.every(v=>!v.src),'Default image mode must not request video files');
  assert.equal(f.tools.hidden,false);
  f.buttons[1].emit('click');
  assert.equal(f.showcase.dataset.taskMedia,'videos');
  assert.equal(f.buttons[1].attributes['aria-pressed'],'true');
  assert(f.window.location.href.includes('task-media=videos'));
  assert.equal(f.videos[0].paused,false);assert.equal(f.videos[1].src,undefined);
  assert(f.videos[0].closest().classes.has('is-video-ready'));
  f.observer.send(f.videos[0],false);assert.equal(f.videos[0].paused,true);
  f.observer.send(f.videos[1],true);assert.equal(f.videos[1].paused,false);
  f.pause.emit('click');assert(f.videos.every(v=>v.paused));
  assert.equal(f.pause.attributes['aria-pressed'],'true');
  assert.equal(f.showcase.dataset.taskPlayback,'paused');
  f.pause.emit('click');assert.equal(f.videos[1].paused,false);
  f.document.hidden=true;f.document.emit('visibilitychange');assert(f.videos.every(v=>v.paused));
  f.document.hidden=false;f.document.emit('visibilitychange');assert.equal(f.videos[1].paused,false);
  f.videos[1].emit('error');assert(!f.videos[1].closest().classes.has('is-video-ready'));
  assert.equal(f.videos[1].paused,true);
  f.buttons[0].emit('click');assert.equal(f.showcase.dataset.taskMedia,'images');
  assert(!f.window.location.href.includes('task-media'));assert(f.videos.every(v=>v.paused));
  assert.equal(f.pause.hidden,true);assert.equal(f.note.hidden,true);
  f.window.location.href='https://example.test/DexArena/?task-media=videos#simulation-tasks';
  f.window.emit('popstate');assert.equal(f.showcase.dataset.taskMedia,'videos');
  const direct=fixture('https://example.test/DexArena/?keep=1&task-media=videos#simulation-tasks',false);
  assert.equal(direct.showcase.dataset.taskMedia,'videos');assert(direct.videos.every(v=>!v.paused));
  direct.buttons[0].emit('click');assert(direct.window.location.href.includes('keep=1'));
  assert(direct.window.location.href.endsWith('#simulation-tasks'));
  const invalid=fixture('https://example.test/DexArena/?task-media=other',false);
  assert.equal(invalid.showcase.dataset.taskMedia,'images');assert(invalid.videos.every(v=>!v.src));
}
