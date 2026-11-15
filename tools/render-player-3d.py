"""Render the rigged Exile model to per-frame PNGs for the player spritesheets.

Usage:
  blender -b -P tools/render-player-3d.py -- <src_dir> <out_dir> [sheet|survey] [scale]

sheet  renders every clip in CLIPS for all 8 directions, as two passes per frame:
       <name>_id.png (flat region colors) and <name>_shade.png (lighting only).
       tools/build-player-3d.mjs turns those into colored sprites.
survey renders the lighting pass of each animation file at evenly spaced times
       from one direction, to pick the frame times used in CLIPS.
"""

import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = os.path.abspath(ARGS[0])
OUT = os.path.abspath(ARGS[1])
MODE = ARGS[2] if len(ARGS) > 2 else 'sheet'
SCALE = int(ARGS[3]) if len(ARGS) > 3 else 8

FRAME_W = 64
FRAME_H = 48
GROUND_Y = 46.2
BODY_PX = 40
ELEVATION = math.radians(30)
CAMERA_DISTANCE = 20

DIRECTIONS = [
    ('N', 180), ('NE', 135), ('E', 90), ('SE', 45),
    ('S', 0), ('SW', -45), ('W', -90), ('NW', -135),
]

CLIPS = {
    'idle': {'file': 'walking.fbx', 'times': [0.5], 'flash': []},
    'walk': {'file': 'walking.fbx', 'times': [i / 6 for i in range(6)], 'flash': []},
    'aim': {'file': 'shoot.fbx', 'times': [0.0, 0.43, 0.7], 'flash': [1], 'pitch': [0, 13, -24]},
}

REGION_IDS = {
    'suit': (255, 0, 0),
    'hood': (128, 0, 0),
    'pack': (0, 255, 0),
    'strap': (0, 128, 0),
    'mask': (0, 0, 255),
    'boot': (255, 255, 0),
    'glove': (0, 255, 255),
    'gun': (255, 0, 255),
    'slide': (128, 0, 128),
    'lamp': (255, 128, 0),
    'flash': (255, 255, 255),
}
BODY_REGIONS = ['suit', 'hood', 'pack', 'strap', 'mask', 'boot', 'glove']
PITCH_BONES = [('mixamorig:Spine1', 0.3), ('mixamorig:RightArm', 1.0), ('mixamorig:LeftArm', 1.0)]

SURVEY_FILES = ['walking.fbx', 'walk_pistol.fbx', 'idle.fbx', 'shoot.fbx']
SURVEY_STEPS = 8
SURVEY_YAW = 45

GUN_HAND_BONE = 'mixamorig:RightHand'
HEAD_BONE = 'mixamorig:Head'
LAMP_OFFSET = (0.0, -0.125, 0.125)
LAMP_RADIUS = 0.02


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    scene.render.resolution_x = FRAME_W * SCALE
    scene.render.resolution_y = FRAME_H * SCALE
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Standard'
    scene.render.dither_intensity = 0

    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (0.45, 0.55, 0.65, 1)
    background.inputs['Strength'].default_value = 0.3
    scene.world = world
    return scene


def look_rotation(forward):
    return forward.to_track_quat('-Z', 'Y').to_euler()


def add_camera(scene, units_per_pixel):
    forward = Vector((0, math.cos(ELEVATION), -math.sin(ELEVATION)))
    up = Vector((0, math.sin(ELEVATION), math.cos(ELEVATION)))
    target = up * ((GROUND_Y - FRAME_H / 2) * units_per_pixel)

    data = bpy.data.cameras.new('Camera')
    data.type = 'ORTHO'
    data.ortho_scale = max(FRAME_W, FRAME_H) * units_per_pixel
    data.clip_start = 0.01
    data.clip_end = CAMERA_DISTANCE * 4
    camera = bpy.data.objects.new('Camera', data)
    camera.location = target - forward * CAMERA_DISTANCE
    camera.rotation_euler = look_rotation(forward)
    scene.collection.objects.link(camera)
    scene.camera = camera


def add_sun(scene, name, direction, strength, color):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = strength
    data.color = color
    data.angle = math.radians(1)
    sun = bpy.data.objects.new(name, data)
    sun.rotation_euler = look_rotation(Vector(direction).normalized())
    scene.collection.objects.link(sun)


def add_lights(scene):
    add_sun(scene, 'Key', (0.6, 0.55, -0.7), 3.6, (1.0, 0.96, 0.88))
    add_sun(scene, 'Rim', (-0.7, -0.5, -0.4), 0.9, (0.7, 0.85, 1.0))


def srgb_to_linear(color):
    return tuple(((c / 255 + 0.055) / 1.055) ** 2.4 if c > 10 else c / 255 / 12.92 for c in color)


def make_id_material(region):
    material = bpy.data.materials.new(f'Id_{region}')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value = (*srgb_to_linear(REGION_IDS[region]), 1)
    output = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(emission.outputs['Emission'], output.inputs['Surface'])
    return material


def make_shade_material():
    material = bpy.data.materials.new('Shade')
    material.use_nodes = True
    bsdf = material.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1)
    bsdf.inputs['Roughness'].default_value = 1.0
    return material


def region_of(center):
    x, y, z = center
    if y < 22:
        return 'boot'
    if abs(x) > 31:
        return 'glove'
    if 79 <= y <= 90.5 and z > 11 and abs(x) < 6.5:
        return 'mask'
    if y > 52 and z < (-4.5 if y > 79 else -2.5):
        banded = 5 <= abs(x) <= 8 or 64 <= y <= 67
        return 'strap' if banded else 'pack'
    if y >= 80:
        return 'hood'
    return 'suit'


def import_character(filename, id_materials):
    before = set(bpy.data.objects)
    bpy.ops.wm.fbx_import(filepath=os.path.join(SRC, filename))
    objects = list(set(bpy.data.objects) - before)
    armature = next(obj for obj in objects if obj.type == 'ARMATURE')
    meshes = [obj for obj in objects if obj.type == 'MESH']
    for mesh in meshes:
        mesh.data.materials.clear()
        for region in BODY_REGIONS:
            mesh.data.materials.append(id_materials[region])
        for polygon in mesh.data.polygons:
            polygon.use_smooth = True
            polygon.material_index = BODY_REGIONS.index(region_of(polygon.center))

    pivot = bpy.data.objects.new('Pivot', None)
    bpy.context.scene.collection.objects.link(pivot)
    for obj in objects:
        if obj.parent is None:
            obj.parent = pivot
    return pivot, armature, meshes, objects


def posed_height(meshes):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lo = math.inf
    hi = -math.inf
    for mesh in meshes:
        evaluated = mesh.evaluated_get(depsgraph)
        data = evaluated.to_mesh()
        for vertex in data.vertices:
            z = (evaluated.matrix_world @ vertex.co).z
            lo = min(lo, z)
            hi = max(hi, z)
        evaluated.to_mesh_clear()
    return hi - lo


def add_box(name, size, offset, material, parent):
    mesh = bpy.data.meshes.new(name)
    hx, hy, hz = (s / 2 for s in size)
    vertices = [(x, y, z) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = offset
    obj.parent = parent
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_sphere(name, radius, offset, material, parent):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=radius)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    obj.location = offset
    obj.parent = parent
    return obj


def add_pistol(armature, height_local, id_materials):
    unit = height_local
    root = bpy.data.objects.new('GunRoot', None)
    bpy.context.scene.collection.objects.link(root)
    root.parent = armature
    root.parent_type = 'BONE'
    root.parent_bone = GUN_HAND_BONE

    length = unit * 0.17
    thickness = unit * 0.035
    gun = id_materials['gun']
    parts = [
        root,
        add_box('GunBarrel', (thickness, length, thickness * 1.3), (0, length * 0.35, thickness), gun, root),
        add_box('GunSlide', (thickness * 1.05, length * 0.8, thickness * 0.5), (0, length * 0.35, thickness * 1.8), id_materials['slide'], root),
        add_box('GunGrip', (thickness, thickness * 1.4, length * 0.5), (0, 0, -thickness), gun, root),
    ]
    flash = add_sphere('MuzzleFlash', unit * 0.075, (0, length * 1.05, thickness), id_materials['flash'], root)
    parts.append(flash)
    return flash, parts


def bone_world(armature, bone_name):
    return armature.matrix_world @ armature.pose.bones[bone_name].matrix


def add_headlamp(id_materials):
    return add_sphere('Headlamp', LAMP_RADIUS, (0, 0, 0), id_materials['lamp'], None)


def place_headlamp(lamp, armature, lamp_local):
    bpy.context.view_layer.update()
    lamp.matrix_world = Matrix.Translation(bone_world(armature, HEAD_BONE) @ lamp_local)


def set_time(scene, action, t):
    start, end = action.frame_range
    frame = start + t * (end - start)
    whole = math.floor(frame)
    scene.frame_set(int(whole), subframe=frame - whole)


def pitch_arms(armature, degrees):
    bones = armature.pose.bones
    world = armature.matrix_world.to_3x3()
    left = bones['mixamorig:LeftArm'].head
    right = bones['mixamorig:RightArm'].head
    axis = (right - left).normalized()
    reach = world @ (bones['mixamorig:RightHand'].head - right)
    sign = 1 if (world @ axis).cross(reach).z > 0 else -1
    for name, weight in PITCH_BONES:
        bone = bones[name]
        pivot = bone.head.copy()
        turn = Matrix.Rotation(math.radians(degrees * weight * sign), 4, axis)
        bone.matrix = Matrix.Translation(pivot) @ turn @ Matrix.Translation(-pivot) @ bone.matrix
        bpy.context.view_layer.update()


def render(scene, name, samples):
    scene.cycles.samples = samples
    scene.cycles.pixel_filter_type = 'BOX' if samples == 1 else 'BLACKMAN_HARRIS'
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)


def render_passes(scene, name, surfaces, shade_material, shade_only):
    if not shade_only:
        render(scene, f'{name}_id.png', 1)
    saved = [(data, list(data.materials)) for data in surfaces]
    for data, materials in saved:
        for index in range(len(materials)):
            data.materials[index] = shade_material
    render(scene, f'{name}_shade.png', 16)
    for data, materials in saved:
        for index, material in enumerate(materials):
            data.materials[index] = material


def remove_objects(objects):
    for obj in objects:
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = reset_scene()
    id_materials = {region: make_id_material(region) for region in REGION_IDS}
    shade_material = make_shade_material()
    add_lights(scene)

    jobs = []
    if MODE == 'survey':
        for filename in SURVEY_FILES:
            if os.path.exists(os.path.join(SRC, filename)):
                stem = os.path.splitext(filename)[0]
                times = [i / SURVEY_STEPS for i in range(SURVEY_STEPS)]
                jobs.append((stem, filename, times, [], [], [('X', SURVEY_YAW)]))
    else:
        for clip, spec in CLIPS.items():
            jobs.append((clip, spec['file'], spec['times'], spec['flash'], spec.get('pitch', []), DIRECTIONS))

    height = None
    lamp_local = None
    for clip, filename, times, flash_frames, pitches, directions in jobs:
        pivot, armature, meshes, objects = import_character(filename, id_materials)
        if height is None:
            scene.frame_set(1)
            height = posed_height(meshes)
            add_camera(scene, height * math.cos(ELEVATION) / BODY_PX)
            print(f'[render-player-3d] body height {height:.4f}')
            head = bone_world(armature, HEAD_BONE)
            lamp_local = head.inverted() @ (head.translation + Vector(LAMP_OFFSET))

        flash, gun_parts = add_pistol(armature, height / armature.scale.z, id_materials)
        lamp = add_headlamp(id_materials)
        gun_parts.append(lamp)
        surfaces = [obj.data for obj in meshes + gun_parts if obj.type == 'MESH']
        action = armature.animation_data.action
        animation = armature.animation_data
        slot = getattr(animation, 'action_slot', None)
        for direction, yaw in directions:
            pivot.rotation_euler = (0, 0, math.radians(yaw))
            for index, t in enumerate(times):
                flash.hide_render = index not in flash_frames
                set_time(scene, action, t)
                pitch = pitches[index] if index < len(pitches) else 0
                if pitch:
                    animation.action = None
                    pitch_arms(armature, pitch)
                place_headlamp(lamp, armature, lamp_local)
                render_passes(scene, f'{clip}_{direction}_{index}', surfaces, shade_material, MODE == 'survey')
                if pitch:
                    animation.action = action
                    if slot is not None:
                        animation.action_slot = slot
        remove_objects(objects + gun_parts + [pivot])


main()
