"""Join factual tool data with native localisation and exported textures.

Run after capturing the three public tool payloads into tool-references and
exporting DT_* tables and talisman textures with UnrealAssetScout. No UI code,
community guides or remote executable scripts are included in the output.
"""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NATIVE = ROOT.parent / 'minecraft-dungeons-native-assets'
REF = ROOT / 'tool-references'
OUT = ROOT / 'dist/data/explorer'
SOURCE = ROOT / 'sources/dungeons-tools/explorer'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')

loc = NATIVE / 'exports/map-localization/Dungeons/Content/Localization/All'
en, zh = read(loc / 'en/All.json'), read(loc / 'zh-Hans/All.json')
def norm(s):
    return re.sub(r'\s+', ' ', s.replace('’', "'")).strip().casefold()
lookup = {}
for ns, entries in en.items():
    for key, value in entries.items():
        if isinstance(value, str) and zh.get(ns, {}).get(key):
            lookup[norm(value)] = (zh[ns][key], ns, key)
provenance = {}
def translate(s):
    if not s:
        return ''
    result = lookup.get(norm(s))
    if not result:
        return ''
    provenance[s] = {'namespace': result[1], 'key': result[2], 'zh': result[0]}
    return result[0]
def text(entry, field, language='zh'):
    raw = entry.get('TypeTextData', {}).get('Texts', {}).get('(TagName="SW.TextEntry.'+field+'")', {}).get('Text', '')
    match = re.search(r'LOCTABLE\("([^"]+)", "([^"]+)"\)', raw)
    if not match:
        return raw
    ns, key = 'Text/Release/'+match[1], match[2]
    return (zh if language == 'zh' else en).get(ns, {}).get(key, '')
def table(name):
    path = NATIVE / 'exports/tools-mechanism/Dungeons/Content/Spicewood/Core/DataTables/UFS' / ('DT_'+name+'.json')
    return read(path)

planner = read(REF / 'planner-data.json') if (REF / 'planner-data.json').exists() else {'planner': read(SOURCE / 'planner.json'), 'enchants': read(SOURCE / 'enchants.json'), 'rarity': read(SOURCE / 'rarity.json')}
comparison = read(REF / 'compare-data.json') if (REF / 'compare-data.json').exists() else read(SOURCE / 'compare.json')
collection = read(REF / 'collection-data.json') if (REF / 'collection-data.json').exists() else read(SOURCE / 'collection.json')
for name, data in [('planner', planner['planner']), ('compare', comparison), ('collection', collection)]:
    write(SOURCE / (name+'.json'), data)
write(SOURCE / 'enchants.json', planner['enchants'])
write(SOURCE / 'rarity.json', planner['rarity'])
write(SOURCE / 'capture.json', {'captured_at': '2026-10-10', 'urls': ['https://www.dungeons.tools/2/collection', 'https://www.dungeons.tools/2/build-planner', 'https://www.dungeons.tools/builds', 'https://www.dungeons.tools/2/compare']})

equipment = read(ROOT / 'dist/equipment.json')['items']
by_name = {norm(x['name']): x for x in equipment}
by_id = {x['id']: x for x in equipment}
matches_path = ROOT / 'native-image-matches.json'
if matches_path.exists():
    write(SOURCE / 'native-equipment-matches.json', [{'id': x['id'], 'native': Path(x['native']).name} for x in read(matches_path)])
native_matches = {Path(x['native']).stem: by_id[x['id']] for x in read(SOURCE / 'native-equipment-matches.json')}
pngs = {p.stem: p for folder in ['icons', 'tool-talismans', 'enchantment-textures', 'enchantment-mechanism', 'background-dependency-textures'] for p in (NATIVE / 'exports' / folder).rglob('*.png')}
for p in (NATIVE / 'images').rglob('*.png'):
    pngs.setdefault(p.stem, p)
copied = []
def icon(ref, folder, filename):
    stem = ref.split('.')[-1]
    source = pngs.get(stem)
    if not source:
        raise ValueError('Missing native icon: '+ref)
    target = ROOT / 'dist/images' / folder / (filename+'.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    copied.append({'file': str(target.relative_to(ROOT / 'dist')).replace('\\', '/'), 'native': str(source.relative_to(NATIVE)).replace('\\', '/')})
    return './'+str(target.relative_to(ROOT / 'dist')).replace('\\', '/')

defs = [x for group in ['ItemDefinitionMelee', 'ItemDefinitionRanged', 'ItemDefinitionArmor', 'ItemDefinitionArtifact', 'ItemDefinitionTalisman'] for x in table(group)]
definitions = {norm(text(x, 'Name')): x for x in defs if text(x, 'Name')}
effects_native = {x['TypeTag']['TagName']: x for x in table('EffectDefinition')}
enchantment_table = read(NATIVE / 'exports/tools-enchantments/Dungeons/Content/Spicewood/Core/DataTables/UFS/DT_EnchantmentDefinition.json')
effects_native.update({x['TypeTag']['TagName']: x for x in enchantment_table})
talisman_native = {x['TypeTag']['TagName']: x for x in table('TalismanPropertyDefinition')}
weapons = {x['slug']: x for x in comparison['weapons']}
collect = {x['slug']: x for x in collection['items']}
items = []
equipment_for_slug = {}
for original in planner['planner']['items']:
    item = {k: v for k, v in original.items() if k not in ['href', 'icon']}
    item['english'] = item['name']
    item['name'] = translate(item['name'])
    assert item['name'], item['slug']
    native = definitions.get(norm(item['name']))
    existing = by_name.get(norm(item['name'])) or by_id.get(item['slug'].replace('-', ''))
    if not existing and native:
        existing = native_matches.get(native.get('IconReference', '').split('.')[-1])
    if item['kind'] == 'talisman':
        assert native, item['slug']
        item['image'] = icon(native['IconReference'], 'talismans', item['slug']+'-1')
        prop = talisman_native[native['TypeTag']['TagName']]
        for level in item['levels']:
            n = int(level['level'])
            level['image'] = icon(prop['ItemLevels']['Levels'][n-1]['LevelIconOverride'], 'talismans', item['slug']+'-'+str(n))
            level.pop('icon', None)
    else:
        assert existing, 'No equipment match '+item['slug']+' '+item['name']
        item['image'] = existing['image']
        item['detailURL'] = './data/equipment/items/'+existing['id']+'.json?v=layout2'
    item['description'] = text(native, 'Description') if native else (existing or {}).get('description', '')
    if 'Description' in item['description'] or '描述' == item['description']:
        item['description'] = ''
    item['set'] = translate(item.get('set'))
    item['archetype'] = translate(item.get('archetype')) or {'Fighter': '战士', 'Tank': '坦克', 'Mage': '法师', 'Summoner': '召唤师', 'Ranger': '游侠', 'Healer': '治疗师', 'Trickster': '诡术师'}.get(item.get('archetype'), '')
    item['weight'] = {'heavy': '重型', 'medium': '中型', 'light': '轻型'}.get(item.get('weight'), '')
    item['sources'] = [{'name': translate(s['name']) or {'Blacksmith': '铁匠'}.get(s['name'], '商人'), 'type': s['type'], 'area': translate(s['name']) if s['type'] == 'area' else ''} for s in collect[item['slug']]['sources']]
    if item['slug'] in weapons:
        item['stats'] = {k: weapons[item['slug']][k] for k in ['melee', 'ranged']}
    equipment_for_slug[item['slug']] = existing
    items.append(item)

effects = {}
for tag, original in planner['planner']['effects'].items():
    entry = dict(original)
    native = effects_native.get(tag, {})
    entry['name'] = text(native, 'Name') or translate(original['name']) or {'SW.Effect.SoulGather': '灵魂收集', 'SW.Effect.DropChance': '掉落几率'}.get(tag)
    assert entry['name'], tag
    if original.get('icon'):
        # Existing effect icons were already matched against native textures.
        slug = original['slug']
        candidates = list((ROOT / 'dist/images/effects').glob('*'+slug+'.png'))
        entry['image'] = './images/effects/'+candidates[0].name if candidates else icon(native['IconReference'], 'explorer-effects', slug)
    else:
        entry['image'] = None
    entry.pop('icon', None)
    if entry.get('sum'):
        entry['sum'] = {**entry['sum'], 'template': text(native, 'Description')}
        if not entry['sum']['template']:
            entry['sum']['template'] = translate(original['sum']['template'])
        assert entry['sum']['template'], tag
    entry['template'] = text(native, 'Description')
    effects[tag] = entry
for item in items:
    for e in item['fixed']:
        if e['effect'] not in effects:
            native = effects_native.get(e['effect'], {})
            effects[e['effect']] = {'name': text(native, 'Name') or translate(e['name']), 'slug': e['effect'].split('.')[-1], 'image': icon(native['IconReference'], 'explorer-effects', e['effect'].replace('.', '-')) if native.get('IconReference') not in [None, 'None'] else None, 'category': 'utility', 'sum': None, 'template': text(native, 'Description')}
templates = planner['planner']['templates']
custom_values = {}
for template in table('TalismanEffectTemplateDefinition'):
    effect = template.get('TemplateData', {}).get('Effect', {}).get('TagName')
    value = template.get('TemplateData', {}).get('FixedEffectValue')
    for ability in template.get('Abilities', []):
        for instance in ability.get('InstanceData', []):
            if effect == 'SW.Effect.HealthyStrike':
                custom_values[(effect, value)] = [instance['DamageBoost']*100, instance['HealthThreshold']*100]
            elif effect == 'SW.Effect.FiringEmerald':
                custom_values[(effect, value)] = [(instance['DamageAtCap']-1)*100, instance['EmeraldCap']]
def format_value(value, fmt):
    v = (value + fmt.get('offset', 0))*fmt.get('multiplier', 1)
    if fmt.get('percent'):
        v *= 100
    return str(round(v, fmt.get('digits', 2))).rstrip('0').rstrip('.') if '.' in str(round(v, fmt.get('digits', 2))) else str(round(v))
def effect_text(e):
    info = effects[e['effect']]
    native = effects_native.get(e['effect'], {})
    t = native.get('TypeTextData', {}).get('Texts', {}).get('(TagName="SW.TextEntry.Description")', {})
    fmt = (t.get('ValuesToGet') or [{}])[0].get('FormattingData', {})
    if (e['effect'], e.get('value')) in custom_values:
        result = info['template']
        for n, value in enumerate(custom_values[(e['effect'], e['value'])]):
            formatting = t['ValuesToGet'][n]['FormattingData']
            rendered = f'{value:.2f}'.rstrip('0').rstrip('.') + ('%' if formatting['IsPercentage'] else '')
            result = result.replace('{'+str(n)+'}', rendered)
        return result
    # Match the resolved English game string to its indexed placeholders, then
    # substitute into Chinese; Chinese can deliberately reorder {0} and {1}.
    source = text(native, 'Description', 'en')
    indices = re.findall(r'\{(\d+)\}', source)
    if indices and e.get('text'):
        pattern = re.escape(source)
        for n in set(indices):
            pattern = pattern.replace(r'\{'+n+r'\}', '(?P<v'+n+r'>[\d.,]+%?)')
        match = re.fullmatch(pattern, e['text'], re.IGNORECASE)
        if match:
            translated = info['template']
            for n, value in match.groupdict().items():
                translated = translated.replace('{'+n[1:]+'}', value)
            return translated
    if e.get('value') is not None and '{0}' in info['template']:
        v = (e['value'] + fmt.get('Offset', 0))*fmt.get('Multiplier', 1)
        if fmt.get('IsPercentage'):
            v *= 100
        val = f'{v:.2f}'.rstrip('0').rstrip('.') + ('%' if fmt.get('IsPercentage') else '')
        return info['template'].replace('{0}', val)
    return translate(e.get('text')) or info['template'] or info['name']
for t in templates:
    t['text'] = effect_text(t)
for item in items:
    for e in item['fixed'] + [e for l in item['levels'] for e in l['effects']]:
        e['name'] = effects[e['effect']]['name']
        e['text'] = effect_text(e)
        if '{' in e['text']:
            existing = equipment_for_slug[item['slug']]
            fixed = (existing or {}).get('fixed_effects', [])
            matched = next((f for f in fixed if f['name'] == e['name']), fixed[0] if len(fixed) == 1 else None)
            if matched and item['slug'] != 'the-darkshard':
                e['text'] = matched['effect']
            elif item['slug'] == 'the-darkshard':
                # This unique is triggered by attacks, not artifact usage.
                e['text'] = '攻击有几率将 5 格内的所有敌人拉向你。'
            else:
                raise ValueError('Unresolved native fixed effect: '+item['slug']+' '+e['effect'])
        e.pop('ref', None)
    if '{' in item.get('description', '') and item['levels']:
        item['description'] = ''  # Values belong to the selected level, not a static I-tier description.

enchants = []
all_rows = {row.get('附魔', row.get('效果', row.get('name'))): row for item in equipment for t in item.get('tables', []) for row in t.get('rows', []) if {l['level'] for l in row.get('levels', [])}.issuperset({'I', 'II', 'III'})}
for original in planner['enchants']:
    original = {**original, 'tiers': [t for t in original['tiers'] if t['tier'] in ['I', 'II', 'III']]}
    entry = {k: v for k, v in original.items() if k not in ['href', 'icon']}
    entry['english'] = entry['name']
    entry['name'] = translate(entry['name'])
    row = all_rows.get(entry['name'])
    assert row, entry['name']
    entry['image'] = row['image']
    entry['description'] = row.get('description', '')
    entry['tiers'] = [{'tier': t['tier'], 'text': next((l.get('effect', '') for l in row['levels'] if l.get('level') == t['tier']), '')} for t in entry['tiers']]
    # Native strings in the existing detail dataset carry the verified tier values.
    if not all(t['text'] for t in entry['tiers']):
        entry['tiers'] = [{'tier': t['tier'], 'text': row['levels'][i].get('text', row['levels'][i].get('effect', ''))} for i, t in enumerate(original['tiers'])]
    assert all(t['text'] for t in entry['tiers']), row
    enchants.append(entry)
write(OUT / 'catalogue.json', {'version': 1, 'items': [{k: v for k, v in i.items() if k not in ['pool', 'fixed', 'levels', 'stats', 'tags', 'rarities']} for i in items]})
write(OUT / 'loadouts.json', {i['slug']: {k: i[k] for k in ['pool', 'fixed', 'levels', 'tags', 'rarities']} for i in items})
write(OUT / 'weapons.json', {i['slug']: i['stats'] for i in items if 'stats' in i})
write(OUT / 'rules.json', {'version': 1, 'templates': templates, 'effects': effects, 'enchants': enchants, 'rarity': planner['rarity'], 'power': comparison['power']})
write(SOURCE / 'native-translations.json', provenance)
write(SOURCE / 'native-textures.json', copied)
if (REF / 'public-builds.json').exists():
    write(SOURCE / 'public-builds.json', read(REF / 'public-builds.json'))
if (SOURCE / 'public-builds.json').exists():
    builds = read(SOURCE / 'public-builds.json')
    labels = {'Melee': '近战', 'Ranged': '远程', 'Hybrid': '混合', 'Leveling': '练级', 'Early game': '前期', 'Endgame': '后期', 'Bossing': '首领', 'Farming': '刷取', 'Co-op': '合作', 'Beginner friendly': '新手', 'Fighter': '战士', 'Tank': '坦克', 'Mage': '法师', 'Summoner': '召唤师', 'Trickster': '诡术师', 'Support': '辅助'}
    for build in builds:
        build['author'] = build['tags'][-1]
        build['tags'] = [translate(t) or labels.get(t, t) for t in build['tags'][:-1]]
    write(OUT / 'builds.json', {'captured_at': '2026-10-10', 'builds': builds})
print('Built', len(items), 'items,', len(effects), 'effects,', len(enchants), 'enchantments and', len(copied), 'native texture references')
