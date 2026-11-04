// Documentation renderers stay in source and can be publicly enabled later.
export const docsPublished=false;
// The project owner has released the paper and public repository.
export const paperPublished=true;
export const paperUrl='https://arxiv.org/abs/2611.02629';
export const paperPdfUrl='https://arxiv.org/pdf/2611.02629';
export const codeUrl='https://github.com/SIPAIR-Elastic/DexArena';
export const codeLink='<a class="code-resource-link" href="/code/">Code <span aria-hidden="true">↗</span></a>';
export const paperLink='<a class="paper-resource-link" href="/paper/">Read paper <span aria-hidden="true">↗</span></a>';
export const paperArtifactPaths=['/assets/docs/dexarena-paper.pdf','/assets/docs/dexarena-citation.bib'];

export function isWithheldPaperAsset(path){
  const normalized=path.replace(/\/{2,}/g,'/').toLowerCase();
  // The old local manuscript is a private snapshot, never the public arXiv PDF.
  return normalized===paperArtifactPaths[0]||(!paperPublished&&normalized===paperArtifactPaths[1]);
}

// Removed pages stay unavailable even if an old output file survives deployment.
export function isRetiredRoute(path){
  return /^\/community(?:\/|$)/.test(path.replace(/\/{2,}/g,'/').toLowerCase());
}

function isManuscriptLink(href){
  try{
    const url=new URL(href.replaceAll('&amp;','&'),'https://dexarena.local');
    return !paperPublished&&(isWithheldPaperAsset(decodeURIComponent(url.pathname))||
      (url.hostname==='openreview.net'&&url.searchParams.get('id')==='9yr0F1saHs')||
      (url.hostname==='arxiv.org'&&/^\/(?:abs|pdf)\/2611\.02629(?:v\d+)?(?:\.pdf)?\/?$/i.test(url.pathname)));
  }catch{return false}
}

function publishedManuscriptUrl(href){
  try{
    const url=new URL(href.replaceAll('&amp;','&'),'https://dexarena.local');
    if(decodeURIComponent(url.pathname).replace(/\/{2,}/g,'/').toLowerCase()==='/assets/docs/dexarena-paper.pdf')return paperPdfUrl;
    if(url.hostname==='openreview.net'&&url.searchParams.get('id')==='9yr0F1saHs')return paperUrl;
  }catch{}
  return null;
}

// Filter authored, non-nested anchors at publication time, without deleting source.
// Paper visibility is independent of the documentation release switch.
export function publishContent(html){
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,(anchor,attributes,content)=>{
    const href=attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if(!href)return anchor;
    if(isManuscriptLink(href))return paperLink;
    if(paperPublished){
      const publicHref=publishedManuscriptUrl(href);
      if(publicHref)return `<a${attributes.replace(/\bhref\s*=\s*(["'])(.*?)\1/i,`href="${publicHref}"`).replace(/\s+download(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,'')}>${content}</a>`;
    }
    if(docsPublished||!/^\/docs(?:\/|[?#]|$)/.test(href))return anchor;
    const path=href.split(/[?#]/)[0];
    if(/^\/docs\/resources\/?$/.test(path))return codeLink;
    const classes=attributes.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2].split(/\s+/)||[];
    const text=content.replace(/<[^>]*>/g,' ').trim();
    if(classes.some(name=>['arrow-link','editorial-link'].includes(name))||/[→↗]\s*$/.test(text))return '';
    return `<span>${content}</span>`;
  });
}
