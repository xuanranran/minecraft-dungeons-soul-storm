import {build} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist');
await build({configFile:resolve(root,'vite.config.mjs')});
const template=await readFile(resolve(out,'index.html'),'utf8'),json=async file=>JSON.parse(await readFile(resolve(root,'public',file),'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const routes=[['map','map=overworld','探索地图'],['storm','storm','灵魂风暴'],['database','database','数据库'],['collection','collection','收藏品'],['planner','planner','配装规划'],['builds','builds','配装列表'],['compare','compare','装备对比']];
for(const category of (await json('data/database/index.json')).categories){
 routes.push(['database/'+category.id,'database&category='+category.id,category.name]);
 for(const item of (await json('data/database/'+category.id+'.json')).items)routes.push(['database/'+category.id+'/'+item.id,'database&category='+category.id+'&item='+item.id,item.name,item.description||'',item]);
}
for(const [path,route,title,description='',item] of routes){
 const base='../'.repeat(path.split('/').length),folder=resolve(out,path);await mkdir(folder,{recursive:true});
 let html=template.replace('<html lang="zh-CN">','<html lang="zh-CN" data-route="'+escape(route)+'">').replace('<base href="./">','<base href="'+base+'">').replace(/<title>.*?<\/title>/,'<title>'+escape(title)+' · 我的世界地下城 2</title>');
 if(description)html=html.replace(/(<meta name="description" content=")[^"]*/,'$1'+escape(description));
 const fallback='<noscript><section class="static-content"><h2>'+escape(title)+'</h2>'+ (description?'<p>'+escape(description)+'</p>':'<p>启用 JavaScript 后可使用搜索、配装和地图交互。</p>')+(item?.image?'<img src="'+escape(item.image)+'" width="80" height="80" alt="">':'')+'</section></noscript>';
 html=html.replace('<main ',fallback+'<main ');await writeFile(resolve(folder,'index.html'),html);
}
await writeFile(resolve(out,'routes.json'),JSON.stringify(routes.map(([path,route,title])=>({path:'/'+path+'/',route,title}))));
await writeFile(resolve(out,'.nojekyll'),'');
console.log('Prerendered '+routes.length+' static routes; assets are content-hashed and loaded by feature.');
