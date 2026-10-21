import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';

// Exercise production handlers, including media lifecycles, without browser dependencies.
export function verifyCarousel(js){
  const source=js.slice(js.indexOf('const track='),js.indexOf('const filterButtons='));
  function harness({reducedMotion=false,withObserver=true,rejectPlayback=false}={}){
    const events=()=>({handlers:{},addEventListener(name,fn){(this.handlers[name]??=[]).push(fn)},emit(name,event={}){for(const fn of this.handlers[name]??[])fn(event)}});
    const attributes=()=>({attributes:{},setAttribute(name,value){this.attributes[name]=value}});
    const classes=initial=>{const values=new Set(initial);return {contains:v=>values.has(v),remove:v=>values.delete(v),toggle(v,on){on?values.add(v):values.delete(v)}}};
    let document,cover,track,flushes=0,clock=1000,rejectionsCaught=0;
    const video=()=>({...events(),...attributes(),paused:true,muted:false,plays:0,
      pause(){this.paused=true},
      play(){this.plays++;this.paused=rejectPlayback;return {catch(fn){if(rejectPlayback){rejectionsCaught++;fn(new Error('Playback blocked'))}}}}
    });
    const slide=id=>{
      const buttonSlot={append(button){this.button=button}};
      const link={focus(){document.activeElement=this;cover.emit('focusin')}};
      const copy={inert:false},videos=id===0?[video(),video(),video()]:[];
      return {...attributes(),dataset:{},classList:classes(id===0?['is-active']:[]),offsetWidth:1200,id,
        get offsetLeft(){return 120+track.children.indexOf(this)*1216},
        cloneNode(){return slide(id)},
        querySelector(selector){return selector==='.cover-card'?buttonSlot:selector==='.cover-copy'?copy:selector==='h2'?{textContent:`Slide ${id+1}`} :selector==='.cover-copy a'?link:null},
        querySelectorAll:selector=>selector==='video'?videos:[],
        buttonSlot,copy,link,videos};
    };
    const pauseLabel={textContent:'Pause'};
    const pause={...events(),...attributes(),querySelector:selector=>selector==='[data-carousel-pause-label]'?pauseLabel:null};
    const previous=events(),next=events();
    const dots=[0,1,2].map(id=>({...events(),...attributes(),dataset:{dot:String(id)},classList:classes([])}));
    track={...events(),style:{},children:[],closest:()=>cover,prepend(s){this.children.unshift(s)},append(s){this.children.push(s)},querySelectorAll(){return this.children},getBoundingClientRect(){flushes++;return {}},contains(el){return this.children.some(s=>s.link===el||s.buttonSlot.button===el)}};
    cover={...events(),...attributes(),dataset:{},getBoundingClientRect(){return {}},querySelector:selector=>selector==='[data-carousel-pause]'?pause:null,contains(el){return [pause,previous,next,...dots].includes(el)||track.contains(el)}};
    track.children=[slide(0),slide(1),slide(2)];
    document={...events(),hidden:false,activeElement:null,createElement:()=>({...events(),...attributes()}),querySelector:selector=>selector==='[data-carousel-track]'?track:selector==='[data-prev]'?previous:selector==='[data-next]'?next:null,querySelectorAll:()=>dots};
    const motion={...events(),matches:reducedMotion};
    const timers=new Map();let timerId=0,observer;
    const window={...events(),innerWidth:1440};
    const context={document,window,matchMedia:()=>motion,requestAnimationFrame:fn=>fn(),
      setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId},clearTimeout:id=>timers.delete(id),Date:{now:()=>clock}};
    if(withObserver){
      window.IntersectionObserver=true;
      context.IntersectionObserver=class{constructor(fn,options){this.fn=fn;this.options=options;observer=this}observe(target){this.target=target}};
    }
    runInNewContext(source,context);
    const active=()=>dots.findIndex(d=>d.attributes['aria-pressed']==='true');
    const peek=direction=>track.children.find(s=>s.classList.contains(`is-${direction}-preview`)).buttonSlot.button;
    const settle=()=>track.emit('transitionend',{target:track,propertyName:'transform'});
    const videos=()=>track.children.flatMap(s=>s.videos);
    const playing=()=>videos().filter(v=>!v.paused);
    const rotation=()=>[...timers].filter(([,t])=>t.delay===8000);
    const check=index=>{
      assert.equal(active(),index);
      assert.equal(track.children.filter(s=>!s.buttonSlot.button.disabled).length,2);
      assert.equal(track.children.filter(s=>s.classList.contains('is-active')).length,1);
      assert.equal(track.children.find(s=>s.classList.contains('is-active')).copy.inert,false);
      assert(track.children.filter(s=>!s.classList.contains('is-active')).every(s=>s.copy.inert));
    };
    const viewport=value=>observer.fn([{target:cover,isIntersecting:value}]);
    const tick=delay=>{for(const [id,timer] of [...timers])if(timer.delay===delay){timers.delete(id);timer.fn()}};
    return {document,window,cover,track,dots,previous,next,pause,pauseLabel,motion,active,peek,settle,videos,playing,rotation,check,viewport,tick,
      clearFocus(){document.activeElement=null;cover.emit('focusout');tick(0)},
      advanceClock(){clock+=500},get flushes(){return flushes},get rejectionsCaught(){return rejectionsCaught}};
  }
  const h=harness();
  h.check(0);
  assert.equal(h.cover.attributes['aria-roledescription'],'carousel');
  assert.deepEqual(h.track.children.map(s=>s.attributes['aria-label']),['3 of 3','1 of 3','2 of 3','3 of 3','1 of 3']);
  assert.equal(h.rotation().length,0,'Wait for actual viewport visibility before rotating');
  assert.equal(h.playing().length,0);
  h.viewport(true);
  assert.equal(h.rotation().length,1);
  assert.equal(h.cover.dataset.rotating,'true');
  assert.equal(h.playing().length,3);
  assert(h.track.children.filter(s=>s.dataset.clone).every(s=>s.videos.every(v=>v.paused)),'Hidden clones must not play');
  for(const [side,index] of [['next',1],['next',2],['next',0],['prev',2],['prev',1],['prev',0]]){
    h.peek(side).emit('click',{detail:1});h.settle();h.check(index);
    assert.equal(h.playing().length,index===0?3:0);
  }
  assert(h.flushes>=3,'Clone resets must commit without a second animation');
  h.peek('next').emit('click',{detail:0});h.settle();h.check(1);
  assert.equal(h.document.activeElement,h.track.children[2].link,'Keyboard activation transfers focus to active content');
  h.previous.emit('click');h.settle();h.check(0);
  h.next.emit('click');h.settle();h.check(1);
  h.dots[2].emit('click');h.settle();h.check(2);
  h.peek('prev').emit('click',{detail:1});h.peek('next').emit('click',{detail:1});h.settle();h.check(1);
  h.track.emit('pointerdown',{isPrimary:true,button:0,clientX:800,clientY:300,pointerId:1});
  h.track.emit('pointerup',{clientX:650,clientY:305,pointerId:1});h.settle();h.check(2);
  let prevented=false,stopped=false;
  h.track.emit('click',{preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
  assert(prevented&&stopped,'A drag must not also activate a link or preview');
  h.track.emit('pointerdown',{isPrimary:true,button:0,clientX:800,clientY:300,pointerId:1});
  h.track.emit('pointerup',{clientX:730,clientY:500,pointerId:1});h.check(2);
  h.motion.matches=true;h.motion.emit('change');h.next.emit('click');h.check(0);h.previous.emit('click');h.check(2);

  const lifecycle=harness();lifecycle.viewport(true);
  lifecycle.cover.emit('mouseenter');
  assert.equal(lifecycle.rotation().length,0,'Hover over media or controls pauses rotation');
  assert.equal(lifecycle.cover.dataset.rotating,'false');
  assert.equal(lifecycle.playing().length,3,'Hover alone must not freeze the demonstration');
  lifecycle.cover.emit('mouseleave');assert.equal(lifecycle.rotation().length,1);
  lifecycle.document.activeElement=lifecycle.next;lifecycle.cover.emit('focusin');
  assert.equal(lifecycle.rotation().length,0,'External arrow/dot focus pauses rotation');
  lifecycle.clearFocus();assert.equal(lifecycle.rotation().length,1);
  lifecycle.pause.emit('click');
  assert.equal(lifecycle.cover.dataset.paused,'true');
  assert.equal(lifecycle.pause.attributes['aria-pressed'],'true');
  assert.equal(lifecycle.pauseLabel.textContent,'Play');
  assert.equal(lifecycle.rotation().length,0);assert.equal(lifecycle.playing().length,0);
  lifecycle.next.emit('click');lifecycle.settle();lifecycle.check(1);
  lifecycle.previous.emit('click');lifecycle.settle();lifecycle.check(0);
  assert.equal(lifecycle.playing().length,0,'Manual slide changes preserve a user pause');
  lifecycle.pause.emit('click');assert.equal(lifecycle.pauseLabel.textContent,'Pause');
  assert.equal(lifecycle.rotation().length,1);assert.equal(lifecycle.playing().length,3);
  lifecycle.tick(8000);lifecycle.settle();lifecycle.check(1);
  assert.equal(lifecycle.rotation().length,1,'Automatic changes schedule a fresh eight-second rotation');
  lifecycle.previous.emit('click');lifecycle.settle();lifecycle.check(0);
  lifecycle.document.hidden=true;lifecycle.document.emit('visibilitychange');
  assert.equal(lifecycle.rotation().length,0);assert.equal(lifecycle.playing().length,0);
  const pending=lifecycle.videos()[0];pending.paused=false;pending.emit('playing');
  assert(pending.paused,'A late play() resolution must not restart hidden media');
  lifecycle.document.hidden=false;lifecycle.document.emit('visibilitychange');
  assert.equal(lifecycle.rotation().length,1);assert.equal(lifecycle.playing().length,3);
  lifecycle.viewport(false);assert.equal(lifecycle.rotation().length,0);assert.equal(lifecycle.playing().length,0);
  lifecycle.viewport(true);assert.equal(lifecycle.rotation().length,1);assert.equal(lifecycle.playing().length,3);
  lifecycle.window.emit('pagehide');assert.equal(lifecycle.rotation().length,0);assert.equal(lifecycle.playing().length,0);
  lifecycle.window.emit('pageshow');assert.equal(lifecycle.rotation().length,1);assert.equal(lifecycle.playing().length,3);
  lifecycle.pause.emit('click');lifecycle.document.hidden=true;lifecycle.document.emit('visibilitychange');
  lifecycle.document.hidden=false;lifecycle.document.emit('visibilitychange');
  assert.equal(lifecycle.cover.dataset.paused,'true','Returning to the page must preserve a user pause');
  assert.equal(lifecycle.rotation().length,0);assert.equal(lifecycle.playing().length,0);

  const reduced=harness({reducedMotion:true});reduced.viewport(true);
  assert.equal(reduced.cover.dataset.paused,'true');assert.equal(reduced.rotation().length,0);assert.equal(reduced.playing().length,0);
  reduced.next.emit('click');reduced.check(1);reduced.previous.emit('click');reduced.check(0);
  reduced.pause.emit('click');
  assert.equal(reduced.rotation().length,1,'An explicit Play is allowed to override the default reduced-motion pause');
  assert.equal(reduced.playing().length,3);
  reduced.motion.emit('change');assert.equal(reduced.rotation().length,0);assert.equal(reduced.playing().length,0);
  reduced.motion.matches=false;reduced.motion.emit('change');assert.equal(reduced.rotation().length,1);
  reduced.pause.emit('click');reduced.motion.matches=true;reduced.motion.emit('change');
  reduced.motion.matches=false;reduced.motion.emit('change');
  assert.equal(reduced.rotation().length,0,'Preference updates must not clear a user pause');
  const fallback=harness({withObserver:false});assert.equal(fallback.playing().length,3);assert.equal(fallback.rotation().length,1);
  const blocked=harness({rejectPlayback:true});blocked.viewport(true);
  assert(blocked.rejectionsCaught>=3,'Autoplay rejection must be caught without breaking controls');
  blocked.next.emit('click');blocked.settle();blocked.check(1);
}
