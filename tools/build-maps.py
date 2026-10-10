"""Build offline map assets from native exports and captured public point data."""
import hashlib
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT.parent / 'minecraft-dungeons-native-assets'
OUT = ROOT / 'public'
SOURCES = ROOT / 'sources/dungeons-tools'
SOURCES.mkdir(parents=True, exist_ok=True)
enroot = ASSETS / 'exports/map-localization/Dungeons/Content/Localization/All'
en = json.loads((enroot / 'en/All.json').read_text(encoding='utf-8'))
zh = json.loads((enroot / 'zh-Hans/All.json').read_text(encoding='utf-8'))
def normalize(text):
    return re.sub(r'\s+', ' ', text.replace('’', "'")).strip().casefold()
lookup = {}
for namespace, strings in en.items():
    for key, value in strings.items():
        translated = zh.get(namespace, {}).get(key)
        if isinstance(value, str) and translated:
            lookup[normalize(value)] = (translated, namespace, key)
def native(text, fallback=None):
    return lookup.get(normalize(text), (fallback or text, None, None))[0]
exports = list((ASSETS / 'exports/map-textures').rglob('*.png')) + list((ASSETS / 'exports/map-minimaps').rglob('*.png')) + list((ASSETS / 'exports/map-ui').rglob('*.png'))
icons = {}
manifest = []
icon_out = OUT / 'images/map/icons'
icon_out.mkdir(parents=True, exist_ok=True)
def icon(name):
    if name in icons:
        return icons[name]
    candidates = [p for p in exports if p.name == name + '.png']
    if not candidates:
        raise ValueError(f'Missing native map icon: {name}')
    candidates.sort(key=lambda p: ('WorldMap/Icons' not in p.as_posix(), len(p.as_posix())))
    src = candidates[0]
    dst = icon_out / src.name
    shutil.copy2(src, dst)
    icons[name] = './images/map/icons/' + src.name
    manifest.append({'file': dst.relative_to(OUT).as_posix(), 'source': src.relative_to(ASSETS).as_posix(), 'sha256': hashlib.sha256(src.read_bytes()).hexdigest()})
    return icons[name]

category_names = {'station': native('Minecart Stations'), 'quest-core': native('Core Quests'), 'quest-side': native('Side Quests'), 'rematch': '首领再战', 'trader': '商人', 'landmark': '洞穴、塔楼与传送门', 'dungeon': native('Dungeon'), 'rift': native('Rift'), 'talisman': native('Talisman') + '宝箱', 'chest': '宝箱', 'storm': native('Soul Storm'), 'entrance': '其他入口', 'arena': native('Ambush') + '竞技场', 'pot': native('Emeralds') + '罐'}
category_icons = {'station': 'T_UI_Icon_Minecart', 'quest-core': 'T_UI_Icon_CoreQuestGiver', 'quest-side': 'T_UI_Icon_SideQuestGiver', 'rematch': 'T_UI_Icon_QuestGiver', 'trader': 'T_UI_Icon_VillageMerchant', 'landmark': 'T_UI_Icon_SpiderCave', 'dungeon': 'T_UI_Icon_Dungeon_LV2', 'rift': 'T_UI_Icon_Rift', 'talisman': 'T_UI_Icon_Category_Talisman', 'chest': 'T_UI_Icon_Chest', 'storm': 'T_UI_Icon_Storminator', 'entrance': 'T_UI_Icon_Entrance', 'arena': 'T_UI_Icon_Ambush', 'pot': 'T_Emerald_UI'}
dimensions = []
for capture, dimension, title in [('map', 'overworld', 'Overworld'), ('sift', 'sift', 'The Sift'), ('camp', 'camp', 'Camp')]:
    source = SOURCES / (dimension + '.json')
    data = json.loads(source.read_text(encoding='utf-8'))
    region = data['region']
    labels = [{**label, 'english': label['name'], 'name': native(label['name'])} for label in data['labels']]
    markers = []
    for m in data['markers']:
        category = m['cat']
        label = min(labels, key=lambda p: (p['x'] - m['x'])**2 + (p['y'] - m['y'])**2) if labels else None
        translated = None if category == 'chest' else lookup.get(normalize(m['name']))
        generator = category == 'storm' and m['name'] == 'Storm Generator spawn point'
        name = translated[0] if translated else category_names[category]
        if generator:
            name = native('Storm Generator')
        elif m['name'].startswith('Soul Storm: '):
            name = native('Soul Storm') + '：' + native(m['name'].split(': ', 1)[1])
        elif m['name'].startswith('Talisman chest: '):
            name = category_names['talisman'] + '：' + native(m['name'].split(': ', 1)[1])
        elif m['name'] in ['Fancy chest', 'Hidden chest', 'Sift chest']:
            name = {'Fancy chest': '华丽宝箱', 'Hidden chest': '隐藏宝箱', 'Sift chest': native('The Sift') + '宝箱'}[m['name']]
        icon_base = Path(m['icon']).stem
        native_name = {'CoreQuestGiver': 'T_UI_Icon_CoreQuestGiver', 'SideQuestGiver': 'T_UI_Icon_SideQuestGiver', 'soulstorm': 'T_UI_Icon_Storminator', 'talisman': 'T_UI_Icon_Category_Talisman', 'Ambush': 'T_UI_Icon_Ambush'}.get(icon_base, 'T_UI_Icon_' + icon_base)
        if not any(p.name == native_name + '.png' for p in exports):
            native_name = category_icons[category]
        markers.append({'id': m['id'], 'cat': category, 'x': m['x'], 'y': m['y'], 'name': name, 'english': m['name'], 'icon': icon(native_name), 'area': label['name'] if label else native(title), 'generator': generator, 'translation': {'source': 'native' if translated else 'interface', 'namespace': translated[1] if translated else None, 'key': translated[2] if translated else None}})
    pot_occurrences = Counter()
    for x, y in data['pots']:
        pot_occurrences[(x, y)] += 1
        suffix = '' if pot_occurrences[(x, y)] == 1 else '-' + str(pot_occurrences[(x, y)])
        markers.append({'id': f'pot-{x}-{y}' + suffix, 'cat': 'pot', 'x': x, 'y': y, 'name': category_names['pot'], 'english': 'Emerald pot', 'icon': icon(category_icons['pot']), 'area': '', 'generator': False, 'translation': {'source': 'interface'}})
    categories = [{**c, 'label': category_names[c['id']], 'icon': icon(category_icons[c['id']]), 'count': sum(m['cat'] == c['id'] for m in markers)} for c in data['categories']]
    dimensions.append({'id': dimension, 'name': native(title), 'size': region['size'], 'zmax': region['zmax'], 'box': region['box'], 'tileSize': 1024, 'categories': categories, 'markers': markers, 'labels': labels})
    # Preserve original tile pixels at maximum zoom; lower zooms use nearest-neighbor overview images.
    prefix = {'overworld': 'Overworld', 'sift': 'Sift', 'camp': 'Camp'}[dimension]
    tiles = [p for p in exports if p.name.startswith(prefix + '_') and re.fullmatch(prefix + r'_\d\d_\d\d.png', p.name)]
    full = Image.new('RGBA', (region['size'], region['size']))
    for tile in tiles:
        _, y, x = tile.stem.split('_')
        with Image.open(tile) as im:
            full.paste(im, (int(x)*1024, int(y)*1024))
        manifest.append({'native_tile': tile.relative_to(ASSETS).as_posix(), 'sha256': hashlib.sha256(tile.read_bytes()).hexdigest(), 'position': [int(x)*1024, int(y)*1024]})
    for zoom in ([] if '--data-only' in sys.argv else range(2, region['zmax'] + 1)):
        size = round(region['size'] / 2**(region['zmax'] - zoom))
        level = full if size == region['size'] else full.resize((size, size), Image.Resampling.NEAREST)
        for x in range((size+1023)//1024):
            for y in range((size+1023)//1024):
                dst = OUT / f'images/map/{dimension}/{zoom}/{x}/{y}.webp'
                dst.parent.mkdir(parents=True, exist_ok=True)
                level.crop((x*1024, y*1024, (x+1)*1024, (y+1)*1024)).save(dst, lossless=True, method=4)
    print(dimension, len(tiles), 'native tiles;', len(markers), 'map points')

rotation_names = ['Howling Woods', "Singer's Meadow", 'Rainy Plains', 'Humbler Huskland', 'Lullaby Hills', 'Frozen Highlands', 'Honeycomb Fields']
rotation = []
expected = [7, 8, 8, 8, 8, 8, 5]
for english, count in zip(rotation_names, expected):
    name = native(english)
    dimension = next(d for d in dimensions if any(label['name'] == name for label in d['labels']))
    ids = [m['id'] for m in dimension['markers'] if m['generator'] and m['area'] == name]
    assert len(ids) == count, (english, len(ids), count)
    rotation.append({'name': name, 'english': english, 'dimension': dimension['id'], 'generators': ids, 'count': len(ids)})
(OUT / 'maps.json').write_text(json.dumps({'version': 1, 'sources': {'points': 'https://www.dungeons.tools/2/map', 'textures': 'Local Minecraft Dungeons II native BeautyRender exports', 'translations': 'Native en/All.locres and zh-Hans/All.locres, matched by namespace and key'}, 'dimensions': dimensions, 'rotation': rotation}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
# Load only the selected world's points in the browser.
complete = json.loads((OUT / 'maps.json').read_text(encoding='utf-8'))
data_dir = OUT / 'data/maps'
data_dir.mkdir(parents=True, exist_ok=True)
index = {**complete, 'dimensions': []}
for dimension in dimensions:
    (data_dir / (dimension['id'] + '.json')).write_text(json.dumps(dimension['markers'], ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    index['dimensions'].append({**{key: value for key, value in dimension.items() if key != 'markers'}, 'count': len(dimension['markers']), 'data': './data/maps/' + dimension['id'] + '.json?v=layout2'})
(data_dir / 'index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
for tile in (OUT / 'images/map').rglob('*.webp'):
    manifest.append({'file': tile.relative_to(OUT).as_posix(), 'sha256': hashlib.sha256(tile.read_bytes()).hexdigest(), 'format': 'lossless WebP; native pixels retained at maximum zoom'})
(ROOT / 'native-map-images.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(SOURCES / 'README.md').write_text('Map point captures from https://www.dungeons.tools/2/map, /2/map/the-sift and /2/map/camp on 2026-10-10. Only factual point data is retained; website components and page code are not copied. Native map textures and Chinese names are extracted locally. Generator groups use the nearest native area label; all seven totals match the reference rotation (7, 8, 8, 8, 8, 8, 5).\n', encoding='utf-8')
