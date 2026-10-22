// Documentation renderers stay in source and can be publicly enabled later.
export const docsPublished=false;
export const codeComingSoon='<span class="code-coming-soon" data-code-status="coming-soon">Code coming soon</span>';

// Filter authored, non-nested anchors at publication time, without deleting source.
// /assets/docs/ contains the public paper and citation and remains untouched.
export function publishContent(html){
  if(docsPublished)return html;
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,(anchor,attributes,content)=>{
    const href=attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if(!href||!/^\/docs(?:\/|[?#]|$)/.test(href))return anchor;
    const path=href.split(/[?#]/)[0];
    if(/^\/docs\/resources\/?$/.test(path))return codeComingSoon;
    const classes=attributes.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2].split(/\s+/)||[];
    const text=content.replace(/<[^>]*>/g,' ').trim();
    if(classes.some(name=>['arrow-link','editorial-link'].includes(name))||/[→↗]\s*$/.test(text))return '';
    return `<span>${content}</span>`;
  });
}
