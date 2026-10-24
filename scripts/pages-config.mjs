import assert from 'node:assert/strict';

export function githubPagesConfig(env=process.env){
  const repository=env.GITHUB_REPOSITORY||'SIPAIR-Elastic/DexArena-website';
  const parts=repository.split('/');
  assert(parts.length===2&&/^[A-Za-z0-9-]+$/.test(parts[0])&&/^[A-Za-z0-9_.-]+$/.test(parts[1]),
    'GITHUB_REPOSITORY must be owner/repository');
  const [owner,name]=parts;
  const hostname=`${owner.toLowerCase()}.github.io`;
  const basePath=env.SITE_BASE_PATH??(name.toLowerCase()===hostname?'/':`/${name}/`);
  assert(basePath.startsWith('/')&&basePath.endsWith('/')&&!basePath.includes('//')&&basePath.split('/').every(part=>/^[A-Za-z0-9_.-]*$/.test(part)&&part!=='.'&&part!=='..'),
    'SITE_BASE_PATH must be an absolute directory path ending in /');
  const site=new URL(env.SITE_URL||`https://${hostname}${basePath}`);
  assert(site.protocol==='https:'&&site.hostname===hostname&&!site.port&&!site.username&&!site.password&&site.pathname===basePath&&!site.search&&!site.hash,
    'SITE_URL must be the repository owner’s HTTPS GitHub Pages URL including SITE_BASE_PATH');
  return {basePath,siteUrl:site.href};
}
