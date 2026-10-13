"""Resolve the external, unpacked game-data directory for import tools."""
import os
from pathlib import Path


def native_assets_root():
    root = Path(os.environ.get(
        'STORM_NATIVE_ASSETS_DIR',
        'E:/Github Data/minecraft-dungeons-native-assets',
    )).expanduser().resolve()
    if not root.is_dir():
        raise FileNotFoundError(
            f'Unpacked game data not found: {root}. '
            'Set STORM_NATIVE_ASSETS_DIR to its directory.'
        )
    return root


def full_extraction_root():
    return native_assets_root() / 'reextract/2026-10-10-full'
