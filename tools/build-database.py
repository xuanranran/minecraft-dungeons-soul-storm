"""Build local, split database facts; native names/text take precedence."""
import json
import re
from os.path import commonprefix
from pathlib import Path
from collections import defaultdict

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'sources/database'
OUT=ROOT/'dist/data/database'
(OUT/'items').mkdir(parents=True,exist_ok=True)
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,d): p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
LOC=ROOT.parent/'minecraft-dungeons-native-assets/exports/map-localization/Dungeons/Content/Localization/All'
en,zh=read(LOC/'en/All.json'),read(LOC/'zh-Hans/All.json')
def norm(t): return re.sub(r'\s+',' ',str(t).replace('’',"'")).strip().casefold()
lookup={};provenance={};dynamic=[]
for ns,entries in en.items():
 for key,value in entries.items():
  target=zh.get(ns,{}).get(key)
  if isinstance(value,str) and target:
   lookup[norm(value)]=(target,ns,key)
   if '{0}' in value and value.replace('{0}','').strip() and len(value)<250:
    dynamic.append((re.compile('^'+re.escape(value).replace(r'\{0\}',r'(.+?)')+'$',re.I),target))
labels={'HEALTH':'基础生命','DAMAGE':'基础伤害','POISE':'韧性','SOULS':'灵魂','WEAK TO':'弱点','LEVEL':'推荐等级','REGION':'地区','MOBS':'生物','GOES ON':'可用部位','WHAT IT DOES':'效果','GEAR':'适用装备数','TYPE':'类型','IN-GAME TEXT':'原生说明','Health':'基础生命','Top hit':'最高单次伤害','Poise':'韧性','Souls':'灵魂','Speed':'速度','Area':'地区','Level':'推荐等级','Given by':'领取条件','Opens':'解锁任务','Repeatable':'可重复','XP':'经验','Emeralds':'绿宝石','Hostile':'敌对生物','Passive':'被动生物','Companion':'同伴','Boss':'首领','Miniboss':'小型首领','Soul corrupted':'灵魂腐化','Region':'地区','Dungeon':'地牢','Cave':'洞穴','Rift':'裂隙','Tower':'高塔','Portal':'传送门','Utility':'实用','Offensive':'攻击','Defensive':'防御','Boots':'靴子','Chest':'胸甲','Helmet':'头盔','Leggings':'护腿','MeleeWeapon':'近战武器','RangedWeapon':'远程武器','Melee weapon':'近战武器','Ranged weapon':'远程武器','Armor':'盔甲','Artifact':'法器','Talisman':'护身符','Enchantment':'附魔','Effect':'装备效果','Status':'状态','Attacks':'攻击方式','Weaknesses and resistances':'弱点与抗性','Forms':'变种','Spawns in':'出现地区','Physical':'物理','Light attack':'轻击','Heavy attack':'重击','Ranged attack':'远程攻击','Base':'基础形态','Soul imbalance':'灵魂失衡','Variant I':'变种 I','Variant II':'变种 II','ATTACK':'攻击','SPLASH':'溅射','COOLDOWN':'冷却','FORM':'形态','Blast damage':'爆炸伤害','Melee damage':'近战伤害','Ranged damage':'远程伤害','Fire damage':'火焰伤害','Frost damage':'冰霜伤害','Lightning damage':'闪电伤害','Poison damage':'毒素伤害','Soul damage':'灵魂伤害','Elemental damage':'元素伤害','Knockback':'击退','Yes':'是','No':'否','none':'无','Any':'任意','Starts with the game':'开始游戏时','No description yet':'暂无原生说明'}
labels.update({'Positive status':'正面状态','Negative status':'负面状态','Deep Dark dungeons':'深暗之域地牢','Sift rifts':'汐浮裂隙','Minecart station':'矿车站','Entrances':'入口','Fancy chests':'华丽宝箱','Wooden chests':'木质宝箱','Pots':'绿宝石罐','Hidden chests':'隐藏宝箱','Dungeon entrances':'地牢入口','Rift entrances':'裂隙入口','Wellspring chests':'源泉宝箱','Comes after':'前置任务','How to get it':'获取方式'})
def tr(text):
 text=str(text or '').strip()
 if not text:return ''
 if text in labels:return labels[text]
 value=lookup.get(norm(text))
 if value:
  provenance[text]={'namespace':value[1],'key':value[2],'zh':value[0]};return value[0]
 for expression,target in dynamic:
  match=expression.fullmatch(text)
  if match:return target.replace('{0}',tr(match[1]))
 if text.startswith('Soul Corrupted '):return '灵魂腐化'+tr(text[15:])
 if text.startswith('In '):return '位于'+tr(text[3:])
 if text.startswith('Defeat '):return '击败'+tr(text[7:])
 if text.startswith('Outpost by ') and text.endswith(' station'):return tr(text[11:-8])+'站附近的前哨站'
 if ', ' in text or ' and ' in text:return '、'.join(tr(t) for t in re.split(r', | and ',text))
 text=re.sub(r'\b(Blast|Elemental|Fire|Frost|Lightning|Melee|Poison|Ranged|Soul)\b',lambda m:{'Blast':'爆炸','Elemental':'元素','Fire':'火焰','Frost':'冰霜','Lightning':'闪电','Melee':'近战','Poison':'毒素','Ranged':'远程','Soul':'灵魂'}[m[0]],text)
 return text.replace(' sec',' 秒').replace(' restarts if you quit','（退出后重置）').replace(' any order','（任意顺序）')
def objective_text(text):
 unlock=re.fullmatch(r'Opens once you finish "(.+?)" in (.+)',text)
 if unlock:return '在'+tr(unlock[2])+'中完成“'+tr(unlock[1])+'”后解锁'
 unlock=re.fullmatch(r'Opens during (.+?) at "(.+?)"',text)
 if unlock:return '在'+tr(unlock[1])+'进行至“'+tr(unlock[2])+'”时解锁'
 pieces=re.split(r'( any order| restarts if you quit| level \d+)',text)
 out=[]
 for piece in pieces:
  if piece==' any order':out.append('（任意顺序）')
  elif piece==' restarts if you quit':out.append('（退出后重置）')
  elif piece.startswith(' level '):out.append('（等级 '+piece[7:]+'）')
  elif piece.strip():
   if ':' in piece:
    action,targets=piece.split(':',1);out.append(tr(action)+'：'+tr(targets))
   else:out.append(tr(piece.strip()))
 return '；'.join(out).replace('；（','（')

catalogue=read(ROOT/'dist/data/explorer/catalogue.json')['items'];rules=read(ROOT/'dist/data/explorer/rules.json');loadouts=read(ROOT/'dist/data/explorer/loadouts.json')
by_name={norm(i['name']):i for i in catalogue};by_slug={i['slug']:i for i in catalogue}
assets={a['remote']:a['local'] for a in read(SOURCE/'assets.json')}
categories=defaultdict(list)
kind_categories={'melee':'weapons','ranged':'weapons','armor':'armor','artifact':'artifacts','talisman':'talismans'}
for item in catalogue:
 record={**item,'id':item['slug'],'categoryKey':kind_categories[item['kind']],'dbKind':'equipment','parameters':[]}
 if item.get('detailURL'):
  full=read(ROOT/'dist'/item['detailURL'].split('?')[0].removeprefix('./'))
  record['parameters']=[[k,v] for k,v in full['parameters'].items() if k in ['DPS','连招伤害','攻击段数','重量','冷却','灵魂消耗','攻击距离']]
 else:
  record['tiers']=[{'tier':['I','II','III'][n],'image':level['image'],'text':'；'.join(e['text'] for e in level['effects']) or item['description']} for n,level in enumerate(loadouts[item['slug']]['levels'])]
 categories[record['categoryKey']].append(record)
 if item['unique']:categories['unique'].append({**record,'categoryKey':'unique'})

enchants={e['slug']:e for e in rules['enchants']};effects={e['slug']:(tag,e) for tag,e in rules['effects'].items()}
for category in ['enemies','enchantments','effects','locations','cosmetics','quests','upcoming']:
 for row in read(SOURCE/(category+'.json'))['rows']:
  slug=row['href'].split('/')[-1].split('#')[-1];record={'id':slug,'slug':slug,'name':tr(row['name']),'english':row['name'],'kind':'enemy' if category=='enemies' else category.rstrip('s'),'categoryKey':category,'dbKind':'reference','image':assets.get(row['image'],''),'description':'','parameters':[[tr(k),tr(v)] for k,v in row['values'] if v],'tables':[],'related':[],'source':'https://www.dungeons.tools'+row['href'],'subtype':tr(row['sub'])}
  detail_path=SOURCE/'details'/(category+'-'+slug+'.json')
  if detail_path.exists():
   detail=read(detail_path);record['parameters']+= [[tr(k),tr(v)] for k,v in detail['parameters'] if v]
   for t in detail['tables']:
    record['tables'].append({'title':tr(t['title']),'columns':[tr(c) for c in t['columns']],'rows':[[tr(v) for v in r] for r in t['rows']]})
   if detail['resistances']:record['tables'].append({'title':'生物分布' if category=='locations' else '弱点与抗性','columns':['生物' if category=='locations' else '属性','占比' if category=='locations' else '变化'],'rows':[[tr(k),tr(v)] for k,v in detail['resistances']]})
   for link in detail['links']:
    path=link['href'].split('/');key=path[2] if len(path)>3 else '';key='weapons' if key=='weapons' else 'artifacts' if key=='artifacts' else key
    if key in ['enemies','locations','quests','weapons','armor','artifacts','cosmetics']:record['related'].append({'category':key,'id':path[-1],'name':tr(link['name'])})
   if detail.get('objectives'):record['objectives']=[{'text':objective_text(o['text']),'map':o['map']} for o in detail['objectives']]
  if category=='enchantments':
   record['iconKind']='enchantment' if row['sub']=='Enchantment' else 'effect'
   native=enchants.get(slug)
   if native:record.update(name=native['name'],image=native['image'],tiers=native['tiers'],description=native['description']);record['parameters']=[['可用部位','、'.join(tr(s) for s in native['slots'])]]
   else:
    record['description']='；'.join(tr(f) for f in row.get('tip',{}).get('f',[]));record['tiers']=[{'tier':f.split(':',1)[0].replace('Tier ',''),'text':tr(f.split(':',1)[1])} for f in row.get('tip',{}).get('f',[]) if f.startswith('Tier ') and ':' in f]
    if row['sub']=='Enchantment':record['subtype']='文件定义'
  if category=='effects':
   pair=effects.get(slug)
   if pair:
    tag,native=pair;record.update(name=native['name'],image=native['image']);entries=[t for t in rules['templates'] if t['effect']==tag];tiers=[]
    for tier in ['I','II','III']:
     texts=list(dict.fromkeys(t['text'] for t in entries if t['tier']==tier));
     if texts:tiers.append({'tier':tier,'text':'；'.join(texts)})
    record['tiers']=tiers;record['description']=tiers[0]['text'] if tiers else ''
    record['related']=[{'category':kind_categories[i['kind']],'id':i['slug'],'name':i['name']} for i in catalogue if any(t in loadouts[i['slug']]['pool'] for t in [entry['tag'] for entry in entries]) or any(e['effect']==tag for e in loadouts[i['slug']]['fixed'])]
  if category=='upcoming':record['subtype']='文件预留';record['description']=next((tr(v) for k,v in row['values'] if k=='IN-GAME TEXT'),'')
  record['parameters']=list(dict(record['parameters']).items());categories[category].append(record)

categories['bosses']=[{**e,'categoryKey':'bosses'} for e in categories['enemies'] if e['subtype']=='首领']
seen=set()
for row in read(SOURCE/'armor-sets.json')['rows']:
 slug=row['href'].split('/')[-1]
 if slug in seen:continue
 seen.add(slug);members=[by_name[norm(n)] for n in row['parts'] if norm(n) in by_name]
 name=tr(row['name'])
 if re.search(r'[A-Za-z]{3}',name) and members:
  prefix=commonprefix([m['name'] for m in members]).rstrip('之')
  name=(prefix if len(prefix)>=2 else re.sub(r'(头盔|兜帽|面罩|面具|头带|轻靴|靴子|之靴|帽)$','',members[0]['name']))+'套装'
 record={'id':slug,'slug':slug,'name':name,'english':row['name'],'kind':'armor-set','categoryKey':'armor-sets','dbKind':'reference','image':members[0]['image'] if members else '', 'parameters':[[tr(k),tr(v)] for k,v in row['values'] if v],'related':[{'category':'armor','id':m['slug'],'name':m['name']} for m in members],'source':'https://metabot.gg'+row['href']}
 categories['armor-sets'].append(record)
set_names={r['english']:r['name'] for r in categories['armor-sets']}
for record in categories['armor-sets']:
 record['parameters']=[(key,set_names.get(value,value)) for key,value in record['parameters']]
all_records={r['id']:(category,r['name']) for category,records in categories.items() if category not in ['unique','bosses'] for r in records}
for records in categories.values():
 for record in records:
  for link in record.get('related',[]):
   if link['id'] in all_records and link['category']=='artifacts':
    link['category'],link['name']=all_records[link['id']]
names={'weapons':'武器','armor':'盔甲','armor-sets':'盔甲套装','artifacts':'法器','talismans':'护身符','enchantments':'附魔','effects':'装备效果','unique':'独特物品','enemies':'生物','bosses':'首领','locations':'地点','quests':'任务','cosmetics':'装饰','upcoming':'预留内容'}
index={'version':1,'captured_at':'2026-10-10','categories':[],'search':[]}
for category,label in names.items():
 records=categories[category]
 for record in records:
  record['detail']='./data/database/items/'+category+'-'+record['id']+'.json?v=db1';write(OUT/'items'/(category+'-'+record['id']+'.json'),record)
 lightweight=[{k:v for k,v in r.items() if k not in ['tables','tiers','related','objectives']} for r in records]
 write(OUT/(category+'.json'),{'items':lightweight})
 index['categories'].append({'id':category,'name':label,'count':len(records),'image':next((r['image'] for r in records if r['image']),''),'description':'未实装的文件预留定义' if category=='upcoming' else '基础参数、详细机制与相关资料'})
 index['search'] += [{k:r[k] for k in ['id','name','english','image','categoryKey','kind','unique','subtype','iconKind','description'] if k in r} for r in records]
write(OUT/'index.json',index);write(SOURCE/'native-translations.json',provenance)
print('Database:',', '.join(k+' '+str(len(v)) for k,v in categories.items()))
