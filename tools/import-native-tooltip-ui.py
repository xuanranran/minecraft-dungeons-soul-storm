"""Import cooked tooltip material values and unchanged UI art/font from the game.

Usage: python tools/import-native-tooltip-ui.py <full re-extraction directory>
Unreal widgets/material shaders are rendered with browser equivalents; this is
not a screenshot skin. Runtime equipment values remain supplied by the site.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys
from fontTools.ttLib import TTFont

source = Path(sys.argv[1]).resolve()
repo = Path(__file__).resolve().parents[1]
widget = Path('ui-complete/Dungeons/Plugins/OreUI/Content/UI/Widget')
records = []
manifest_path = repo / 'public/data/native-tooltip-ui.json'
previous_sources = json.loads(manifest_path.read_text('utf-8')).get('sources', []) if manifest_path.exists() else []


def read(relative):
    path = source / relative
    records.append({'source': relative.as_posix(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    return json.loads(path.read_text(encoding='utf-8'))


def instance_colors(relative):
    obj = read(widget / relative)[0]
    return {v['ParameterInfo']['Name']: '#' + v['ParameterValue']['Hex'] for v in obj['Properties']['VectorParameterValues']}


def material_colors(relative):
    obj = read(widget / relative)[0]['CachedExpressionData']
    return {p['Name']: '#' + v['Hex'] for p, v in zip(obj['RuntimeEntries[1]']['ParameterInfoSet'], obj['VectorValues'])}


header = instance_colors(Path('Tooltip/Modules/MI_UI_ToolTipModule_Equipped.json'))
border = material_colors(Path('Panel/TooltipContentPanel/M_UI_Tooltip_Border.json'))
rarity = instance_colors(Path('Tooltip/Modules/MI_RarityUnique_BG.json'))
level = material_colors(Path('Tooltip/Modules/Components/M_EnchantLevelIndicator.json'))
for relative in ['Tooltip/W_Tooltip.json', 'Panel/W_TooltipContentPanel.json',
                 'Tooltip/Modules/W_TooltipModule_Equipped.json', 'Tooltip/Modules/W_TooltipModule_Enchantment.json',
                 'Tooltip/Modules/Components/W_TooltipModule_EffectEntry.json', 'Tooltip/Modules/W_TooltipModule_Rarity.json']:
    read(widget / relative)
read(Path('ui-complete/Dungeons/Content/Fonts/NewFive.json'))
panel=read(widget / 'Panel/W_TooltipContentPanel.json')
inset=next(o for o in panel if o['Name']=='VerticalBoxSlot_1')['Properties']['Padding']['Left']
blur=next(o for o in panel if o['Name']=='BackgroundBlur')['Properties']['BlurStrength']
panel_material=read(widget / 'Panel/MI_UI_Panel_BG_Framed_Tooltip.json')[0]['Properties']
fill=next(v['ParameterValue'] for v in panel_material['VectorParameterValues'] if v['ParameterInfo']['Name']=='Fill')
upper_panel=read(widget / 'Panel/TooltipContentPanel/MI_UI_Tooltip_UpperPanel.json')[0]['Properties']
notch=next(v['ParameterValue'] for v in upper_panel['ScalarParameterValues'] if v['ParameterInfo']['Name']=='Const_Notch Size')
styles=Path('ui-complete/Dungeons/Plugins/OreUI/Content/UI/Typography/TextStyles')
def font_size(name):
    objects=read(styles / (name+'.json'))
    return next(o for o in objects if o['Name'].startswith('Default__'))['Properties']['Font']['Size']
body_size=font_size('Style_Body_Text')
title_size=font_size('Style_Header4_Text')
section_size=font_size('Style_SectionHeader1_Text')
grade_size=font_size('Custom_Variants/Style_EnchantmentLevelIndicator')

# Preserve cooked Slate slot properties instead of flattening the talisman
# ribbon into the equipment rarity badge. Resolve slots by their content;
# cooked exports can contain multiple objects with the same slot name.
talisman_xp = read(widget / 'Tooltip/Modules/W_TooltipModule_TalismanXPBar.json')
talisman_ribbon = read(widget / 'Tooltip/Modules/W_LevelGradeRibbon.json')
talisman_grade = read(widget / 'Tooltip/Modules/W_LevelGrade.json')
def slot(objects, content):
    return next(o['Properties'] for o in objects
                if o.get('Properties', {}).get('Content', {}).get('ObjectName', '').endswith('.' + content + "'"))

ribbon_slot = slot(talisman_ribbon, 'RibbonSlot')
label_slot = slot(talisman_xp, 'Text_Level')
max_label_slot = slot(talisman_xp, 'Text_Level_1')
talisman_layout = {
    'modulePadding': slot(talisman_xp, 'GridPanel_0')['Padding'],
    'labelPadding': label_slot['Padding'], 'ribbonPadding': ribbon_slot['Padding'],
    'ribbonOverlap': slot(talisman_ribbon, 'SlotBorder')['Padding']['Right'],
    'gradeLayer': slot(talisman_ribbon, 'LevelGrade')['Layer'],
    'gradeTextLayer': slot(talisman_grade, 'LevelTextBlock')['Layer'],
    'ribbonLayer': slot(talisman_xp, 'LevelGradeRibbon')['Layer'],
    'maxLevelNudge': slot(talisman_xp, 'MaxLevelSwitcher')['Nudge'],
    'maxLevelBackgroundPadding': slot(talisman_xp, 'MaxLevelBanner')['Padding'],
    'maxLevelTextPadding': max_label_slot['Padding'],
}
talisman_colors = {}
for name in ['Bronze', 'Silver', 'Gold']:
    talisman_colors[name.lower()] = instance_colors(Path(f'Tooltip/Modules/Talisman/MI_Talisman_LevelIcon_{name}.json'))['Base Color']
talisman_colors['label'] = instance_colors(Path('Tooltip/Modules/Talisman/MI_UI_Ribbon_Tailsman_LevelBanner.json'))['Color']
talisman_colors['max'] = instance_colors(Path('Tooltip/Modules/Talisman/MI_UI_Ribbon_Tailsman_MaxLevelBanner.json'))['Color']
hex_material = read(widget / 'Tooltip/Modules/Talisman/M_Talisman_LevelIcon.json')[0]['CachedExpressionData']
talisman_layout['hexMaterial'] = {p['Name']: v for p, v in zip(hex_material['RuntimeEntries']['ParameterInfoSet'], hex_material['ScalarValues'])}
read(Path('ui-complete/Dungeons/Plugins/OreUI/Content/UI/Materials/M_UI_Ribbon.json'))
tooltip = read(widget / 'Tooltip/W_Tooltip.json')
attachment = slot(tooltip, 'CommonVisualAttachment_0')
talisman_layout['itemAttachment'] = {k: attachment[k] for k in ['Column', 'RowSpan', 'HorizontalAlignment', 'VerticalAlignment']}

tokens = {
    'header': header['ColorFill'], 'header-edge': header['Color Outer Line'],
    'header-shine': header['Color Outer Line Top'], 'panel': border['Base Color'],
    'panel-shine': border['Shine Color'], 'unique': rarity['TagColor'],
    'level-top': level['Top Color'], 'level-bottom': level['Bottom Color'],
}
css = '/* Generated by tools/import-native-tooltip-ui.py from cooked game materials. */\n'
css += '.equipment-tooltip.native-game-tooltip{\n'
css += ''.join(f' --game-tip-{name}:{value};\n' for name, value in tokens.items())
css += f' --game-native-inset:{inset:g}px;\n --game-native-body:{body_size:g}px;\n --game-native-title:{title_size:g}px;\n --game-native-section:{section_size:g}px;\n --game-native-grade:{grade_size:g}px;\n' + '}\n'
css += f'.equipment-tooltip.native-game-tooltip{{\n --game-native-blur:{blur:g}px;\n --game-native-notch:{notch:g}px;\n --game-tip-fill:rgb(0 0 0 / {fill["A"]});\n}}\n'
css += '.equipment-tooltip.native-game-tooltip{\n'
css += ''.join(f' --game-talisman-{name}:{value};\n' for name, value in talisman_colors.items())
for prefix, padding in [('module', talisman_layout['modulePadding']), ('ribbon', talisman_layout['ribbonPadding']),
                        ('label', talisman_layout['labelPadding']), ('max-label', talisman_layout['maxLevelTextPadding'])]:
    css += ''.join(f' --game-talisman-{prefix}-{edge.lower()}:{value:g}px;\n' for edge, value in padding.items())
for name, value in [('overlap', talisman_layout['ribbonOverlap']), ('max-nudge', talisman_layout['maxLevelNudge']['X']),
                    ('max-bg-offset', talisman_layout['maxLevelBackgroundPadding']['Left'])]:
    css += f' --game-talisman-{name}:{value:g}px;\n'
css += f" --game-talisman-hex-scale:{talisman_layout['hexMaterial']['Scale']};\n"
css += f" --game-talisman-grade-layer:{talisman_layout['gradeLayer']};\n --game-talisman-text-layer:{talisman_layout['gradeTextLayer']};\n" + '}\n'
(repo / 'src/ui/styles/game-tooltip-tokens.css').write_text(css, encoding='utf-8')

mask = Path('textures/Dungeons/Plugins/OreUI/Content/UI/Textures/UI_FX/T_UI_Enchant_Icon_Mask.png')
out = repo / 'public/images/native-tooltip/enchant-mask.png'
out.parent.mkdir(parents=True, exist_ok=True)
shutil.copyfile(source / mask, out)
records.append({'source': mask.as_posix(), 'file': out.relative_to(repo / 'public').as_posix(),
                'sha256': hashlib.sha256(out.read_bytes()).hexdigest()})
for name,file in [('T_UI_Icon_Timer','timer'),('T_UI_Icon_Soul_Cost','soul-cost')]:
    relative=Path('textures/Dungeons/Plugins/OreUI/Content/UI/Widget/Tooltip/Modules') / (name+'.png')
    target=out.parent / (file+'.png')
    shutil.copyfile(source / relative,target)
    records.append({'source':relative.as_posix(),'file':target.relative_to(repo / 'public').as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
relative=Path('textures/Dungeons/Plugins/OreUI/Content/UI/Icons/Currency/T_UI_Icon_EnchantmentSwirl.png')
target=out.parent/'enchantment-swirl.png'
shutil.copyfile(source/relative,target)
records.append({'source':relative.as_posix(),'file':target.relative_to(repo/'public').as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
font_source = Path('organized/fonts/Dungeons/Content/Fonts/MinecraftFive.otf')
font_path = repo / 'public/fonts/native-five.woff2'
def package_font(relative, target):
    source_hash = hashlib.sha256((source / relative).read_bytes()).hexdigest()
    # Preserve a previously packaged, unchanged native font. Re-saving merely
    # updates the font header timestamp and needlessly invalidates its URL.
    packaged_hash = hashlib.sha256(target.read_bytes()).hexdigest() if target.exists() else None
    if not any(r.get('source') == relative.as_posix() and r.get('source_sha256') == source_hash and r.get('sha256') == packaged_hash for r in previous_sources):
        font = TTFont(source / relative, recalcTimestamp=False)
        font.flavor = 'woff2'
        font.save(target)
package_font(font_source, font_path)
records.append({'source': font_source.as_posix(), 'file': font_path.relative_to(repo / 'public').as_posix(),
                'source_sha256': hashlib.sha256((source / font_source).read_bytes()).hexdigest(),
                'sha256': hashlib.sha256(font_path.read_bytes()).hexdigest()})
font_source=Path('organized/fonts/Dungeons/Content/Spicewood/Fonts/Spicewood/Font_Spicewood_TenV2_Regular.otf')
font_path=repo / 'public/fonts/native-ten.woff2'
package_font(font_source, font_path)
records.append({'source':font_source.as_posix(),'file':font_path.relative_to(repo / 'public').as_posix(),'source_sha256':hashlib.sha256((source / font_source).read_bytes()).hexdigest(),'sha256':hashlib.sha256(font_path.read_bytes()).hexdigest()})

manifest = {'widget': 'W_Tooltip', 'colors': tokens, 'sources': records,
            'background': {'rendering': 'Procedural UI material, not a complete background texture. Browser composition uses native framed-tooltip Fill alpha, content-panel blur and tooltip-border colors.',
                           'fill': fill, 'blur': blur, 'notch': notch,
                           'textureReferences': []},
            'talisman': {'widget': 'W_TooltipModule_TalismanXPBar', 'colors': talisman_colors, 'layout': talisman_layout,
                         'runtimeDefaults': 'Lazy-image brush size, text-style bindings and material shader graphs are absent from these cooked widget exports. The web hex uses an 80-unit frame and the shared body style; this is a browser adaptation, not an exported bitmap.',
                         'experience': 'No player XP is supplied by catalogue/build data; do not invent an XP fill. Level 3 selects the native max-level banner.'},
            'adaptation': {'nativeContentInset': inset, 'webContentInset': inset * .5, 'scale': .5,
                           'nativeModuleSpacing': 32, 'webModuleSpacing': 16,
                           'rendering': 'CSS equivalents for cooked Unreal materials, with original icon textures and Five/Ten fonts.',
                           'equipmentValues': 'Catalogue/build values only; no invented player level or item power.'}}
(repo / 'public/data/native-tooltip-ui.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(records)} native UI sources, original icons and Five/Ten fonts.')
