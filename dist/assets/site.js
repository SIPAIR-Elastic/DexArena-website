
const nav=document.querySelector("[data-nav]");
const progress=document.querySelector(".route-progress");
function syncScroll(){
  const y=window.scrollY;
  nav?.classList.add("is-solid");
  nav?.classList.toggle("is-scrolled",y>48);
  if(progress){
    const total=document.documentElement.scrollHeight-window.innerHeight;
    progress.style.width=(total>0?y/total*100:0)+"%";
  }
}
window.addEventListener("scroll",syncScroll,{passive:true});
syncScroll();

const menu=document.querySelector("[data-menu]");
const drawer=document.querySelector("[data-drawer]");
menu?.addEventListener("click",()=>{
  const open=drawer.classList.toggle("open");
  menu.setAttribute("aria-expanded",String(open));
  menu.setAttribute("aria-label",open?"Close menu":"Open menu");
  document.body.classList.toggle("menu-open",open);
});
drawer?.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{
  drawer.classList.remove("open");menu?.setAttribute("aria-expanded","false");document.body.classList.remove("menu-open");
}));

const reveals=document.querySelectorAll(".reveal");
if("IntersectionObserver" in window){
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}
  }),{threshold:.1});
  reveals.forEach(el=>observer.observe(el));
}else reveals.forEach(el=>el.classList.add("visible"));

const track=document.querySelector("[data-carousel-track]");
if(track){
  const slides=[...track.querySelectorAll("[data-slide]")];
  const dots=[...document.querySelectorAll("[data-dot]")];
  const firstClone=slides[0].cloneNode(true);
  const lastClone=slides.at(-1).cloneNode(true);
  firstClone.classList.remove("is-active");
  lastClone.classList.remove("is-active");
  firstClone.dataset.clone="true";
  lastClone.dataset.clone="true";
  firstClone.setAttribute("aria-hidden","true");
  lastClone.setAttribute("aria-hidden","true");
  track.prepend(lastClone);
  track.append(firstClone);
  const renderedSlides=[...track.querySelectorAll("[data-slide]")];
  const motionPreference=matchMedia("(prefers-reduced-motion: reduce)");
  let index=0,renderedIndex=1,pendingReset=null,timer=null,gesture=null,hovered=false,moving=false,settleTimer=null,ignoreClickUntil=0,focusAfterMove=false;
  // Native button overlays only intercept the two adjacent previews, never the active CTA.
  const previewButtons=renderedSlides.map(slide=>{
    const button=document.createElement("button");
    button.type="button";button.className="cover-peek-trigger";button.tabIndex=-1;button.disabled=true;
    button.innerHTML='<span class="cover-peek-cue" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span>';
    slide.querySelector(".cover-card").append(button);
    button.addEventListener("click",e=>{
      if(moving||Date.now()<ignoreClickUntil)return;
      focusAfterMove=e.detail===0;
      go(index+(slide.classList.contains("is-prev-preview")?-1:1));
    });
    return button;
  });
  function position(instant=false){
    const slide=renderedSlides[renderedIndex];
    const target=slide.offsetLeft-(window.innerWidth-slide.offsetWidth)/2;
    if(instant) track.style.transition="none";
    track.style.transform=`translate3d(${-target}px,0,0)`;
    if(instant){
      // Commit the clone-to-original reset before restoring animation.
      track.getBoundingClientRect();
      requestAnimationFrame(()=>track.style.transition="");
    }
    renderedSlides.forEach((s,i)=>{
      const active=i===renderedIndex,previous=i===renderedIndex-1,next=i===renderedIndex+1;
      s.classList.toggle("is-active",active);
      s.classList.toggle("is-prev-preview",previous);s.classList.toggle("is-next-preview",next);
      s.setAttribute("aria-hidden",String(!active&&!previous&&!next));
      s.querySelector(".cover-copy").inert=!active;
      const button=previewButtons[i],enabled=previous||next;
      button.disabled=!enabled;button.tabIndex=enabled?0:-1;
      button.setAttribute("aria-label",`Show ${previous?"previous":"next"} slide: ${s.querySelector("h2").textContent}`);
    });
    dots.forEach((d,i)=>{d.classList.toggle("active",i===index);d.setAttribute("aria-pressed",String(i===index))});
  }
  function settle(){
    clearTimeout(settleTimer);moving=false;
    if(pendingReset!==null){renderedIndex=pendingReset;pendingReset=null;position(true)}
    if(focusAfterMove){renderedSlides[renderedIndex].querySelector(".cover-copy a")?.focus({preventScroll:true});focusAfterMove=false}
  }
  function go(next){
    if(moving)return;
    if(next===index){focusAfterMove=false;return}
    moving=true;
    const last=slides.length-1;
    if(index===last&&next===index+1){index=0;renderedIndex=slides.length+1;pendingReset=1}
    else if(index===0&&next===index-1){index=last;renderedIndex=0;pendingReset=slides.length}
    else{index=(next+slides.length)%slides.length;renderedIndex=index+1;pendingReset=null}
    position(motionPreference.matches);restart();
    if(motionPreference.matches)settle();
    else settleTimer=setTimeout(settle,950);
  }
  track.addEventListener("transitionend",e=>{
    if(e.target===track&&e.propertyName==="transform")settle();
  });
  function restart(){clearInterval(timer);if(!hovered&&!track.contains(document.activeElement)&&!motionPreference.matches)timer=setInterval(()=>go(index+1),6500)}
  document.querySelector("[data-prev]")?.addEventListener("click",()=>go(index-1));
  document.querySelector("[data-next]")?.addEventListener("click",()=>go(index+1));
  dots.forEach(d=>d.addEventListener("click",()=>go(Number(d.dataset.dot))));
  track.addEventListener("pointerdown",e=>{if(e.isPrimary&&e.button===0)gesture={x:e.clientX,y:e.clientY,id:e.pointerId}});
  track.addEventListener("pointerup",e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){ignoreClickUntil=Date.now()+350;go(index+(dx<0?1:-1))}
  });
  track.addEventListener("pointercancel",()=>{gesture=null});
  track.addEventListener("pointerleave",()=>{gesture=null});
  track.addEventListener("click",e=>{if(Date.now()<ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
  track.addEventListener("mouseenter",()=>{hovered=true;clearInterval(timer)});
  track.addEventListener("mouseleave",()=>{hovered=false;restart()});
  track.addEventListener("focusin",()=>clearInterval(timer));
  track.addEventListener("focusout",()=>setTimeout(restart,0));
  window.addEventListener("resize",()=>{settle();position(true)});
  motionPreference.addEventListener("change",()=>{settle();restart()});
  position(true);restart();
}

const filterButtons=[...document.querySelectorAll("[data-task-filter]")];
const search=document.querySelector("[data-task-search]");
const taskCards=[...document.querySelectorAll("[data-task-index] .task-card")];
let activeFilter="all";
function filterTasks(){
  const q=(search?.value||"").trim().toLowerCase();
  taskCards.forEach(card=>{
    const category=card.dataset.category||"";
    const categoryMatch=activeFilter==="all"||category.includes(activeFilter);
    const searchMatch=!q||card.textContent.toLowerCase().includes(q);
    card.hidden=!(categoryMatch&&searchMatch);
  });
}
filterButtons.forEach(button=>button.addEventListener("click",()=>{
  filterButtons.forEach(b=>b.classList.remove("active"));
  button.classList.add("active");activeFilter=button.dataset.taskFilter;filterTasks();
}));
search?.addEventListener("input",filterTasks);

const stageImage=document.querySelector("[data-stage-image]");
const stageCounter=document.querySelector("[data-stage-counter]");
const stageButtons=[...document.querySelectorAll("[data-stage-button]")];
if(stageButtons.length){
  document.querySelector(".task-gallery__rail")?.style.setProperty("--stage-count",String(stageButtons.length));
  stageButtons.forEach(button=>button.addEventListener("click",()=>{
    stageButtons.forEach(b=>b.classList.remove("active"));button.classList.add("active");
    if(stageImage){
      stageImage.style.opacity=".2";
      const preload=new Image();
      preload.onload=()=>{stageImage.src=button.dataset.image;stageImage.style.opacity="1"};
      preload.src=button.dataset.image;
    }
    if(stageCounter)stageCounter.textContent=`Stage ${String(Number(button.dataset.stageButton)+1).padStart(2,"0")} / ${String(stageButtons.length).padStart(2,"0")}`;
  }));
}

const methodFilter=document.querySelector("[data-method-filter]");
const methodRows=[...document.querySelectorAll("[data-method-row], [data-visual-method]")];
methodFilter?.addEventListener("change",()=>{
  const value=methodFilter.value;
  methodRows.forEach(row=>row.hidden=value!=="all"&&!row.dataset.family.includes(value));
});

const resultTabs=[...document.querySelectorAll("[data-result-tab]")];
const resultPanels=[...document.querySelectorAll("[data-result-panel]")];
if(resultTabs.length){
  function selectResult(id){
    resultTabs.forEach(tab=>{const active=tab.dataset.resultTab===id;tab.classList.toggle("active",active);tab.setAttribute("aria-pressed",String(active))});
    resultPanels.forEach(panel=>panel.hidden=panel.dataset.resultPanel!==id);
  }
  resultTabs.forEach(tab=>tab.addEventListener("click",()=>selectResult(tab.dataset.resultTab)));
  const initial=resultPanels.find(panel=>`#${panel.id}`===window.location.hash)?.dataset.resultPanel||resultTabs[0].dataset.resultTab;
  selectResult(initial);
}

const viewButtons=[...document.querySelectorAll("[data-view-button]")];
const resultViews=[...document.querySelectorAll("[data-result-view]")];
if(viewButtons.length){
  function selectView(id){
    viewButtons.forEach(button=>{const active=button.dataset.viewButton===id;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active))});
    resultViews.forEach(view=>view.hidden=view.dataset.resultView!==id);
  }
  viewButtons.forEach(button=>button.addEventListener("click",()=>selectView(button.dataset.viewButton)));
  selectView("charts");
}

const docSearch=document.querySelector("[data-doc-search]");

// Small text actions for the verified account ID and shareable paper URL.
const textCopyButtons=[...document.querySelectorAll("[data-copy-text]")];
textCopyButtons.forEach(button=>button.addEventListener("click",async()=>{
  const value=button.dataset.copyText;
  const status=button.parentElement.querySelector(".copy-status");
  try{
    if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(value);
    if(status)status.textContent="Copied";
  }catch{
    const target=button.dataset.copyTarget?document.getElementById(button.dataset.copyTarget):status;
    if(status)status.textContent=value+" — Select and copy, or use Ctrl/Cmd+C.";
    if(target){
      const range=document.createRange();range.selectNodeContents(target);
      const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    }
  }
}));

const citationButton=document.querySelector("[data-copy-citation]");
citationButton?.addEventListener("click",async()=>{
  const citation=document.querySelector("#paper-bibtex");
  const status=document.querySelector("[data-citation-status]");
  try{
    if(!navigator.clipboard?.writeText)throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(citation.textContent);
    status.textContent="BibTeX copied.";
  }catch{
    const range=document.createRange();range.selectNodeContents(citation);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    status.textContent="Citation selected. Press Ctrl/Cmd+C to copy, or download the .bib file.";
  }
});

const docLinks=[...document.querySelectorAll("[data-doc-link]")];
docSearch?.addEventListener("input",()=>{
  const q=docSearch.value.trim().toLowerCase();
  docLinks.forEach(link=>link.hidden=q&&!link.textContent.toLowerCase().includes(q));
});


// Full-text navigation stays local to the site and never sends visitor queries away.
const searchTriggers=[...document.querySelectorAll("[data-open-search]")];
if(searchTriggers.length){
  const dialog=document.createElement("dialog");
  dialog.className="search-dialog";
  dialog.setAttribute("aria-labelledby","search-heading");
  dialog.innerHTML='<div class="search-dialog-head"><h2 id="search-heading">Search DexArena</h2><button type="button" class="search-close">Close · Esc</button></div><label class="search-field">Docs, tasks and research<input type="search" placeholder="Try: cameras, replay, mouse…" autocomplete="off"></label><p class="search-status" role="status" aria-live="polite"></p><ul class="search-results"></ul>';
  document.body.append(dialog);
  const input=dialog.querySelector("input"), status=dialog.querySelector(".search-status"), list=dialog.querySelector("ul");
  let entries=null,previousFocus=null,loadPromise=null;
  const decode=value=>{const el=document.createElement("textarea");el.innerHTML=value;return el.value};
  function render(){
    list.replaceChildren();
    const query=input.value.trim().toLowerCase(),tokens=query.split(/\s+/).filter(Boolean);
    if(!entries){status.textContent="Loading the site index…";return}
    const found=entries.map(entry=>{
      const title=decode(entry.title).replace(/ — DexArena$/,""),text=decode(entry.text);
      const haystack=(title+" "+text).toLowerCase();
      return {...entry,title,text,match:tokens.every(word=>haystack.includes(word)),rank:tokens.reduce((n,word)=>n+(title.toLowerCase().includes(word)?8:1),0)};
    }).filter(entry=>entry.match).sort((a,b)=>b.rank-a.rank).slice(0,12);
    status.textContent=query?(found.length?found.length+" matching pages":"No matching pages. Try a task name or a shorter query."):"Browse the site or type to find a topic.";
    found.forEach(entry=>{
      const li=document.createElement("li"),link=document.createElement("a"),title=document.createElement("strong"),snippet=document.createElement("p");
      link.href=entry.url;title.textContent=entry.title;
      const position=query?Math.max(0,entry.text.toLowerCase().indexOf(tokens[0])-45):0;
      snippet.textContent=(position?"…":"")+entry.text.slice(position,position+170)+(entry.text.length>position+170?"…":"");
      link.append(title,snippet);li.append(link);list.append(li);
    });
  }
  async function openSearch(){
    if(dialog.open)return;
    previousFocus=document.activeElement;dialog.showModal();document.body.classList.add("search-open");input.focus();render();
    if(entries)return;
    try{
      loadPromise ||= fetch("/DexArena/assets/search-index.json").then(response=>{if(!response.ok)throw new Error("Search unavailable");return response.json()});
      entries=await loadPromise;render();
    }catch{status.textContent="Search could not load. Please use Docs or the task catalog.";loadPromise=null}
  }
  searchTriggers.forEach(button=>button.addEventListener("click",openSearch));
  dialog.querySelector(".search-close").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
  dialog.addEventListener("close",()=>{document.body.classList.remove("search-open");previousFocus?.focus()});
  input.addEventListener("input",render);
  input.addEventListener("keydown",event=>{if(event.key==="ArrowDown"){event.preventDefault();list.querySelector("a")?.focus()}});
  document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();dialog.open?dialog.close():openSearch()}});
}
