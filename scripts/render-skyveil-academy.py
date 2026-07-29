"""Render deterministic inspection views of the SKYVEIL academy GLB in Blender."""

from __future__ import annotations

import math
import os
import sys

import bpy
from mathutils import Vector


def script_args() -> tuple[str, str]:
    argv = sys.argv
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    if len(args) != 2:
        raise SystemExit("usage: blender -b --python scripts/render-skyveil-academy.py -- INPUT.glb OUTPUT_DIR")
    return os.path.abspath(args[0]), os.path.abspath(args[1])


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    corners = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    if not corners:
        raise RuntimeError("GLB contains no mesh bounds")
    return (
        Vector(tuple(min(corner[index] for corner in corners) for index in range(3))),
        Vector(tuple(max(corner[index] for corner in corners) for index in range(3))),
    )


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


input_path, output_dir = script_args()
os.makedirs(output_dir, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=input_path)

model_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
minimum, maximum = world_bounds(model_objects)
centre = (minimum + maximum) * 0.5

root = bpy.data.objects.new("SKYVEIL_Academy_Root", None)
bpy.context.scene.collection.objects.link(root)
for obj in list(bpy.context.scene.objects):
    if obj != root and obj.parent is None:
        obj.parent = root
root.location = Vector((-centre.x, -centre.y, -minimum.z))
bpy.context.view_layer.update()

minimum, maximum = world_bounds(model_objects)
size = maximum - minimum
radius = max(size.x, size.y)
target = Vector((0, 0, size.z * 0.46))

bpy.ops.mesh.primitive_plane_add(size=max(radius * 3.2, 4), location=(0, 0, -0.015))
ground = bpy.context.object
ground.name = "Inspection_Ground"
ground_material = bpy.data.materials.new("Inspection Ground")
ground_material.diffuse_color = (0.055, 0.065, 0.09, 1)
ground_material.roughness = 0.92
ground.data.materials.append(ground_material)

world = bpy.context.scene.world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.018, 0.04, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22

for name, location, energy, colour, area_size in [
    ("Moon key", (-radius, radius, size.z * 1.6), 1300, (0.42, 0.55, 1.0), radius * 0.85),
    ("Warm fill", (radius * 0.8, radius * 0.4, size.z * 0.7), 750, (1.0, 0.55, 0.28), radius * 0.55),
]:
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = colour
    data.shape = "DISK"
    data.size = area_size
    light = bpy.data.objects.new(name, data)
    light.location = location
    bpy.context.scene.collection.objects.link(light)
    light.rotation_euler = (target - light.location).to_track_quat("-Z", "Y").to_euler()

camera_data = bpy.data.cameras.new("Inspection Camera")
camera = bpy.data.objects.new("Inspection Camera", camera_data)
bpy.context.scene.collection.objects.link(camera)
bpy.context.scene.camera = camera
camera_data.lens = 58

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.look = "AgX - Medium High Contrast"

distance = radius * 1.65 + size.z * 0.45
views = {
    "front-positive-y": Vector((0, distance, size.z * 0.48)),
    "front-negative-y": Vector((0, -distance, size.z * 0.48)),
    "side": Vector((distance, 0, size.z * 0.48)),
    "three-quarter": Vector((distance * 0.72, distance * 0.72, size.z * 0.55)),
}

for name, location in views.items():
    camera.location = location
    point_camera(camera, target)
    scene.render.filepath = os.path.join(output_dir, f"{name}.png")
    bpy.ops.render.render(write_still=True)

print(
    "SKYVEIL_RENDER",
    {
        "input": input_path,
        "output": output_dir,
        "mesh_objects": len(model_objects),
        "bounds": [list(minimum), list(maximum)],
        "size": list(size),
    },
)
