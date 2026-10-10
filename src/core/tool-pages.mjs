import {retryable} from '../resources.mjs';
const pages={
 collection:()=>import('../features/collection/index.mjs'),
 planner:()=>import('../features/planner/index.mjs'),
 builds:()=>import('../features/builds/index.mjs'),
 compare:()=>import('../features/compare/index.mjs'),
 database:()=>import('../database.mjs'),
};
export const toolNames=Object.keys(pages).sort((a,b)=>a==='database'?-1:b==='database'?1:0);
export const toolControllers=Object.fromEntries(toolNames.map(name=>[name,retryable(async()=>{
 const [module]=await Promise.all([pages[name](),import('../explorer.css'),import('../drops.css')]);
 await import('../explorer-game.css');
 if(name!=='database')await import('../ui/styles/tools.css');
 await import('../database.css');
 await import('../ui/styles/details.css');
 return module['setup'+name[0].toUpperCase()+name.slice(1)]();
})]));
