"""Import the cooked inventory overview geometry and unchanged original textures.

Usage: python tools/import-native-planner-ui.py [full re-extraction directory]
No screenshots are sampled. Missing runtime brush sizes and material graphs
are explicitly documented as browser adaptations in the output manifest.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys
from native_assets import full_extraction_root

source = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else full_extraction_root()
repo = Path(__file__).resolve().parents[1]
spice = Path('Dungeons/Plugins/SpicewoodUI/Content/Spicewood/UI/Widget/Inventory/PlayerInventory')
ore = Path('Dungeons/Plugins/OreUI/Content/UI')
sources = []


def read(relative):
    path = source / 'ui-complete' / relative
    sources.append({'source': 'ui-complete/' + relative.as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    return json.loads(path.read_text('utf-8'))


def content_slot(objects, name):
    return next(o['Properties'] for o in objects if o.get('Properties', {}).get('Content', {}).get('ObjectName', '').endswith('.' + name + "'"))


def material_values(relative):
    data = read(relative)[0]['CachedExpressionData']
    scalars = {p['Name']: v for p, v in zip(data['RuntimeEntries']['ParameterInfoSet'], data['ScalarValues'])}
    colors = {p['Name']: '#' + v['Hex'] for p, v in zip(data['RuntimeEntries[1]']['ParameterInfoSet'], data['VectorValues'])}
    return {'scalars': scalars, 'colors': colors}


gear = read(spice / 'Overview/W_GearOverviewSlots.json')
inventory = read(spice / 'W_PlayerInventory.json')
equipped = read(spice / 'Slot/W_Inventory_EquippedItemSlot.json')
content = read(spice / 'Slot/W_SlotContent_Base.json')
frame = material_values(ore / 'Button/SlotFrame/M_SlotFrame.json')
selected = material_values(ore / 'Button/SlotFrame/M_UI_Slot_Selected.json')
for name in ['MI_SlotFrame_Equipped_Normal-Base', 'MI_SlotFrame_Equipped_Selected-Base', 'MI_SlotFrame_Equipped_Talisman_Normal-Base']:
    read(ore / ('Button/SlotFrame/GearOverview/' + name + '.json'))
button = read(ore / 'Button/Role/Secondary/MI_Secondary_KBM_Background-Normal-Base.json')[0]['Properties']
button_color = next(v['ParameterValue']['Hex'] for v in button['VectorParameterValues'] if v['ParameterInfo']['Name'] == 'Base Color')
read(spice / 'TotalEffects/W_TotalEffectsPanel.json')
texture = read(ore / 'Button/SlotFrame/T_UI_Slot_Background.json')[0]['Properties']['ImportedSize']
header_style = next(o['Properties'] for o in read(ore / 'Typography/TextStyles/Style_SectionHeader1_Text.json') if o['Name'] == 'Default__Style_SectionHeader1_Text_C')
mapping = {'Melee': 'melee', 'Ranged': 'ranged', 'Helmet': 'helmet', 'Chest': 'chest', 'Legs': 'legs', 'Boots': 'boots',
           **{'Artifact' + str(n): 'a' + str(n) for n in range(1, 4)}, **{'Talisman' + str(n): 't' + str(n) for n in range(1, 4)}}
slots = []
for native, id in mapping.items():
    p = content_slot(gear, 'Slot_' + native)
    slots.append({'id': id, 'nativeWidget': 'Slot_' + native, 'row': p.get('Row', 0), 'column': p.get('Column', 0),
                  'layer': p.get('Layer', 0), 'padding': p['Padding']})
groups = []
for native, name, row, icon in [('Weapon', '武器', 0, 'weapons'), ('Armor', '盔甲', 2, 'armor'), ('Artifact', '法器', 4, 'artifacts'), ('Talisman', '护身符', 6, 'talismans')]:
    p = content_slot(gear, native + 'CategoryHeader')
    groups.append({'name': name, 'row': p.get('Row', 0), 'columnSpan': p['ColumnSpan'], 'headerPadding': p['Padding'],
                   'iconGap': content_slot(gear, native + 'Icon')['Padding']['Right'], 'icon': icon,
                   'slots': [s['id'] for s in sorted(slots, key=lambda s: s['column']) if s['row'] == row + 1]})

assets = {}


def copy(relative, name):
    path = source / 'textures' / relative
    target = repo / 'public/images/native-planner' / (name + '.png')
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    sources.append({'source': 'textures/' + relative.as_posix(), 'file': target.relative_to(repo / 'public').as_posix(),
                    'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    assets[name] = './' + target.relative_to(repo / 'public').as_posix()


copy(ore / 'Button/SlotFrame/T_UI_Slot_Background.png', 'slot-background')
copy(spice / 'Slot/T_UI_Slot_Equipped.png', 'equipped-check')
for name, native in [('melee', 'Melee'), ('ranged', 'Ranged'), ('helmet', 'Helmet'), ('chest', 'Breast'), ('legs', 'Legs'), ('boots', 'Boots'), ('artifact', 'Artifact'), ('talisman', 'Talisman')]:
    copy(spice / ('EmptyCategoryIcons/T_UI_Icon_' + native + '.png'), 'empty-' + name)
for name, native in [('weapons', 'Weapons'), ('armor', 'Shield'), ('artifacts', 'Potion'), ('talismans', 'Talisman')]:
    copy(ore / ('Icons/Categories/T_UI_Icon_Category_' + native + '.png'), name)

icon_transform = next(o['Properties']['RenderTransform']['Scale']['X'] for o in content if o['Name'] == 'IconScaleBox')
metrics = {'textureExtent': texture['X'], 'slotGap': slots[0]['padding']['Right'], 'groupGap': slots[0]['padding']['Bottom'],
           'headerFontSize': header_style['Font']['Size'],
           'headerLineHeight': header_style['LineHeightPercentage'], 'headerColor': '#' + header_style['Color']['Hex'],
           'headerOffset': groups[0]['headerPadding']['Left'], 'contentInset': content_slot(equipped, 'ItemContent')['Padding']['Left'],
           'frameScale': frame['scalars']['Overview Frame Scale'], 'iconScale': icon_transform,
           'selectedColor': selected['colors']['Color'], 'innerColor': frame['colors']['Const Inner Fill Color'],
           'buttonColor': '#' + button_color, 'tooltipPadding': content_slot(inventory, 'CompactTooltip')['Padding']}
layout = {'groups': groups, 'slots': slots, 'metrics': metrics, 'assets': assets}
manifest = {**layout, 'widgets': ['W_PlayerInventory', 'W_GearOverviewSlots', 'W_Inventory_EquippedItemSlot', 'W_SlotContent_Base'],
            'sources': sources, 'adaptation': {
                'geometry': 'Rows, columns, slot/header padding, frame scale and icon scale are copied from cooked exports. A uniform browser scale fits the grid to the available width.',
                'missingRuntimeData': 'Cooked custom lazy-image/button properties omit brush extents, bindings and shader graphs. The unchanged 256px slot texture supplies a browser canonical extent, not a claim about the native runtime brush size.',
                'categories': 'Original category-family icons are used; cooked header lazy-image texture bindings are unavailable.',
                'materials': 'Original slot texture plus browser composition for selection/rarity material layers. Procedural Unreal material shaders cannot be embedded as PNGs.',
                'preview': 'Shared native tooltip importer/assets render the configured equipment. Editing and save controls are web functionality.',
                'playerValues': 'No fabricated item power, player level, XP or Soul Storm state. Page background remains pure black.'}}
(repo / 'public/data/native-planner-ui.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', 'utf-8')
(repo / 'src/features/planner/native-layout.mjs').write_text('// Generated from cooked inventory exports by tools/import-native-planner-ui.py.\nexport const nativePlanner=' + json.dumps(layout, ensure_ascii=False, separators=(',', ':')) + ';\n', 'utf-8')
css = '/* Generated from cooked inventory exports; browser extent is documented in native-planner-ui.json. */\n#planner-panel{\n'
for key, value in metrics.items():
    if key == 'tooltipPadding':
        continue
    suffix = 'px' if key in ['textureExtent', 'slotGap', 'groupGap', 'headerOffset', 'contentInset', 'headerFontSize'] else ''
    css += f' --planner-{key}:{value}{suffix};\n'
css += '}\n'
(repo / 'src/features/planner/native-layout.css').write_text(css, 'utf-8')
print(f'Imported {len(sources)} native inventory sources, {len(slots)} slots and {len(assets)} unchanged PNG assets.')
