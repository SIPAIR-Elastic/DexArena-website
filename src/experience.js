// Progressively enhance the complete, server-rendered comparison. All tracks
// remain readable if scripts fail or are disabled.
document.querySelectorAll('[data-findings]').forEach(digest=>{
  const tabs=[...digest.querySelectorAll('[data-finding-tab]')];
  const panels=[...digest.querySelectorAll('[data-finding-panel]')];
  const list=digest.querySelector('[data-findings-tabs]');
  if(!tabs.length||tabs.length!==panels.length||!list)return;
  list.setAttribute('role','tablist');
  tabs.forEach(tab=>{
    tab.setAttribute('role','tab');
    tab.setAttribute('aria-controls',`finding-panel-${tab.dataset.findingTab}`);
  });
  panels.forEach(panel=>panel.setAttribute('role','tabpanel'));
  function activate(index,focus=false){
    tabs.forEach((tab,i)=>{
      const active=i===index;
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex=active?0:-1;
      panels[i].hidden=!active;
    });
    if(focus)tabs[index].focus();
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>activate(index));
    tab.addEventListener('keydown',event=>{
      const target=event.key==='ArrowRight'?(index+1)%tabs.length:
        event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:
        event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
      if(target===null)return;
      event.preventDefault();activate(target,true);
    });
  });
  activate(0);
  digest.dataset.enhanced='true';
});
