"""Import explicit cooked database fields and texture references without simulating GAS.

Uses the existing full extraction. Attribute/ability overrides and inheritance
remain separate: definition values are not advertised as scaled runtime stats.
"""
import collections
import hashlib
import json
from pathlib import Path
import re
import shutil
from native_assets import native_assets_root, full_extraction_root

ROOT = Path(__file__).resolve().parents[1]
NATIVE = full_extraction_root()
TABLES = NATIVE / 'tables-features/Dungeons/Content/Spicewood/Core/DataTables/UFS'
LOC = native_assets_root() / 'exports/map-localization/Dungeons/Content/Localization/All'
PUBLIC = ROOT / 'public'

def read(path): return json.loads(path.read_text('utf-8'))
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', 'utf-8')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

english, chinese = read(LOC / 'en/All.json'), read(LOC / 'zh-Hans/All.json')
names = collections.defaultdict(list)
sources, definitions = [], {}

def text_name(row):
    for value in row.get('TypeTextData', {}).get('Texts', {}).values():
        match = re.fullmatch(r'LOCTABLE\("([^"]+)", "([^"]+)"\)', value.get('Text', ''))
        if match and match[2].endswith('_Name'):
            namespace = 'Text/Release/' + match[1]
            return english.get(namespace, {}).get(match[2], ''), chinese.get(namespace, {}).get(match[2], ''), {'namespace': namespace, 'key': match[2]}
    return '', '', {}

attributes = dict(zip([
    'Health','HealthMax','Poise','PoiseDelay','PoiseRecovery','MovementSpeed','MeleeAttackSpeed','RangedAttackSpeed','SoulYield','Shield','Mass','GravityScale','CriticalHitChance','AggroDecayRate','AggroMultiplier','KnockbackMultiplier','StaggerMultiplier','RangedVelocityMultiplier','LifeLeechMeleePercentage','CompanionResistanceMultiplier','ThornsActivationChance','ThornsDamageMultiplier','ItemPowerRangedWeapon','GiveNegativeStatusDurationMultiplier','ReceiveNegativeStatusDurationMultiplier','MaximumAcceptableRadiusModifier','MinimumAcceptableRadiusModifier','Ability.EnrageCounter',
], [
    '生命','最大生命','韧性','韧性恢复延迟','韧性恢复速度','移动速度','近战攻击速度','远程攻击速度','灵魂产出','护盾','质量','重力系数','暴击率','仇恨衰减速度','仇恨倍率','击退倍率','硬直倍率','远程投射物速度倍率','近战吸血系数','同伴抗性倍率','荆棘触发率','荆棘伤害倍率','远程武器战力','施加负面状态时长倍率','受到负面状态时长倍率','最大距离容差修正','最小距离容差修正','狂暴计数',
]))
attributes.update(dict(zip([
    'AI.LineOfSightDirectionalCone','AI.PerceptionBuildUpAcceptanceValue','AI.PerceptionBuildUpAngleAcceptance','AI.PerceptionBuildUpTime','AI.PerceptionDelayUntilAggressive','AI.PerceptionDelayUntilIdle','AI.SightPerceptionRadius',
], ['视野角度','感知累积阈值','感知角度阈值','感知累积时间','进入敌对状态延迟','回到闲置状态延迟','视觉感知半径'])))
for element, label in [('Base','基础'),('Melee','近战'),('Ranged','远程'),('Blast','爆炸'),('Fire','火焰'),('Ice','冰霜'),('Lightning','闪电'),('Poison','毒素'),('Soul','灵魂'),('Elemental','元素'),('TNT','TNT')]:
    attributes[element+'DamageResistanceMultiplier'] = label+'伤害抗性倍率'
    attributes['Resistance.'+element+'DamageResistanceMultiplier'] = label+'伤害抗性倍率'
    attributes['Damage.'+element+'DamageMultiplier'] = label+'伤害倍率'
attributes['Resistance.KnockbackResistanceMultiplier'] = '击退抗性倍率'
keys = {
    'Damage':'伤害','PoiseDamage':'韧性伤害','CooldownDuration':'冷却时间','ActivationChance':'触发权重','TargetDistanceMax':'最大目标距离','TargetDistanceMin':'最小目标距离','IdealTargetDistance':'理想目标距离','IdealTargetDistanceMargin':'目标距离容差','IdealTargetDistanceNoveltyModifier':'目标距离修正','MaxChaseDuration':'最长追击时间','ReturnToSpawnDistance':'返回生成点距离','ReturnToSpawnTimeSinceLastHit':'脱战返回等待时间','MobCost':'生成消耗','XPOverride':'经验覆盖值','Audio.CombatIntensity':'战斗音频强度','PathFollowing.MinHeightPercentage':'寻路最小高度比例','ThreatLevelArea':'地区威胁等级','AmbientMobsTotalSpawnNumber':'环境生物生成数',
}
call_names = {'LightAttack':'轻击','HeavyAttack':'重击','RangedAttack':'远程攻击','Stagger':'硬直','Death':'死亡','None':'通用能力'}
call_names.update({'Chase':'追击','Charge':'冲锋','Roam':'游荡','Retreat':'撤退','Follow':'跟随','Flee':'逃跑','Panic':'惊慌','PanicSelf':'自身惊慌','BaseRangedAttack':'基础远程攻击','Melee':'近战','Ranged':'远程','Bite':'咬击','Swipe':'挥击','Slam':'猛击','ShockwaveSlam':'冲击波猛击','SlimeSplit':'史莱姆分裂','SlimeBucket':'史莱姆桶','RedStoneCubeSummon':'召唤红石方块','SummonIllagers':'召唤灾厄村民','VexSummon':'召唤恼鬼','FangTrap':'尖牙陷阱','ShriekSummon':'尖啸召唤','ExplodingPillars':'爆炸柱','RedstoneProjectile':'红石投射物','FollowUp':'后续攻击','Close':'近距离','Fast':'快速','Far':'远距离','AroundTarget':'绕行目标','Enrage':'狂暴','Attack':'攻击','Application':'施加效果','Spawn':'生成','Reposition':'重新定位','HandleFinalDeath':'最终死亡处理','EatGrass':'吃草'})
keys.update({
    'AbilityCanBeRetriggeredWhenActive':'激活期间允许再次触发','DamageValue':'伤害数值','DamageOnHit':'命中伤害','DamageOnPull':'拉拽伤害','FallbackDamage':'备用攻击伤害','NumberOfProjectiles':'投射物数量','AngleSpan':'发射角度范围','Range':'范围','Distance':'距离','Radius':'半径','Duration':'持续时间','StaggerDuration':'硬直时长','StartDelay':'开始延迟','EndDelay':'结束延迟','TelegraphDelay':'预警延迟','WaitDelay':'等待时间','ApplicationDelay':'施加延迟','AttackFrequency':'攻击频率','SpinDuration':'旋转持续时间','SpinCollisionRadius':'旋转碰撞半径','MaxRotationInDegreesPerSecond':'每秒最大旋转角度','MinimumSpawns':'最少生成数','MaximumSpawns':'最多生成数','SpawnInterval':'生成间隔','MaxPopulation':'最大存活数量','MinimumFollowDistance':'最小跟随距离','IdealFollowDistance':'理想跟随距离','FollowTriggerDistance':'开始跟随距离','FollowTriggerDistanceWhenInCombat':'战斗中开始跟随距离','PanicDuration':'惊慌时长','PanicSpeedMultiplier':'惊慌速度倍率','PanicFleeRadius':'惊慌逃跑半径','FleeDistance':'逃跑距离','FleeAcceptanceRadius':'逃跑距离容差','PullStrength':'拉拽强度','PullRadius':'拉拽半径','PullSpeed':'拉拽速度','TossStrength':'抛掷强度','LassoRange':'套索范围','MaxChargeDistance':'最大冲锋距离','MinChargeDistance':'最小冲锋距离','OptionalChargeTimeout':'冲锋超时时间','MaxDurationAfterAttack':'攻击后最长持续时间','AcceptanceRadiusOverride':'距离容差覆盖值','MaxEnchantedTargets':'最多附魔目标数','SoulsPerHealthLost':'每损失生命产生的灵魂数','MinDelayTime':'最小延迟','MaxDelayTime':'最大延迟','ActorLifetimeAfterAbilityEnd':'能力结束后实体存续时间','ReApplicationInterval':'重复施加间隔','MovementAcceptanceRadius':'移动距离容差','MinRadius':'最小半径','MaxRadius':'最大半径','SpawnHeightOffset':'生成高度偏移','SpawnDirectionOffset':'生成方向偏移','AngleOffset':'角度偏移','DescentDelay':'下降延迟','DescentFlightSpeed':'下降飞行速度','ProbeLifetime':'探针存续时间','ProbeSpeed':'探针速度',
})
operations = {'Override':'覆盖','Add':'相加','Multiply':'相乘','Divide':'相除'}

def scalar(value):
    kind = value.get('Type')
    if kind in ('Float', 'Int', 'Bool') and kind in value: return value[kind]
    return None

def ability_fields(row):
    result = []
    for ability in row.get('Abilities', []):
        values = []
        for value in ability.get('CommonKeyValues', []):
            number = scalar(value)
            if number is not None: values.append({'tag':value['TypeTag']['TagName'],'value':number,'operation':'Definition'})
        for block in ability.get('InstanceData', []):
            for name, number in block.items():
                if isinstance(number, (int, float, bool)): values.append({'tag':name,'value':number,'operation':'Definition'})
        if values: result.append({'ability':ability['Ability'],'callsign':ability.get('AbilityCallsign',{}).get('TagName','None'),'values':values})
    for ability in row.get('AbilitySpecialization', {}).get('Specializations', []):
        values = []
        for entry in ability.get('KeyValueSpecializations', []):
            value = entry['KeyValue'];number = scalar(value)
            if number is not None: values.append({'tag':value['TypeTag']['TagName'],'value':number,'operation':entry.get('ModOp','Definition')})
        if values: result.append({'ability':ability['Ability'],'callsign':ability.get('AbilityCallsign',{}).get('TagName','None'),'values':values})
    return result

files = sorted(TABLES.glob('DT_Mob*Definition.json')) + [TABLES/'DT_AreaDefinition.json']
for path in files:
    if 'PropActor' in path.name: continue
    source = path.relative_to(NATIVE).as_posix()
    sources.append({'source':source,'sha256':sha(path)})
    for row in read(path):
        tag = row.get('TypeTag',{}).get('TagName')
        if not tag: continue
        en, zh, localization = text_name(row)
        definition = {'source':source,'row':row['Name'],'tag':tag,'name':zh,'english':en,'localization':localization,
            'parents':[t['TagName'] for t in row.get('Traits',{}).get('GameplayTags',[])],
            'attributes':[{'tag':a['Attribute']['TagName'],'value':a['Value']} for a in row.get('AttributeValues',[])],
            'keyValues':[{'tag':a['TypeTag']['TagName'],'value':scalar(a)} for a in row.get('KeyValues',[]) if scalar(a) is not None],
            'abilities':ability_fields(row),'attributeAdjustments':row.get('AttributeAdjustments',{}),
            'conditions':row.get('MobConditions',{}),'variants':row.get('Variants',{}),
            'character':row.get('CharacterReference'), 'icon':row.get('IconReference') or row.get('AreaIcon')}
        if 'AreaDefinition' in row: definition['area']=row['AreaDefinition']
        definitions[tag]=definition
        if en and zh: names[('locations' if path.stem=='DT_AreaDefinition' else 'enemies',en.casefold())].append(definition)

texture_paths = {p.relative_to(NATIVE/'textures').as_posix():p for p in (NATIVE/'textures').rglob('*.png')}
def native_image(reference):
    if not reference or reference=='None': return None
    package = reference.split('.')[0].lstrip('/')
    prefix, suffix = package.split('/',1)
    relative = ('Dungeons/Content/' if prefix=='Game' else 'Dungeons/Plugins/'+prefix+'/Content/')+suffix+'.png'
    source = texture_paths.get(relative)
    if not source: return None
    target = PUBLIC/'images/database-native'/source.name
    target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
    file = target.relative_to(PUBLIC).as_posix()
    if not any(s.get('file')==file for s in sources): sources.append({'source':source.relative_to(NATIVE).as_posix(),'file':file,'sha256':sha(target)})
    return './'+file

def number(value): return ('是' if value else '否') if isinstance(value,bool) else format(value,'.15g')
patches, unmatched, raw_labels = {}, [], set()
for category in ['enemies','locations']:
    for record in read(PUBLIC/f'data/database/{category}.json')['items']:
        found = names.get((category,record['english'].casefold()),[])
        if not found: unmatched.append(category+':'+record['id']);continue
        found.sort(key=lambda d:('Variant' in d['source'] or 'SoulStated' in d['source'],len(d['tag']),d['row']))
        values, abilities, variants = [], [], []
        for definition in found:
            label = definition['name'] + (' · '+definition['row'] if len(found)>1 else '')
            for field in definition['attributes']+definition['keyValues']:
                tag = field['tag'];suffix=tag.removeprefix('SW.Attribute.').removeprefix('SW.KeyValue.')
                translated = attributes.get(suffix) or keys.get(suffix) or suffix
                if translated==suffix:raw_labels.add(tag)
                values.append([label,translated,number(field['value'])])
            for ability in definition['abilities']:
                callsign=ability['callsign'].split('.')[-1];name=call_names.get(callsign,callsign)
                for field in ability['values']:
                    suffix=field['tag'].removeprefix('SW.KeyValue.')
                    if suffix not in keys:raw_labels.add(field['tag'])
                    abilities.append([label,name,keys.get(suffix,suffix),number(field['value']),operations.get(field['operation'],'定义值' if field['operation']=='Definition' else field['operation'])])
            for replacement in definition['variants'].get('Replacements',[]):
                tag=replacement['TypeTagToUseInstead']['TagName'];target=next((d for t,d in definitions.items() if t.casefold()==tag.casefold()),{})
                variants.append([target.get('name') or tag,number(replacement.get('Weight',0)), '禁用' if str(replacement.get('ShouldSpawn','')).endswith("SWGC_False'") else '无额外条件' if replacement.get('ShouldSpawn','None')=='None' else '按运行时条件判断'])
        tables=[]
        if values:tables.append({'title':'原生属性（定义值）','native':True,'note':'解包表中的直接定义值；继承、难度与战力缩放另行计算。','columns':['定义','参数','数值'],'rows':values})
        if abilities:tables.append({'title':'原生能力参数','native':True,'note':'保留能力的定义值与覆盖操作；未翻译的内部字段保留原名。','columns':['定义','能力','参数','数值','操作'],'rows':abilities})
        if variants:tables.append({'title':'原生变种替换规则','native':True,'note':'权重不是生成概率，实际生成还取决于地区与运行时条件。','columns':['目标','权重','条件'],'rows':variants})
        patch={'tables':tables,'native':{'definitions':found,'catalogue':'./data/database/native-definitions.json'}}
        image=next((image for d in found if (image:=native_image(d['icon']))),None)
        if image:patch['image']=image
        patches[category+':'+record['id']]=patch

# Keep map popups and their split lazy-loaded data aligned with database images.
# Only direct texture bindings replace an image; positions and identities stay intact.
map_path = PUBLIC/'maps.json'
map_image_updates = 0
if map_path.exists():
    maps = read(map_path)
    for dimension in maps['dimensions']:
        changed = False
        for marker in dimension['markers']:
            for species in marker.get('species', []):
                match = re.search(r'category=enemies&item=([^&]+)', species.get('href',''))
                patch = patches.get('enemies:'+match[1],{}) if match else {}
                if patch.get('image') and species.get('image')!=patch['image']:
                    species['image']=patch['image'];changed=True;map_image_updates+=1
            if marker.get('species'):
                marker['icon']=next((s['image'] for s in marker['species'] if s.get('image')),marker['icon'])
        if changed:
            write(PUBLIC/f'data/maps/{dimension["id"]}.json',dimension['markers'])
            dimension['data']=f'./data/maps/{dimension["id"]}.json?v=native3'
    if map_image_updates:
        write(map_path,maps)
        index_path=PUBLIC/'data/maps/index.json';index=read(index_path)
        for dimension in index['dimensions']:
            dimension['data']=next(d['data'] for d in maps['dimensions'] if d['id']==dimension['id'])
        write(index_path,index)

write(ROOT/'sources/database/native-supplement.json',{'version':1,'records':patches})
write(PUBLIC/'data/database/native-definitions.json',{'version':1,'definitions':list(definitions.values()),'sources':sources,
    'note':'Explicit cooked definition values. Trait inheritance, GAS modifiers, conditions and runtime scaling are retained separately; no scaled combat values or spawn probabilities are invented.'})
write(PUBLIC/'data/database/native-import-report.json',{'matched':len(patches),'byCategory':{c:sum(k.startswith(c+':') for k in patches) for c in ['enemies','locations']},'unmatched':unmatched,'nativeImages':sum('image' in p for p in patches.values()),'definitionCount':len(definitions),'sources':sources,'untranslatedFields':sorted(raw_labels)})
print('Native database:',len(patches),'matched records;',sum('image' in p for p in patches.values()),'directly referenced original images;',len(unmatched),'unmatched records.')
