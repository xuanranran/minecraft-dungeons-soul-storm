import {showNotice} from './ui.mjs?v=layout2';
import {kinds,parts} from './explorer-model.mjs?v=tools2';
import {bindEquipmentTooltip,hideEquipmentTooltip} from './equipment-tooltip.mjs?v=hoverfix1';
export function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
export function button(text,action,style='secondary'){const b=el('button',style,text);b.type='button';if(action)b.addEventListener('click',action);return b;}
export function field(name,input){const label=el('label','explorer-field');label.append(el('span','',name),input);return label;}
export function select(options,value,change){const s=el('select');for(const [id,name] of options){const o=el('option','',name);o.value=id;s.append(o);}s.value=value;if(change)s.addEventListener('change',()=>change(s.value));return s;}
export function input(type,placeholder,value=''){const n=el('input');n.type=type;n.placeholder=placeholder;n.value=value;return n;}
export function heading(panel,eyebrow,title,subtitle){const head=el('div','page-heading'),left=el('div');left.append(el('div','page-eyebrow',eyebrow),el('h2','',title),el('p','',subtitle));head.append(left);panel.append(head);return head;}
export function itemPicture(item,{rarity=item.unique?'unique':item.kind==='artifact'?'special':'common',level=1,book=false,equipment={}}={}){
 const frame=el('span','tool-item-picture'+(book?' native-book':''));frame.dataset.kind=item.kind;frame.dataset.rarity=rarity;
 frame.style.setProperty('--equipment-color',{common:'#b49d89',rare:'#65ed55',special:'#2ca2fe',unique:'#ff7e2f'}[rarity]);
 const image=el('img');image.src=item.levels?.[level-1]?.image||item.image;image.alt='';image.loading='lazy';image.width=80;image.height=80;
 if(!book&&item.kind!=='talisman'){const mark=el('span','native-square-mark');mark.setAttribute('aria-hidden','true');frame.append(mark);}
 if(book){const diamond=el('span','native-indicator native-enchantment');diamond.append(image);frame.append(diamond);}else frame.append(image);
 if(item.kind==='talisman')frame.append(el('span','tool-talisman-level',['I','II','III'][level-1]));
 if(equipment.ench){const mark=el('img','tool-enchanted-mark');mark.src='./images/explorer-ui/enchant-swirl.png';mark.alt='';frame.append(mark);}
 bindEquipmentTooltip(frame,item,{rarity,level,...equipment});return frame;
}
export const itemLabel=item=>[kinds[item.kind],parts[item.slot],item.unique?'独特':'',item.archetype].filter(Boolean).join(' · ');
export function itemSummary(item,options){const wrap=el('div','tool-item-summary'),info=el('div');info.append(el('h3','',item.name),el('p','meta',itemLabel(item)));wrap.append(itemPicture(item,options),info);return wrap;}
export function modal(title,className=''){const dialog=el('dialog','explorer-dialog '+className),header=el('div','explorer-dialog-header'),h=el('h2','',title),id='tool-dialog-'+Math.random().toString(36).slice(2);h.id=id;dialog.setAttribute('aria-labelledby',id);header.append(h,button('×',()=>dialog.close(),'explorer-close secondary'));header.lastChild.setAttribute('aria-label','关闭窗口');const body=el('div','explorer-dialog-body');dialog.append(header,body);document.body.append(dialog);let opener;
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});
 return {dialog,body,title:h,open(){hideEquipmentTooltip();opener=document.activeElement;dialog.showModal();},close(){dialog.close();}};
}
export function picker(){const box=modal('选择装备','tool-picker'),search=input('search','搜索名称、类型或套装…'),status=el('p','meta'),grid=el('div','tool-picker-grid');box.body.append(search,status,grid);let items=[],choose;
 function render(){const q=search.value.trim().toLowerCase(),list=items.filter(i=>[i.name,i.english,i.set,i.archetype].join(' ').toLowerCase().includes(q));status.textContent=list.length+' 件可选物品';grid.replaceChildren(...list.map(item=>{const b=button('',()=>{choose(item);box.close();});b.classList.add('tool-picker-option');b.append(itemSummary(item));return b;}));}
 search.addEventListener('input',render);return {open(title,list,onChoose){box.title.textContent=title;items=list;choose=onChoose;search.value='';render();box.open();search.focus();}};
}
export async function inspect(item){try{const {showDatabaseItem}=await import('./database-detail.mjs?v=layoutrefine2');await showDatabaseItem(item);}catch{notify('物品详情加载失败，请重试。');}}
export function notify(text){showNotice(text);}
export async function copyLink(hash){const url=new URL(location.href);url.hash=hash;try{await navigator.clipboard.writeText(url.href);notify('链接已复制');}catch{const box=modal('分享链接'),text=input('text','',url.href);text.readOnly=true;box.body.append(text,el('p','meta','选中链接后复制，可在其他设备打开。'));box.open();text.select();box.dialog.addEventListener('close',()=>box.dialog.remove(),{once:true});}}
export function download(name,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function importFile(onRead){const file=input('file','');file.accept='.json,application/json';file.addEventListener('change',async()=>{try{if(!file.files?.[0])return;if(file.files[0].size>2e6)throw Error('文件过大');const parsed=JSON.parse(await file.files[0].text());await onRead(parsed);}catch(error){notify(error.message==='文件过大'?'文件过大，请选择小于 2 MB 的备份。':'备份格式不正确，未修改现有记录。');}});file.click();}
export function safeSave(fn){try{fn();return true;}catch{notify('浏览器无法保存记录，请检查存储空间或隐私设置。');return false;}}
