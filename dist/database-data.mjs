import {retryable} from './resources.mjs?v=layout2';
const fetchJSON=async url=>{const response=await fetch(url);if(!response.ok)throw Error('数据库读取失败');return response.json();};
export const loadDatabaseIndex=retryable(()=>fetchJSON('./data/database/index.json?v=db1'));
const categories=new Map(),details=new Map();
export function loadDatabaseCategory(category){if(!/^[a-z-]+$/.test(category))return Promise.reject(Error('未知分类'));if(!categories.has(category))categories.set(category,retryable(()=>fetchJSON('./data/database/'+category+'.json?v=db1')));return categories.get(category)();}
export function loadDatabaseRecord(record){const key=record.categoryKey+'-'+record.id;if(!details.has(key))details.set(key,retryable(()=>fetchJSON(record.detail||'./data/database/items/'+key+'.json?v=db1')));return details.get(key)();}
export async function findDatabaseRecord(category,name){const {items}=await loadDatabaseCategory(category);const normal=t=>String(t||'').trim().toLocaleLowerCase().replace(/[’']/g,"'");return items.find(i=>[i.id,i.name,i.english].some(v=>normal(v)===normal(name)));}
