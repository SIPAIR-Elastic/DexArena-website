// Header-only enhancement. Ordinary links remain usable without the indicator.
{
  const header=document.querySelector('[data-nav]');
  const desktop=header?.querySelector('[data-nav-desktop]');
  const indicator=desktop?.querySelector('[data-nav-indicator]');
  if(desktop&&indicator){
    const links=[...desktop.querySelectorAll('a')];
    const current=links.find(link=>link.getAttribute('aria-current')==='page');
    let hovered=null,queued=false;
    function paint(){
      queued=false;
      const focused=links.includes(document.activeElement)?document.activeElement:null;
      const target=hovered||focused||current;
      if(!target||!desktop.getClientRects().length){indicator.style.opacity='0';return}
      indicator.style.setProperty('--nav-x',target.offsetLeft+'px');
      indicator.style.setProperty('--nav-width',target.offsetWidth+'px');
      indicator.style.opacity='1';
      desktop.dataset.enhanced='true';
    }
    function schedule(){if(!queued){queued=true;requestAnimationFrame(paint)}}
    links.forEach(link=>link.addEventListener('pointerenter',()=>{hovered=link;schedule()}));
    desktop.addEventListener('pointerleave',()=>{hovered=null;schedule()});
    desktop.addEventListener('focusin',schedule);
    desktop.addEventListener('focusout',schedule);
    window.addEventListener('resize',schedule,{passive:true});
    window.addEventListener('load',schedule,{once:true});
    if('ResizeObserver' in window){const observer=new ResizeObserver(schedule);observer.observe(desktop);links.forEach(link=>observer.observe(link))}
    document.fonts?.ready.then(schedule);
    paint();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{desktop.dataset.ready='true'}));
  }

  const toggle=header?.querySelector('[data-menu]');
  const drawer=header?.querySelector('[data-drawer]');
  const backdrop=header?.querySelector('[data-nav-dismiss]');
  if(toggle&&drawer&&backdrop){
    const mobile=matchMedia('(max-width: 1100px)');
    const background=[document.querySelector('main'),document.querySelector('.site-footer')].filter(Boolean);
    const priorInert=new Map();
    let open=false;
    function setOpen(next,restoreFocus=false){
      const wasOpen=open;
      open=Boolean(next&&mobile.matches);
      header.classList.toggle('is-open',open);
      drawer.classList.toggle('open',open);
      drawer.inert=!open;
      drawer.setAttribute('aria-hidden',String(!open));
      toggle.setAttribute('aria-expanded',String(open));
      toggle.setAttribute('aria-label',open?'Close menu':'Open menu');
      backdrop.hidden=!open;
      document.body.classList.toggle('menu-open',open);
      if(open&&!wasOpen){
        background.forEach(element=>{priorInert.set(element,element.inert);element.inert=true});
        drawer.querySelector('a')?.focus({preventScroll:true});
      }else if(!open&&wasOpen){
        background.forEach(element=>element.inert=priorInert.get(element)||false);
        priorInert.clear();
        if(restoreFocus)(mobile.matches?toggle:header.querySelector('[data-nav-desktop] [aria-current="page"]')||header.querySelector('.wordmark'))?.focus({preventScroll:true});
      }
    }
    toggle.addEventListener('click',()=>setOpen(!open,open));
    backdrop.addEventListener('click',()=>setOpen(false,true));
    drawer.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>setOpen(false)));
    document.addEventListener('dexarena:close-navigation',()=>setOpen(false,drawer.contains(document.activeElement)));
    document.addEventListener('keydown',event=>{
      if(!open)return;
      if(event.key==='Escape'){event.preventDefault();setOpen(false,true);return}
      if(event.key!=='Tab')return;
      const items=[...header.querySelectorAll('a[href],button:not([disabled])')].filter(element=>element.tabIndex>=0&&element.getClientRects().length&&!element.closest('[inert]'));
      const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    });
    document.addEventListener('focusin',event=>{if(open&&!header.contains(event.target))drawer.querySelector('a')?.focus({preventScroll:true})});
    mobile.addEventListener('change',()=>{if(!mobile.matches)setOpen(false,drawer.contains(document.activeElement))});
    window.addEventListener('pagehide',()=>setOpen(false));
    setOpen(false);
  }
  const shortcut=header?.querySelector('[data-search-shortcut]');
  if(shortcut)shortcut.textContent=/Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform||navigator.platform||'')?'⌘ K':'Ctrl K';
}
