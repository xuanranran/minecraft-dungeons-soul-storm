import fs from 'node:fs/promises';
const dist=new URL('../public/',import.meta.url),folder=new URL('data/equipment/',dist);
const original=JSON.parse(await fs.readFile(new URL('equipment.json',dist),'utf8'));
await fs.mkdir(new URL('items/',folder),{recursive:true});
const items=[];
for(const item of original.items){
 if(!/^[a-z0-9_-]+$/i.test(item.id))throw Error('Invalid equipment resource ID');
 const {parameters,fixed_effects,tables,...summary}=item;
 summary.detail=`./data/equipment/items/${item.id}.json?v=layout2`;
 items.push(summary);
 await fs.writeFile(new URL(`items/${item.id}.json`,folder),JSON.stringify(item));
}
await fs.writeFile(new URL('index.json',folder),JSON.stringify({...original,items}));
console.log(`Equipment data: ${items.length} summaries and individual detail files built.`);
