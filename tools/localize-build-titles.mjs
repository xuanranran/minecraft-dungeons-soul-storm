// Community build titles are translated separately from native game item text.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),source=new URL('sources/dungeons-tools/explorer/build-introductions-zh.json',root),output=new URL('public/data/explorer/builds.json',root);
const titles={
 2:'翻滚射击近身游侠',3:'红石破坏者火焰波',5:'竖琴弩刷宝',4:'千刃雷击',1:'平原之傲练级配装',8:'跳跃攻击',41:'毒素',32:'辅助法师',17:'召唤同伴',16:'破阵者范围歼灭',15:'敌群与首领控制',13:'坦克',11:'不死冰霜法师',10:'迅捷打击者',9:'一击游侠',79:'冰霜领主',74:'持续范围效果',73:'翻滚游侠',72:'暴击',71:'无敌黄蜂',69:'连射机枪',67:'机枪',66:'持续翻滚',65:'护手跳跃一击',64:'纯近战',63:'巨斧连击',62:'机枪连射',61:'清群纯伤害',60:'四秒爆发',59:'翻滚循环',58:'省心战斗',57:'首领粉碎机',56:'跳跃斗士',51:'极限伤害',50:'日耀翻滚',47:'平原之傲雷电输出',45:'锈刃斩击',44:'击倒',43:'坦克辅助',42:'元素伤害爆发',40:'刷宝狂人',39:'狙击配装',37:'灵魂收割地狱',35:'远程辅助',34:'治疗者',33:'强化雷击杀手',30:'钢丝绒护手配装',28:'箭神',27:'箭雨坦克',26:'强力霰射弓',25:'火焰毒素坦克',24:'烈焰之刃首领杀手',23:'首席附魔师护手爆发',22:'首席附魔师雷电跳跃',19:'药水循环护手输出',18:'迅捷诡术师'
};
const metadata=JSON.parse(await readFile(source,'utf8')),data=JSON.parse(await readFile(output,'utf8'));
for(const build of data.builds){const title=titles[Number(build.id.split('-')[0])];if(!title)throw Error('Missing build title: '+build.id);build.title_zh=title;metadata[build.id].title_zh=title;if(build.intro)build.intro=build.intro.replaceAll('千斩','千刃');if(metadata[build.id].intro)metadata[build.id].intro=metadata[build.id].intro.replaceAll('千斩','千刃');}
await writeFile(source,JSON.stringify(metadata,null,2)+'\n');await writeFile(output,JSON.stringify(data));
console.log('Localized '+data.builds.length+' community build titles using native item names.');
