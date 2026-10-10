import {retryable} from './resources.mjs?v=layout2';
const get=async name=>{const r=await fetch('./data/explorer/'+name+'.json?v=tools1');if(!r.ok)throw Error('读取失败');return r.json();};
export const loadCatalogue=retryable(()=>get('catalogue'));
export const loadRules=retryable(()=>get('rules'));
export const loadLoadouts=retryable(()=>get('loadouts'));
export const loadWeapons=retryable(()=>get('weapons'));
export const loadPublicBuilds=retryable(()=>get('builds'));
export function readSaved(key,fallback){try{return JSON.parse(localStorage.getItem('dungeons-explorer-'+key))??fallback;}catch{return fallback;}}
export function save(key,value){localStorage.setItem('dungeons-explorer-'+key,JSON.stringify(value));}
