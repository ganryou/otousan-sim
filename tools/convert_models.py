# Poly Haven のモデル（assets/models_src/<名前>/<名前>.gltf）をゲーム用の軽い .glb にまとめる
# 使い方: blender.exe -b --factory-startup -P tools/convert_models.py
import bpy, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'models_src')
DST = os.path.join(ROOT, 'assets', 'models'); os.makedirs(DST, exist_ok=True)
MAX_TRIS = {'default': 12000, 'shrub': 40000, 'grass': 20000, 'weed': 12000, 'fern': 12000, 'potted': 25000}
TEX = {'default': 512, 'shrub': 1024, 'grass': 1024, 'potted': 1024}

def kind(name):
    for k in ('shrub', 'grass', 'weed', 'fern', 'potted'):
        if k in name: return k
    return 'default'

for f in sorted(glob.glob(os.path.join(SRC, '*', '*.gltf'))):
    name = os.path.splitext(os.path.basename(f))[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    lim = MAX_TRIS.get(kind(name), MAX_TRIS['default'])
    if tris > lim:
        r = lim / tris
        for o in meshes:
            md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = r
            bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier=md.name)
    after = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    size = TEX.get(kind(name), TEX['default'])
    for im in bpy.data.images:
        if im.size[0] > size: im.scale(size, size)
    out = os.path.join(DST, name + '.glb')
    bpy.ops.object.select_all(action='SELECT')
    try:
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='AUTO', export_jpeg_quality=85)
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
    print('[conv] %-24s tris %6d -> %6d  tex %d  %.1fMB' % (name, tris, after, size, os.path.getsize(out) / 1048576), flush=True)
