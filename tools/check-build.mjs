import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist'),read=path=>readFile(resolve(out,path),'utf8');
const routes=JSON.parse(await read('routes.json'));
assert.equal(routes.length,895);assert.equal(new Set(routes.map(r=>r.path)).size,routes.length);
for(const route of routes){
 const html=await read(route.path.slice(1)+'index.html'),base=html.match(/<base href="([^"]+)"/)[1];
 const url=new URL('https://example.test/project'+route.path),baseURL=new URL(base,url);
 assert.equal(baseURL.pathname,'/project/');assert.ok(html.includes('data-route="'));assert.ok(html.includes('<noscript>'));
 for(const match of html.matchAll(/(?:src|href)="(\.\/assets\/[^"?]+)"/g)){
  const assetURL=new URL(match[1],baseURL);assert.ok(assetURL.pathname.startsWith('/project/assets/'));assert.ok((await stat(resolve(out,assetURL.pathname.slice('/project/'.length)))).isFile());
 }
}
const manifest=JSON.parse(await read('.vite/manifest.json'));
for(const feature of ['collection','planner','builds','compare'])assert.ok(Object.keys(manifest).some(key=>key.includes('features/'+feature+'/index.mjs')));
for(const name of await readdir(resolve(out,'assets'))){
 if(!name.endsWith('.css'))continue;
 const path=resolve(out,'assets',name),text=await readFile(path,'utf8');
 for(const match of text.matchAll(/url\(["']?([^\)"']+)["']?\)/g)){
  if(/^(data:|https?:)/.test(match[1]))continue;
  const target=resolve(dirname(path),decodeURIComponent(match[1].split('?')[0]));assert.ok(!relative(out,target).startsWith('..'));assert.ok((await stat(target)).isFile(),name+' missing '+target);
 }
}
const items=JSON.parse(await read('data/explorer/catalogue.json')).items,talismans=items.filter(i=>i.kind==='talisman');
assert.equal(talismans.length,24);assert.ok(talismans.every(i=>/[\u4e00-\u9fff]/.test(i.description)));
assert.equal(talismans.filter(i=>i.descriptionOrigin==='native-level-I-effect').length,19);
console.log('895 unique static routes, project-subpath assets, independent feature chunks, CSS resources and 24 Chinese talisman descriptions passed.');
