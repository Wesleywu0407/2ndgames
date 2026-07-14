"""Build the Elian Voss game-ready GLB from a local KayKit Mage source.

Run from Blender so the original CC0 archive can stay outside the repository:
  blender --background --python scripts/characters/build-elian-voss.py -- \
    --source /path/to/KayKit/Characters/gltf/Mage.glb
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def script_arguments():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to the original KayKit Mage.glb")
    default_output = Path(__file__).resolve().parents[2] / "assets/models/characters/elian-voss/elian-voss.glb"
    parser.add_argument("--output", default=str(default_output), help="Destination GLB path")
    return parser.parse_args(args)


options = script_arguments()
source = Path(options.source).expanduser().resolve()
output = Path(options.output).expanduser().resolve()
if not source.is_file():
    raise FileNotFoundError(f"KayKit source was not found: {source}")
output.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))

armature = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
armature.name = "Rig_Medium"

for name in ["Mage_Hat", "Mage_Cape"]:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

original = next(iter(bpy.data.materials), None)
if original:
    original.name = "Elian_SkinAtlas"


def material(name, color, metallic=0.0, roughness=0.75, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 2.8
    return mat


cloth = material("Elian_AcademicCloth", (0.055, 0.09, 0.22), roughness=0.82)
light = material("Elian_MemoryLight", (0.72, 0.49, 0.22), metallic=0.18, roughness=0.38, emission=(0.42, 0.16, 0.035))

for name in ["Mage_Body", "Mage_LegLeft", "Mage_LegRight"]:
    obj = bpy.data.objects.get(name)
    if obj:
        obj.name = name.replace("Mage_", "Elian_")
        obj.data.materials.clear()
        obj.data.materials.append(cloth)
for name in ["Mage_ArmLeft", "Mage_ArmRight", "Mage_Head"]:
    obj = bpy.data.objects.get(name)
    if obj:
        obj.name = name.replace("Mage_", "Elian_")


def bone_world(name):
    bone = armature.pose.bones.get(name)
    return armature.matrix_world @ bone.head if bone else Vector((0, 0, 0))


def assign(obj, mat, name, bone=None):
    obj.name = name
    obj.data.materials.append(mat)
    if bone:
        world = obj.matrix_world.copy()
        obj.parent = armature
        obj.parent_type = "BONE"
        obj.parent_bone = bone
        obj.matrix_world = world
    return obj


head = bone_world("head")
chest = bone_world("chest")
hips = bone_world("hips")
right_hand = bone_world("handslot.r")
left_hand = bone_world("handslot.l")

# Academic cap and halo replace the stock mage hat.
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.21, depth=0.075, location=head + Vector((0, 0, 0.27)))
assign(bpy.context.object, cloth, "Elian_AcademicCap", "head")
bpy.ops.mesh.primitive_cube_add(location=head + Vector((0, 0, 0.33)), scale=(0.24, 0.24, 0.026))
cap_top = assign(bpy.context.object, cloth, "Elian_StarChartCap", "head")
cap_top.rotation_euler.z = math.radians(45)
bpy.ops.mesh.primitive_torus_add(major_radius=0.255, minor_radius=0.014, major_segments=24, minor_segments=6, location=head + Vector((0, 0, 0.37)))
assign(bpy.context.object, light, "Elian_MemoryHalo", "head")

# Sandstone-academic collar, belt, and memory pins.
bpy.ops.mesh.primitive_torus_add(major_radius=0.31, minor_radius=0.035, major_segments=24, minor_segments=6, location=chest + Vector((0, 0, 0.08)))
collar = assign(bpy.context.object, light, "Elian_SandstoneCollar", "chest")
collar.scale.y = 0.72
bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.025, major_segments=24, minor_segments=6, location=hips + Vector((0, 0, 0.08)))
belt = assign(bpy.context.object, light, "Elian_RuneBelt", "hips")
belt.scale.y = 0.68
for index, offset in enumerate([(-0.09, -0.18, 0.0), (0.0, -0.2, 0.055), (0.09, -0.18, 0.0)]):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.035, location=chest + Vector(offset))
    assign(bpy.context.object, light, f"Elian_ConstellationPin_{index + 1}", "chest")

# Lantern attached to the right-hand slot.
lantern_center = right_hand + Vector((0, 0, -0.24))
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.105, location=lantern_center)
glow = assign(bpy.context.object, light, "Elian_LanternGlow", "handslot.r")
glow.scale.z = 1.25
for name, offset in [("Elian_LanternTop", 0.14), ("Elian_LanternBase", -0.14)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.135, depth=0.03, location=lantern_center + Vector((0, 0, offset)))
    assign(bpy.context.object, light, name, "handslot.r")
bpy.ops.mesh.primitive_torus_add(major_radius=0.11, minor_radius=0.018, major_segments=20, minor_segments=6, location=lantern_center + Vector((0, 0, 0.23)), rotation=(math.radians(90), 0, 0))
assign(bpy.context.object, light, "Elian_LanternHandle", "handslot.r")

# Broken star chart held in the left hand.
bpy.ops.mesh.primitive_cube_add(location=left_hand + Vector((0, 0, -0.08)), scale=(0.22, 0.035, 0.16))
chart = assign(bpy.context.object, cloth, "Elian_BrokenStarChart", "handslot.l")
chart.rotation_euler = (math.radians(18), 0, math.radians(-12))
for index in range(3):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.022, location=left_hand + Vector((-0.1 + index * 0.1, -0.045, -0.03 + (index % 2) * 0.08)))
    assign(bpy.context.object, light, f"Elian_ChartStar_{index + 1}", "handslot.l")

armature["sky_room_character"] = "elian-voss"
armature["source_asset"] = "KayKit Adventurers Mage"
armature["source_license"] = "CC0-1.0"
armature["redesign"] = "Stock hat/cape removed; academic cap, memory halo, sandstone trim, constellation pins, lantern, and broken star chart added."

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=str(output), export_format="GLB", use_selection=True,
    export_skins=True, export_animations=False, export_yup=True, export_apply=False,
)
print(f"ELIAN_VOSS_OUTPUT={output}")
