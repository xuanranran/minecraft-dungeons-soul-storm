import {retryable} from './resources.mjs?v=layout2';
async function json(url){
 const response=await fetch(url);
 if(!response.ok)throw Error('装备数据加载失败，请重试。');
 return response.json();
}
export const loadEquipmentIndex=retryable(()=>json('./data/equipment/index.json?v=layout2'));
const details=new Map();
export function loadEquipmentItem(item){
 if(!details.has(item.id))details.set(item.id,retryable(()=>json(item.detail)));
 return details.get(item.id)();
}
