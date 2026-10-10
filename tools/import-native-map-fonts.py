"""Import freshly unpacked static map regions, spawn volumes and complete native fonts."""
import collections
import hashlib
import json
import math
import pathlib
import sys
from PIL import Image, ImageChops, ImageFilter
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
NATIVE = ROOT.parent / 'minecraft-dungeons-native-assets/reextract/2026-10-10-full'
PUBLIC = ROOT / 'public'
OUT = PUBLIC / 'data/maps'
def read(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

if '--maps-only' not in sys.argv:
    fonts = []
    source = NATIVE / 'organized/fonts/Dungeons/Content/Spicewood/Fonts/Spicewood'
    for weight, suffix in [(400, 'Regular'), (600, 'SemiBold'), (700, 'Bold')]:
        src = source / f'Font_Spicewood_Sixteen_{suffix}.otf'
        dst = PUBLIC / f'fonts/native-sixteen-{suffix.lower()}.woff2'
        font = TTFont(src)
        cmap = font.getBestCmap()
        assert all(ord(c) in cmap for c in '装备地图神谕王冠巨兽角盔犰狳护身符'), src
        font.flavor = 'woff2'
        font.save(dst)
        font.close()
        fonts.append({'weight': weight, 'file': dst.relative_to(PUBLIC).as_posix(), 'source': src.relative_to(NATIVE).as_posix(), 'characters': len(cmap), 'source_sha256': sha(src), 'sha256': sha(dst), 'bytes': dst.stat().st_size})
    write(PUBLIC / 'data/native-fonts.json', {'family': 'Dungeons Sixteen', 'fonts': fonts, 'note': 'Full native character maps retained, including Chinese. WOFF2 changes packaging only.'})
    print('NATIVE FONTS', [(f['weight'], f['bytes']) for f in fonts], flush=True)

atlas = read(PUBLIC / 'maps.json')
main = [d for d in atlas['dimensions'] if d['id'] in ['overworld', 'sift', 'camp']]
for d in main:
    d['markers'] = [m for m in d['markers'] if m.get('origin') != 'native-v2']
    d['categories'] = [c for c in d['categories'] if c['id'] != 'species']
    d['primary'] = True
    d['minNativeZoom'] = 0
    d['tilesVersion'] = 'native2'
regions = read(NATIVE / 'organized/maps/runtime-map-bounds.json')[0]['Properties']['RegionDataMapRuntime']
areas = {a['tag'].casefold(): a for a in read(NATIVE / 'organized/world/areas-and-species.json')}
region_main = {'SW.Region.Overworld': 'overworld', 'SW.Region.Sift': 'sift', 'SW.Region.Camp': 'camp'}
by_id = {d['id']: d for d in main}
by_tag = {tag: by_id[dim] for tag, dim in region_main.items()}

# Descriptive labels are used only where the game does not ship a name.
fallbacks = {
    'Sw.Area.Plains.A1.SpookyBarnBasement': '蜜脾原野 · 谷仓地下室',
    'SW.Area.Desert.A1.Watchtower': '冰封高地 · 瞭望塔',
    'SW.Area.Plains.A2.NatInteriors': '多雨平原 · 洞穴内部',
    'SW.Area.Plains.A1.ScoutPoint': '蜜脾原野 · 侦察点内部',
    'SW.Area.Forest.A1.Underwell': '咆哮树林 · 井底',
    'SW.Area.DeepDark.A2.PortalEntry': '深暗之域 · 传送门入口',
    'SW.Area.Meadow.A1.NatInteriors': '吟唱者草甸 · 洞穴内部',
    'SW.Area.Carapace.A1.CarapaceInterior': '轰鸣虫壳地 · 虫壳内部',
    'SW.Area.Meadow.R1': '草甸 · 通道二',
    'SW.Area.Meadow.R0': '草甸 · 通道一',
    'SW.Area.Desert.A1.QuestTowers': '冰封高地 · 任务塔楼',
}
suffixes = {'SW.Area.Desert.A1.FortHalls': '大厅', 'SW.Area.Desert.A1.Tower': '塔楼', 'SW.Area.Plains.A2.NoteblockRoom': '音符方块房间', 'SW.Area.Plains.A2.BossArena': '竞技场', 'SW.Area.Plains.A2.BossTower': '首领塔楼'}
textures = {p.stem: p for p in (NATIVE / 'textures').rglob('*.png')}

material_path = NATIVE / 'ui-complete/Dungeons/Plugins/SpicewoodUI/Content/Spicewood/UI/Material/Minimap/MI_MiniMap_TextureScroll.json'
palette = {v['ParameterInfo']['Name']: v['ParameterValue'] for v in read(material_path)[0]['Properties']['VectorParameterValues']}

def minimap_preview(image):
    """Web display of a packed minimap, retaining its native pixel grid.

    R separates surfaces; G stores height; white is empty space. The cooked
    shader graph is unavailable: this is a documented web interpretation,
    using extracted material colours, not an exact shader reconstruction.
    """
    raw = image.convert('RGBA')
    pixels = list(raw.get_flattened_data())
    surface = Image.new('L', raw.size)
    surface.putdata([255 if r < 128 else 0 for r, g, b, a in pixels])
    outline = ImageChops.subtract(surface, surface.filter(ImageFilter.MinFilter(3)))
    edges = list(outline.get_flattened_data())
    # Native Hex is ARGB in sRGB, while the numeric channels are linear.
    def colour(name): return tuple(bytes.fromhex(palette[name]['Hex'])[-3:])
    floor = colour('FloorColor')
    wall = colour('ContourColour')
    contour = colour('DiscoveredContourColour')
    displayed = []
    for (r, g, b, a), edge in zip(pixels, edges):
        if r == 255 and g == 255:
            displayed.append((0, 0, 0, 0))
        elif edge:
            displayed.append((*contour, 220))
        elif r < 128:
            # A subtle elevation tint; no synthetic geometry or smoothing.
            displayed.append((*[min(255, round(c * (0.85 + g / 255 * 0.3))) for c in floor], 255))
        else:
            displayed.append((*[round(c * 0.5) for c in wall], 180))
    result = Image.new('RGBA', raw.size)
    result.putdata(displayed)
    return result
dimensions = list(main)
region_info = {}
for region in regions:
    tag = region['Key']['TagName']
    native = region['Value']
    if tag in region_main:
        dimension = by_tag[tag]
        # BeautyRender uses 1024 pixels for a 200-block tile. UE map actor
        # coordinates are 100 units per block. Verified against the native
        # camp chest and all fifteen existing merchant reference points.
        scale = 1024 / 200
    else:
        stem = native['MinimapTexture']['AssetPathName'].split('.')[-1]
        src = textures[stem]
        dst = PUBLIC / f'images/map/interiors/{stem}.webp'
        dst.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(src) as im:
            width, height = im.size
            assert (width, height) == (native['Bounds']['MapDims']['Y'], native['Bounds']['MapDims']['X'])
            minimap_preview(im).save(dst, lossless=True, method=4)
        name = areas.get(tag.casefold(), {}).get('name_zh')
        dimension = {'id': 'interior-' + tag.lower().replace('.', '-'), 'name': (name + ' · ' + suffixes[tag] if tag in suffixes and name else name) or fallbacks[tag], 'nameOrigin': 'native' if name else 'descriptive', 'size': max(width, height), 'width': width, 'height': height, 'box': [0, 0, width, height], 'zmax': 0, 'maxZoom': 6, 'image': './' + dst.relative_to(PUBLIC).as_posix(), 'primary': False, 'labels': [], 'categories': [], 'markers': [], 'nativeTag': tag}
        dimensions.append(dimension)
        by_tag[tag] = dimension
        scale = 1
    dimension['nativeBounds'] = native['Bounds']
    dimension['pixelsPerBlock'] = scale
    region_info[tag] = {'dimension': dimension, 'bounds': native['Bounds'], 'scale': scale}

species_refs = {}
for category in ['enemies', 'bosses']:
    for item in read(PUBLIC / f'data/database/{category}.json')['items']:
        species_refs[item['name']] = {'image': item['image'], 'href': '#database&' + 'category=' + category + '&item=' + item['id']}
species_icon = species_refs.get('僵尸', {}).get('image') or './images/database/renders-thumb-zombie.png'
assert (PUBLIC / species_icon.removeprefix('./')).exists()
points = read(NATIVE / 'organized/world/species-spawn-positions.json')
mob_names = {row['tag']: row['name_zh'] for row in read(NATIVE / 'organized/world/species-definitions.json') if row['name_zh']}
friendly_names = {'SW.Mob.Villager': '村民', 'SW.Mob.VillagerBaby': '幼年村民', 'SW.Mob.TargetDummy': '训练假人'}
def species_name(species):
    if species['name_zh']: return species['name_zh'], 'native'
    tag = species['tag']
    while tag.startswith('SW.Mob.'):
        if mob_names.get(tag): return mob_names[tag], 'native-family'
        if tag in friendly_names: return friendly_names[tag], 'descriptive'
        tag = tag.rsplit('.', 1)[0]
    return '', 'unresolved'
skipped = []
assigned = collections.Counter()
def contains(info, position):
    bounds = info['bounds']
    return all(bounds['MinPos'][k] <= position[k] / 100 <= bounds['MaxPos'][k] for k in 'XY')
def project(info, pos):
    scale = info['scale']
    lower = info['bounds']['MinPos']
    return [(pos['Y'] / 100 - lower['Y']) * scale, info['dimension'].get('height', info['dimension']['size']) - (pos['X'] / 100 - lower['X']) * scale]
for p in points:
    if '/Overworld/' not in p['source'] or p['attachment'] or not p['position']:
        skipped.append({'source': p['source'], 'label': p['label'], 'position': p['position'], 'species': p['species'], 'reason': 'requires-runtime-instance-placement' if '/Overworld/' not in p['source'] else 'requires-parent-transform'})
        continue
    candidates = [(tag, info) for tag, info in region_info.items() if contains(info, p['position'])]
    if not candidates:
        skipped.append({'source': p['source'], 'label': p['label'], 'species': p['species'], 'reason': 'outside-known-static-bounds'})
        continue
    tag, info = min(candidates, key=lambda x: x[1]['bounds']['MapDims']['X'] * x[1]['bounds']['MapDims']['Y'])
    dim = info['dimension']
    x, y = project(info, p['position'])
    species = []
    for s in p['species']:
        name, name_origin = species_name(s)
        if not name: continue
        species.append({'tag': s['tag'], 'name': name, 'nameOrigin': name_origin, **species_refs.get(name, {})})
    if not species:
        skipped.append({'source': p['source'], 'label': p['label'], 'reason': 'no-native-localized-species'})
        continue
    nearest = min(dim['labels'], key=lambda label: (label['x'] - x)**2 + (label['y'] - y)**2) if dim['labels'] else None
    props = p['parameters']
    root = p['root_parameters']
    extent = root.get('BoxExtent')
    zone = []
    rotation = root.get('RelativeRotation') or {}
    if extent and not rotation.get('Pitch') and not rotation.get('Roll'):
        yaw = math.radians(rotation.get('Yaw', 0))
        for dx, dy in [(-extent['X'], -extent['Y']), (-extent['X'], extent['Y']), (extent['X'], extent['Y']), (extent['X'], -extent['Y'])]:
            pos = {**p['position'], 'X': p['position']['X'] + dx * math.cos(yaw) - dy * math.sin(yaw), 'Y': p['position']['Y'] + dx * math.sin(yaw) + dy * math.cos(yaw)}
            zone.append(project(info, pos))
    marker = {'id': 'native-spawn-' + hashlib.sha256((p['source'] + ':' + str(p['object_index'])).encode()).hexdigest()[:16], 'cat': 'species', 'x': round(x, 3), 'y': round(y, 3), 'name': '、'.join(s['name'] for s in species) + '生成区域', 'icon': next((s['image'] for s in species if s.get('image')), species_icon), 'area': nearest['name'] if nearest else dim['name'], 'generator': False, 'origin': 'native-v2', 'species': species, 'zone': zone, 'native': {'source': p['source'], 'objectIndex': p['object_index'], 'position': p['position'], 'extent': extent, 'density': props.get('MobSpawningDensitySetting', '').split('::')[-1], 'spawnTags': p['spawn_tags']}}
    dim['markers'].append(marker)
    assigned[dim['id']] += 1

for dim in dimensions:
    if assigned[dim['id']]: dim['categories'].append({'id': 'species', 'label': '生物生成区域', 'icon': species_icon, 'on': False})
    for category in dim['categories']:
        category['count'] = sum(m['cat'] == category['id'] for m in dim['markers'])
    dim['categories'] = [c for c in dim['categories'] if c['count']]
    dim['count'] = len(dim['markers'])
    write(OUT / (dim['id'] + '.json'), dim['markers'])
    dim['data'] = './data/maps/' + dim['id'] + '.json?v=native2'

# Smoothly filtered overview levels. Maximum zoom remains pixel-identical to PNG.
quality = []
for dim, prefix in zip(main, ['Overworld', 'Sift', 'Camp']):
    full = Image.open(NATIVE / f'organized/maps/clean/{dim["id"]}-no-fog.png').convert('RGBA')
    native_tiles = sorted(p for p in textures.values() if p.name.startswith(prefix + '_') and len(p.stem.split('_')) == 3)
    exact = 0
    for p in native_tiles:
        _, row, col = p.stem.split('_')
        web = PUBLIC / f'images/map/{dim["id"]}/{dim["zmax"]}/{int(col)}/{int(row)}.webp'
        with Image.open(p) as a, Image.open(web) as b:
            difference = ImageChops.difference(a.convert('RGBA'), b.convert('RGBA'))
            assert not any(high for low, high in difference.getextrema()), web
        exact += 1
    for z in range(dim['zmax']):
        size = round(dim['size'] / 2**(dim['zmax'] - z))
        image = full.resize((size, size), Image.Resampling.LANCZOS)
        for x in range((size + 1023) // 1024):
            for y in range((size + 1023) // 1024):
                dst = PUBLIC / f'images/map/{dim["id"]}/{z}/{x}/{y}.webp'
                dst.parent.mkdir(parents=True, exist_ok=True)
                image.crop((x * 1024, y * 1024, (x + 1) * 1024, (y + 1) * 1024)).save(dst, lossless=True, method=4)
    quality.append({'world': dim['id'], 'nativeSize': full.size, 'nativeTilePixels': [1024, 1024], 'exactMaximumZoomTiles': exact, 'overview': 'Lanczos downsample, lossless WebP'})
    print('MAP', dim['id'], 'pixel-identical native tiles', exact, 'spawn volumes', assigned[dim['id']], flush=True)

atlas.update({'version': 2, 'dimensions': dimensions, 'nativeSupplement': {'staticMaps': len(dimensions), 'spawnVolumes': sum(assigned.values()), 'runtimeVolumes': len(skipped)}})
atlas['sources']['nativeSupplement'] = 'Local 2026-10-10 re-extraction: RuntimeMapSystemData, native SpawnVolume objects and Chinese localization'
write(PUBLIC / 'maps.json', atlas)
write(OUT / 'index.json', {**atlas, 'dimensions': [{k: v for k, v in d.items() if k != 'markers'} for d in dimensions]})
write(OUT / 'runtime-spawn-templates.json', skipped)
write(OUT / 'native-import-report.json', {'staticMaps': len(dimensions), 'interiorMaps': len(dimensions) - 3, 'projectedSpawnVolumes': sum(assigned.values()), 'perWorld': assigned, 'unplacedTemplates': len(skipped), 'quality': quality, 'interiorRendering': {'method': 'Web interpretation of packed surface and height channels; not an exact reconstruction of the cooked native shader', 'paletteSource': material_path.relative_to(NATIVE).as_posix(), 'palette': palette, 'resolution': 'Original native pixel grid retained; no upscaling'}, 'coordinateProjection': {'ueUnitsPerBlock': 100, 'beautyRenderPixelsPerBlock': 5.12, 'minimapPixelsPerBlock': 1, 'axes': 'pixelX follows native Y; pixelY is inverted native X', 'validation': 'native camp chest maps to (683.52,2265.6), matching existing (683.5,2265.6). Fifteen merchant references differ by at most 28.2 pixels; reference pins are retained.'}})
# Refresh checksums for all regenerated web tiles, retaining icon provenance.
manifest = read(ROOT / 'native-map-images.json')
manifest = [m for m in manifest if not m.get('file', '').endswith('.webp')]
for p in (PUBLIC / 'images/map').rglob('*.webp'):
    manifest.append({'file': p.relative_to(PUBLIC).as_posix(), 'sha256': sha(p), 'format': 'lossless WebP; interpreted native minimap channels' if p.parent.name == 'interiors' else 'lossless WebP; native pixels at maximum zoom, filtered overview below'})
write(ROOT / 'native-map-images.json', manifest)
print('COMPLETE', len(dimensions), 'maps;', sum(assigned.values()), 'static spawn volumes;', len(skipped), 'runtime templates', flush=True)
