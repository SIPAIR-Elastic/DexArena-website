import assert from 'node:assert/strict';

export function renderSiteUrl(env=process.env){
  // The default is the existing service URL supplied by the project owner.
  // Render also supplies the actual service URL at build time and runtime.
  const configured=env.SITE_URL||env.RENDER_EXTERNAL_URL||
    (env.RENDER_EXTERNAL_HOSTNAME?`https://${env.RENDER_EXTERNAL_HOSTNAME}/`:'https://dexarena.onrender.com/');
  const site=new URL(configured);
  assert(site.protocol==='https:'&&!site.username&&!site.password&&site.pathname==='/'&&!site.search&&!site.hash,
    'SITE_URL must be the HTTPS root of the public Render site, without /DexArena/ or query parameters.');
  return site.href;
}
