// Documentation renderers stay in source and can be publicly enabled later.
export const docsPublished=false;
// Keep the manuscript private until the project owner explicitly releases it.
export const paperPublished=false;
export const codeLink='<a class="code-resource-link" href="/code/">Code <span aria-hidden="true">↗</span></a>';
export const paperLink='<a class="paper-resource-link" href="/paper/">Read paper <span aria-hidden="true">↗</span></a>';
export const paperArtifactPaths=['/assets/docs/dexarena-paper.pdf','/assets/docs/dexarena-citation.bib'];

export function isWithheldPaperAsset(path){
  return !paperPublished&&paperArtifactPaths.includes(path.replace(/\/{2,}/g,'/').toLowerCase());
}

function isManuscriptLink(href){
  try{
    const url=new URL(href.replaceAll('&amp;','&'),'https://dexarena.local');
    return isWithheldPaperAsset(decodeURIComponent(url.pathname))||
      (!paperPublished&&url.hostname==='openreview.net'&&url.searchParams.get('id')==='9yr0F1saHs');
  }catch{return false}
}

// Filter authored, non-nested anchors at publication time, without deleting source.
// Paper visibility is independent of the documentation release switch.
export function publishContent(html){
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,(anchor,attributes,content)=>{
    const href=attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if(!href)return anchor;
    if(isManuscriptLink(href))return paperLink;
    if(docsPublished||!/^\/docs(?:\/|[?#]|$)/.test(href))return anchor;
    const path=href.split(/[?#]/)[0];
    if(/^\/docs\/resources\/?$/.test(path))return codeLink;
    const classes=attributes.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2].split(/\s+/)||[];
    const text=content.replace(/<[^>]*>/g,' ').trim();
    if(classes.some(name=>['arrow-link','editorial-link'].includes(name))||/[→↗]\s*$/.test(text))return '';
    return `<span>${content}</span>`;
  });
}
