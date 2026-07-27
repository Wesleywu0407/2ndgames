#!/usr/bin/env python3
"""Strip mesh/texture payload from character animation GLBs, keeping skeleton + clips.

The Sky Room character loader (js/sky-room/characters/loader.js) only reads
`animations` from animation-library GLBs and disposes the scene, so animation
files only need the node hierarchy (for track name binding) and the animation
samplers. Run from the repository root:

    python3 scripts/characters/strip-chancellor-anims.py [character-dir]

With no argument it processes the Chancellor's clips; pass another character
directory name under assets/models/characters/ (e.g. hour-eater) to process
every anim-*.glb file in that directory instead.
"""
import json
import math
import struct
import sys
from pathlib import Path

CHAR_ROOT = Path(__file__).resolve().parents[2] / 'assets/models/characters'
# Bones allowed to keep a translation track. Everything else is rotation-only
# so the base model's skeleton alone defines the character's proportions.
ROOT_BONES = {'Hips', 'Armature', 'mixamorig:Hips'}
# How far the root may rise or fall, in armature units (x0.01 = metres).
# Looping states must sit still vertically or the body pumps every cycle; a
# one-shot reaction keeps its weight. Library clips can be wild: Leap_of_Faith
# drops 28.8 m (it is a cliff dive) and BeHit_FlyUp launches 2.9 m.
LOOPING_VERTICAL_LIMIT = 20.0
ONE_SHOT_VERTICAL_LIMIT = 120.0
LOOPING_NAME_HINTS = ('anim-idle', 'anim-walk', 'anim-run', 'anim-fly', 'anim-wounded', 'anim-turn')
# Some library clips are authored high above the origin — Leap_of_Faith starts
# 25 m up on a cliff — which parks the whole body far off its capsule. Re-base
# the root when it starts this far from the skeleton's own resting hip height;
# normal crouch/stretch starts (within 0.3 m) are left exactly as authored.
REBASE_THRESHOLD = 30.0


def vertical_limit_for(path):
    name = path.name.lower()
    if any(name.startswith(hint) for hint in LOOPING_NAME_HINTS):
        return LOOPING_VERTICAL_LIMIT
    return ONE_SHOT_VERTICAL_LIMIT
if len(sys.argv) > 1:
    CHAR_DIR = CHAR_ROOT / sys.argv[1]
    FILES = sorted(p.name for p in CHAR_DIR.glob('anim-*.glb'))
else:
    CHAR_DIR = CHAR_ROOT / 'chancellor'
    FILES = ['anim-idle.glb', 'anim-walk.glb', 'anim-run.glb', 'anim-cast.glb', 'anim-fly.glb']


def read_glb(path):
    data = path.read_bytes()
    magic, version, _length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and version == 2, f'{path} is not a GLB v2'
    offset = 12
    gltf, binary = None, b''
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from('<I4s', data, offset)
        chunk = data[offset + 8:offset + 8 + chunk_len]
        if chunk_type == b'JSON':
            gltf = json.loads(chunk.decode('utf-8'))
        elif chunk_type == b'BIN\x00':
            binary = chunk
        offset += 8 + chunk_len
    return gltf, binary


def write_glb(path, gltf, binary):
    payload = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    payload += b' ' * (-len(payload) % 4)
    binary += b'\x00' * (-len(binary) % 4)
    total = 12 + 8 + len(payload) + 8 + len(binary)
    with path.open('wb') as fh:
        fh.write(struct.pack('<4sII', b'glTF', 2, total))
        fh.write(struct.pack('<I4s', len(payload), b'JSON'))
        fh.write(payload)
        fh.write(struct.pack('<I4s', len(binary), b'BIN\x00'))
        fh.write(binary)


def retarget_channels(gltf, binary, vertical_limit=ONE_SHOT_VERTICAL_LIMIT, base_lengths=None):
    """Make generated clips safe to play on the base model's own skeleton.

    Meshy re-rigs the mesh on every animation job, so each clip ships a slightly
    different rest skeleton as one constant translation track per bone. Left
    alone those tracks overwrite the base model's proportions the moment a clip
    plays — the Chancellor's spine chain shrank 9% on his walk.

    Deleting them outright is *not* the fix, though: the re-rigged skeletons also
    differ in bone orientation (the Chancellor's upper legs sit 173 degrees from
    the base rig's), and a clip's rotations are authored against its own frames.
    Strip the offsets and the compensation disappears — the thigh folds backwards
    the moment the walk swings it. Instead keep each bone's authored direction
    and only rescale the offset to the base model's bone length, so every clip
    agrees on proportions while staying posable.

    Root motion is handled separately: gameplay owns XZ, so an authored 2.6 m
    lunge only tears the model off the player capsule and snaps it back. Vertical
    motion is kept, squashed for looping states, and re-based when a clip was
    authored high above the origin.
    """
    dropped_translation = dropped_scale = flattened_roots = normalised = 0
    rebased = 0.0
    rest_heights = {node.get('name'): (node.get('translation') or [0, 0, 0])[1]
                    for node in gltf.get('nodes', [])}
    for animation in gltf.get('animations', []):
        kept = []
        for channel in animation['channels']:
            path_kind = channel['target']['path']
            node_name = gltf['nodes'][channel['target']['node']].get('name', '')
            if path_kind == 'scale':
                dropped_scale += 1
                continue
            if path_kind == 'translation' and node_name not in ROOT_BONES:
                # Keep the authored direction, adopt the base model's bone length.
                target = (base_lengths or {}).get(node_name)
                if target is None:
                    kept.append(channel)
                    continue
                accessor = gltf['accessors'][animation['samplers'][channel['sampler']]['output']]
                view = gltf['bufferViews'][accessor['bufferView']]
                start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
                rescaled = False
                for frame in range(accessor['count']):
                    offset = start + frame * 12
                    x, y, z = struct.unpack_from('<3f', binary, offset)
                    length = math.sqrt(x * x + y * y + z * z)
                    if length <= 1e-6:
                        continue
                    factor = target / length
                    if abs(factor - 1.0) < 1e-4:
                        continue
                    struct.pack_into('<3f', binary, offset, x * factor, y * factor, z * factor)
                    rescaled = True
                if rescaled:
                    normalised += 1
                kept.append(channel)
                continue
            if path_kind == 'translation':
                accessor = gltf['accessors'][animation['samplers'][channel['sampler']]['output']]
                view = gltf['bufferViews'][accessor['bufferView']]
                start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
                base_x, base_z = struct.unpack_from('<f', binary, start)[0], \
                    struct.unpack_from('<f', binary, start + 8)[0]
                base_y = struct.unpack_from('<f', binary, start + 4)[0]
                heights = [struct.unpack_from('<f', binary, start + frame * 12 + 4)[0]
                           for frame in range(accessor['count'])]
                span = max(heights) - min(heights)
                squash = vertical_limit / span if span > vertical_limit else 1.0
                rest_y = rest_heights.get(node_name, base_y)
                shift = rest_y - base_y if abs(base_y - rest_y) > REBASE_THRESHOLD else 0.0
                if shift:
                    rebased = shift
                for frame in range(accessor['count']):
                    offset = start + frame * 12
                    struct.pack_into('<f', binary, offset, base_x)
                    struct.pack_into('<f', binary, offset + 8, base_z)
                    if squash < 1.0 or shift:
                        struct.pack_into('<f', binary, offset + 4,
                                         base_y + shift + (heights[frame] - base_y) * squash)
                flattened_roots += 1
            kept.append(channel)
        animation['channels'] = kept
        used = {channel['sampler'] for channel in kept}
        sampler_remap = {old: new for new, old in enumerate(sorted(used))}
        animation['samplers'] = [animation['samplers'][old] for old in sorted(used)]
        for channel in kept:
            channel['sampler'] = sampler_remap[channel['sampler']]
    return normalised, dropped_scale, flattened_roots, rebased


def base_bone_lengths(directory):
    """Rest bone lengths of the character's own model, keyed by bone name."""
    models = [p for p in directory.glob('*.glb') if not p.name.startswith('anim-')]
    if not models:
        return {}
    gltf, _ = read_glb(models[0])
    lengths = {}
    for node in gltf.get('nodes', []):
        name = node.get('name')
        translation = node.get('translation')
        if not name or not translation:
            continue
        lengths[name] = math.sqrt(sum(component * component for component in translation))
    return lengths


def strip(path, base_lengths=None):
    gltf, binary = read_glb(path)
    binary = bytearray(binary)
    dropped_t, dropped_s, roots, rebased = retarget_channels(
        gltf, binary, vertical_limit_for(path), base_lengths)
    keep_accessors = sorted({
        index
        for animation in gltf.get('animations', [])
        for sampler in animation['samplers']
        for index in (sampler['input'], sampler['output'])
    })
    accessor_remap = {old: new for new, old in enumerate(keep_accessors)}

    new_bin = bytearray()
    new_accessors, new_views = [], []
    for old_index in keep_accessors:
        accessor = dict(gltf['accessors'][old_index])
        view = dict(gltf['bufferViews'][accessor['bufferView']])
        start = view.get('byteOffset', 0)
        chunk = binary[start:start + view['byteLength']]
        new_bin += b'\x00' * (-len(new_bin) % 4)
        new_views.append({'buffer': 0, 'byteOffset': len(new_bin), 'byteLength': len(chunk)})
        new_bin += chunk
        accessor['bufferView'] = len(new_views) - 1
        new_accessors.append(accessor)

    for node in gltf.get('nodes', []):
        node.pop('mesh', None)
        node.pop('skin', None)
    for animation in gltf.get('animations', []):
        for sampler in animation['samplers']:
            sampler['input'] = accessor_remap[sampler['input']]
            sampler['output'] = accessor_remap[sampler['output']]

    for key in ('meshes', 'skins', 'materials', 'textures', 'images', 'samplers'):
        gltf.pop(key, None)
    gltf['accessors'] = new_accessors
    gltf['bufferViews'] = new_views
    gltf['buffers'] = [{'byteLength': len(new_bin)}]

    before = path.stat().st_size
    write_glb(path, gltf, bytes(new_bin))
    print(f'{path.name}: {before / 1e6:.1f} MB -> {path.stat().st_size / 1e6:.2f} MB '
          f'({len(gltf.get("animations", []))} clip(s), '
          f'rescaled {dropped_t} bone offsets, dropped {dropped_s} scale tracks, '
          f'{roots} root track(s) pinned'
          + (f', re-based {rebased * 0.01:+.2f} m' if rebased else '') + ')')


if __name__ == '__main__':
    missing = [name for name in FILES if not (CHAR_DIR / name).exists()]
    if missing:
        sys.exit(f'Missing animation files: {missing}')
    lengths = base_bone_lengths(CHAR_DIR)
    if not lengths:
        print(f'warning: no base model found in {CHAR_DIR}; bone offsets left as authored')
    for name in FILES:
        strip(CHAR_DIR / name, lengths)
