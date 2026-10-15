import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';

// Exercise the production carousel handlers without requiring a browser dependency.
export function verifyCarousel(js){
  const events=()=>({handlers:{},addEventListener(name,fn){(this.handlers[name]??=[]).push(fn)},emit(name,event={}){for(const fn of this.handlers[name]??[])fn(event)}});
  const attributes=()=>({attributes:{},setAttribute(name,value){this.attributes[name]=value}});
  const classes=initial=>{const values=new Set(initial);return {contains:v=>values.has(v),remove:v=>values.delete(v),toggle(v,on){on?values.add(v):values.delete(v)}}};
  let document;
  const slide=id=>{
    const buttonSlot={append(button){this.button=button}};
    const link={focus(){document.activeElement=this}};
    const copy={inert:false};
    return {...attributes(),dataset:{},classList:classes(id===0?['is-active']:[]),offsetWidth:1200,id,
      get offsetLeft(){return 120+track.children.indexOf(this)*1216},
      cloneNode(){return slide(id)},
      querySelector(selector){return selector==='.cover-card'?buttonSlot:selector==='.cover-copy'?copy:selector==='h2'?{textContent:`Slide ${id+1}`} :selector==='.cover-copy a'?link:null},
      buttonSlot,copy,link};
  };
  let flushes=0;
  const track={...events(),style:{},children:[],prepend(s){this.children.unshift(s)},append(s){this.children.push(s)},querySelectorAll(){return this.children},getBoundingClientRect(){flushes++;return {}},contains(el){return this.children.some(s=>s.link===el||s.buttonSlot.button===el)}};
  track.children=[slide(0),slide(1),slide(2)];
  const dots=[0,1,2].map(id=>({...events(),...attributes(),dataset:{dot:String(id)},classList:classes([])}));
  const previous=events(),next=events();
  document={activeElement:null,createElement:()=>({...events(),...attributes()}),querySelector:selector=>selector==='[data-carousel-track]'?track:selector==='[data-prev]'?previous:selector==='[data-next]'?next:null,querySelectorAll:()=>dots};
  const motion={...events(),matches:false};
  const timers=new Map();let timerId=0;
  runInNewContext(js.slice(js.indexOf('const track='),js.indexOf('const filterButtons=')),{
    document,window:{...events(),innerWidth:1440},matchMedia:()=>motion,
    requestAnimationFrame:fn=>fn(),
    setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
    setInterval:()=>++timerId,clearInterval(){},Date
  });
  const active=()=>dots.findIndex(d=>d.attributes['aria-pressed']==='true');
  const peek=direction=>track.children.find(s=>s.classList.contains(`is-${direction}-preview`)).buttonSlot.button;
  const settle=()=>track.emit('transitionend',{target:track,propertyName:'transform'});
  const check=index=>{
    assert.equal(active(),index);
    assert.equal(track.children.filter(s=>!s.buttonSlot.button.disabled).length,2);
    assert.equal(track.children.filter(s=>s.classList.contains('is-active')).length,1);
    assert.equal(track.children.find(s=>s.classList.contains('is-active')).copy.inert,false);
    assert(track.children.filter(s=>!s.classList.contains('is-active')).every(s=>s.copy.inert));
  };
  check(0);
  for(const [side,index] of [['next',1],['next',2],['next',0],['prev',2],['prev',1],['prev',0]]){
    peek(side).emit('click',{detail:1});settle();check(index);
  }
  assert(flushes>=3,'Clone resets must commit without a second animation');
  peek('next').emit('click',{detail:0});settle();check(1);
  assert.equal(document.activeElement,track.children[2].link,'Keyboard activation transfers focus to active content');
  previous.emit('click');settle();check(0);
  next.emit('click');settle();check(1);
  dots[2].emit('click');settle();check(2);
  // Ignore rapid repeated clicks during a transition.
  peek('prev').emit('click',{detail:1});peek('next').emit('click',{detail:1});settle();check(1);
  track.emit('pointerdown',{isPrimary:true,button:0,clientX:800,clientY:300,pointerId:1});
  track.emit('pointerup',{clientX:650,clientY:305,pointerId:1});settle();check(2);
  let prevented=false,stopped=false;
  track.emit('click',{preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});
  assert(prevented&&stopped,'A drag must not also activate a link or preview');
  track.emit('pointerdown',{isPrimary:true,button:0,clientX:800,clientY:300,pointerId:1});
  track.emit('pointerup',{clientX:730,clientY:500,pointerId:1});check(2);
  motion.matches=true;next.emit('click');check(0);previous.emit('click');check(2);
}
