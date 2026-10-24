# 203号室の「跳ね返った光」とマンション外観の「陰影（AO）」を Blender（Cycles）で焼き込む
# 使い方: blender.exe -b --factory-startup -P tools/bake.py
#   入力: assets/bake/bake_in.glb（ゲームの ?debug で EXPORT_BAKE() を実行して書き出す）
#   出力: assets/bake/bake_out.glb（面取り済み・2つ目のUV付き）, bake_day.png, bake_eve.png, bake_ao.png, bake_meta.json
import bpy, os, json, time
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BD = os.path.join(ROOT, 'assets', 'bake')
RES = int(os.environ.get('BAKE_RES', 2048))
RES_AO = int(os.environ.get('BAKE_RES_AO', 4096))
SAMPLES = int(os.environ.get('BAKE_SAMPLES', 160))
BEVEL = float(os.environ.get('BAKE_BEVEL', 0.006))
t0 = time.time()
def log(*a): print('[bake %5.0fs]' % (time.time() - t0), *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(BD, 'bake_in.glb'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'

# GPU が使えれば使う
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
        try:
            prefs.compute_device_type = t
            prefs.get_devices()
        except Exception:
            continue
        devs = [d for d in prefs.devices if d.type == t]
        if devs:
            for d in prefs.devices: d.use = (d.type == t)
            scene.cycles.device = 'GPU'
            log('GPU', t, [d.name for d in devs])
            break
    else:
        log('CPU')
except Exception as e:
    log('device', e)
scene.cycles.samples = SAMPLES
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4

world = bpy.data.worlds.new('W'); scene.world = world
try:
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.0
except Exception:
    world.color = (0, 0, 0)

def join(prefix, name, copy_mats=False):
    objs = [o for o in scene.objects if o.type == 'MESH' and o.name.startswith(prefix)]
    if not objs: return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = name
    if copy_mats:
        for s in ob.material_slots:
            if s.material: s.material = s.material.copy()
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005); bpy.ops.mesh.tris_convert_to_quads()
    bpy.ops.object.mode_set(mode='OBJECT')
    # 角をわずかに丸める（鋭すぎる箱の角をなくす）
    if BEVEL > 0:
        md = ob.modifiers.new('bevel', 'BEVEL'); md.width = BEVEL; md.segments = 2; md.limit_method = 'ANGLE'; md.angle_limit = 0.6
        md.use_clamp_overlap = True
        try: md.harden_normals = True
        except Exception: pass
        bpy.ops.object.modifier_apply(modifier=md.name)
    lm = ob.data.uv_layers.new(name='Lightmap'); ob.data.uv_layers.active = lm
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    try:
        bpy.ops.uv.lightmap_pack(PREF_CONTEXT='ALL_FACES', PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False, PREF_BOX_DIV=12, PREF_MARGIN_DIV=0.25)
    except Exception as e:
        log('lightmap_pack failed', e); bpy.ops.uv.smart_project(island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    log(name, 'faces', len(ob.data.polygons))
    return ob

inside = join('bake|', 'baked')
ext = join('ext|', 'ext', copy_mats=True)

def set_target(ob, img):
    for slot in ob.material_slots:
        m = slot.material
        if m is None: continue
        m.use_nodes = True; nt = m.node_tree
        n = nt.nodes.get('BAKE')
        if n is None:
            n = nt.nodes.new('ShaderNodeTexImage'); n.name = 'BAKE'
            u = nt.nodes.new('ShaderNodeUVMap'); u.uv_map = 'Lightmap'; nt.links.new(u.outputs[0], n.inputs[0])
        n.image = img
        for x in nt.nodes: x.select = False
        n.select = True; nt.nodes.active = n

def conv(p): return Vector((p[0], -p[2], p[1]))
LIGHTS = []
def area(name, pos, d, sx, sy, col, w):
    L = bpy.data.lights.new(name, 'AREA'); L.shape = 'RECTANGLE'; L.size = sx; L.size_y = sy; L.color = col; L.energy = w
    o = bpy.data.objects.new(name, L); scene.collection.objects.link(o)
    o.location = conv(pos); o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(conv(d))
    LIGHTS.append(o)
def point(name, pos, col, w, r=.15):
    L = bpy.data.lights.new(name, 'POINT'); L.color = col; L.energy = w; L.shadow_soft_size = r
    o = bpy.data.objects.new(name, L); scene.collection.objects.link(o); o.location = conv(pos); LIGHTS.append(o)
def clear_lights():
    for o in LIGHTS: bpy.data.objects.remove(o, do_unlink=True)
    LIGHTS.clear()

def denoise_save(img, res, tag, gamma=True, norm=True, fmt='PNG'):
    a = np.array(img.pixels[:], dtype=np.float32).reshape(res, res, 4)[:, :, :3]
    mask = (a.max(axis=2) > 1e-6).astype(np.float32)
    def blur(x):
        for _ in range(2):
            x = (np.roll(x, 1, 0) + np.roll(x, -1, 0) + x) / 3
            x = (np.roll(x, 1, 1) + np.roll(x, -1, 1) + x) / 3
        return x
    num = blur(a * mask[:, :, None]); den = blur(mask)[:, :, None]
    a = np.where(den > 1e-4, num / np.maximum(den, 1e-4), 1.0 if not norm else 0)
    K = 1.0
    if norm:
        p = float(np.percentile(a.max(axis=2)[mask > 0], 99.5)) if mask.sum() > 0 else 1.0
        K = 0.92 / max(p, 1e-6)
    enc = np.clip(a * K, 0, 1)
    if gamma: enc = enc ** (1 / 2.2)
    out = bpy.data.images.new('out_' + tag, res, res, alpha=True); out.colorspace_settings.name = 'Non-Color'
    px = np.ones((res, res, 4), dtype=np.float32); px[:, :, :3] = enc
    out.pixels.foreach_set(px.ravel())
    ext_ = 'jpg' if fmt == 'JPEG' else 'png'
    out.filepath_raw = os.path.join(BD, 'bake_%s.%s' % (tag, ext_)); out.file_format = fmt
    if fmt == 'JPEG': scene.render.image_settings.quality = 92
    out.save()
    log('saved', tag, 'K=%.3f' % K); return K

def bake_inside(tag, setup):
    clear_lights(); setup()
    bpy.ops.object.select_all(action='DESELECT'); inside.select_set(True); bpy.context.view_layer.objects.active = inside
    b = scene.render.bake; b.use_pass_direct = False; b.use_pass_indirect = True; b.use_pass_color = False; b.margin = 8
    log('baking', tag)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'INDIRECT'}, margin=8, use_clear=True)
    return denoise_save(img_in, RES, tag)

def day():
    area('window', (17.8, 4.35, -0.24), (0, 0, -1), 2.0, 1.0, (0.82, 0.88, 1.0), 260)
    area('fusuma', (15.16, 3.85, -7.2), (-1, 0, 0), 1.8, 1.75, (1.0, 0.9, 0.75), 24)
    area('tv', (20.31, 3.635, -1.8), (-1, 0, 0), 0.44, 0.33, (0.55, 0.75, 1.0), 3)
def eve():
    point('ceiling', (18.0, 5.15, -1.8), (0.95, 0.97, 1.0), 70, .2)
    area('window', (17.8, 4.35, -0.24), (0, 0, -1), 2.0, 1.0, (1.0, 0.6, 0.35), 40)
    area('fusuma', (15.16, 3.85, -7.2), (-1, 0, 0), 1.8, 1.75, (1.0, 0.75, 0.5), 30)
    area('tv', (20.31, 3.635, -1.8), (-1, 0, 0), 0.44, 0.33, (0.55, 0.75, 1.0), 3)

meta = {'res': RES, 'samples': SAMPLES}
if inside:
    img_in = bpy.data.images.new('lm', RES, RES, alpha=False, float_buffer=True); img_in.colorspace_settings.name = 'Non-Color'
    set_target(inside, img_in)
    meta['day'] = bake_inside('day', day)
    meta['eve'] = bake_inside('eve', eve)
if ext:
    clear_lights()
    img_ao = bpy.data.images.new('ao', RES_AO, RES_AO, alpha=False, float_buffer=True); img_ao.colorspace_settings.name = 'Non-Color'
    set_target(ext, img_ao)
    bpy.ops.object.select_all(action='DESELECT'); ext.select_set(True); bpy.context.view_layer.objects.active = ext
    scene.world.light_settings.distance = 3.0
    log('baking ao')
    bpy.ops.object.bake(type='AO', margin=8, use_clear=True)
    denoise_save(img_ao, RES_AO, 'ao', gamma=False, norm=False, fmt='JPEG')
with open(os.path.join(BD, 'bake_meta.json'), 'w') as f: json.dump(meta, f)

clear_lights()
keep = [o for o in (inside, ext) if o]
for o in list(scene.objects):
    if o not in keep: bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in keep: o.select_set(True)
kw = dict(filepath=os.path.join(BD, 'bake_out.glb'), export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True, export_materials='EXPORT')
try:
    bpy.ops.export_scene.gltf(**kw, export_image_format='NONE')
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
log('done', meta)
