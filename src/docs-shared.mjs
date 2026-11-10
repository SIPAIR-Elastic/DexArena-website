// Small, dependency-free authoring helpers for the public documentation.
export const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const code = (value, language = 'bash') => `<pre tabindex="0"><code class="language-${escape(language)}">${escape(value)}</code></pre>`;
export const section = (id, title, body) => `<section id="${escape(id)}"><h2>${title}</h2>${body}</section>`;
export const page = (id, title, lead, content) => ({id, title, lead, content});
export const external = (url, label) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${label} ↗</a>`;
export const sourceLink = (path, label = path, anchor = '') => external(`https://github.com/SIPAIR-Elastic/DexArena/${path.endsWith('/')?'tree':'blob'}/main/${path}${anchor ? '#'+anchor : ''}`, `<code>${escape(label)}</code>`);
export const table = (headings, rows) => `<div class="docs-table-scroll" role="region" aria-label="${escape(headings.join(' / '))}" tabindex="0"><table><thead><tr>${headings.map(heading=>`<th scope="col">${heading}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
export const callout = (title, body, {warn = false} = {}) => `<aside class="docs-callout${warn?' warn':''}"><b>${title}</b>${body}</aside>`;
export const datasetUrl = 'https://huggingface.co/datasets/SIPAIR/DexArena';
