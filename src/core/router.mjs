const names=new Set(['map','storm','database','collection','planner','builds','compare']);
export function routeParams(){
 if(location.hash.length>1)return new URLSearchParams(location.hash.slice(1));
 const base=new URL(document.baseURI).pathname,relative=location.pathname.startsWith(base)?location.pathname.slice(base.length):'',parts=relative.split('/').filter(Boolean),name=parts[0];
 if(!names.has(name))return new URLSearchParams(document.documentElement.dataset.route||'map=overworld');
 const params=new URLSearchParams(location.search);params.set(name,name==='map'?decodeURIComponent(parts[1]||params.get('map')||'overworld'):'');
 if(name==='database'){if(parts[1])params.set('category',decodeURIComponent(parts[1]));if(parts[2])params.set('item',decodeURIComponent(parts[2]));}
 return params;
}
export function pageURL(name,world='overworld'){
 const url=new URL(name+'/',document.baseURI);if(name==='map'&&world!=='overworld')url.searchParams.set('map',world);return url;
}
