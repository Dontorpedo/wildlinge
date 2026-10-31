"""Packs the AI-drawn whole-creature sheets (web/assets/whole/src/s*.png) into one atlas + metadata."""
import json, colorsys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CW, CH, COLS = 96, 64, 10
sprites = []
for n in ['s1', 's2', 's3', 's4']:
    a = np.array(Image.open(f'web/assets/whole/src/{n}.png').convert('RGBA'))
    lab, cnt = ndi.label(ndi.binary_dilation(a[:, :, 3] > 40, iterations=2))
    items = []
    for i, sl in enumerate(ndi.find_objects(lab)):
        if (lab[sl] == i + 1).sum() < 40:
            continue
        sub = a[sl].copy()
        sub[lab[sl] != i + 1, 3] = 0
        ys, xs = np.nonzero(sub[:, :, 3] > 0)
        sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        cy = (sl[0].start + sl[0].stop) / 2
        items.append((int(cy // 36), sl[1].start, sub))
    items.sort(key=lambda t: (t[0], t[1]))
    sprites += [t[2] for t in items]

# extra sprites (Pixellab, one file each, tags in the name: xNN_tags.png), appended so old indices stay stable
import glob, os
EXTRA = sorted(glob.glob('web/assets/whole/src/extra/x*.png'))
for f in EXTRA:
    sprites.append(np.array(Image.open(f).convert('RGBA')))
json.dump([os.path.basename(f)[:-4].split('_', 1)[1] for f in EXTRA], open('web/assets/whole/extra-tags.json', 'w'))

def eye(s):
    h, w = s.shape[:2]
    al = s[:, :, 3] > 0
    solid = s[:, :, 3] > 200
    dist = ndi.distance_transform_edt(np.pad(solid, 1))[1:-1, 1:-1]
    mx = s[:, :, :3].max(2).astype(int)
    mn = s[:, :, :3].min(2).astype(int)
    xs = np.arange(w)[None, :].repeat(h, 0)
    for dmin in ((3.0, 2.0, 1.5) if h > 34 else (2.0, 1.5, 1.0)):
        dark = al & (mx < 85) & (dist >= dmin) & (xs > w * 0.4)
        lab, n = ndi.label(dark, structure=np.ones((3, 3)))
        if n:
            break
    if not n:
        return {}
    best, bsz = None, 0
    for k, sl in enumerate(ndi.find_objects(lab), 1):
        bw, bh = sl[1].stop - sl[1].start, sl[0].stop - sl[0].start
        sz = int((lab[sl] == k).sum())
        if sz < 3 or bw > 0.22 * w + 3 or bh > 0.4 * h + 2:
            continue
        if sz < 0.45 * bw * bh or sl[0].start > 0.78 * h:
            continue
        sc = sz + 0.02 * sl[1].start
        if sc > bsz:
            best, bsz = k, sc
    if best is None:
        return {}
    blob = lab == best
    reg = ndi.binary_dilation(blob, iterations=2) & al & ((mx < 85) | (mn > 200))
    ys, xx = np.nonzero(reg | blob)
    ex0, ex1, ey0, ey1 = int(xx.min()), int(xx.max()), int(ys.min()), int(ys.max())
    rowmax = max(int(np.nonzero(al[y])[0].max()) for y in range(ey0, ey1 + 1) if al[y].any())
    if ex1 >= rowmax - 3 or ex1 - ex0 > 9 or ey1 - ey0 > 9:
        return {}
    cx = (ex0 + ex1) // 2
    col = np.nonzero(al[:, max(0, cx - 2):cx + 3].any(1))[0]
    return {'ex0': ex0, 'ex1': ex1, 'ey0': ey0, 'ey1': ey1, 'top': int(col.min()) if len(col) else 0}


rows = (len(sprites) + COLS - 1) // COLS
atlas = np.zeros((rows * CH, COLS * CW, 4), np.uint8)
meta = []
for i, s in enumerate(sprites):
    h, w = s.shape[:2]
    assert w <= CW and h <= CH, (i, w, h)
    cx, cy = (i % COLS) * CW, (i // COLS) * CH
    atlas[cy:cy + h, cx:cx + w] = s
    px = s[s[:, :, 3] > 0][:, :3] / 255.0
    hs = np.array([colorsys.rgb_to_hsv(*p) for p in px])
    wgt = hs[:, 1] * hs[:, 2]
    ang = hs[:, 0] * 2 * np.pi
    dom = (np.degrees(np.arctan2((np.sin(ang) * wgt).sum(), (np.cos(ang) * wgt).sum())) + 360) % 360
    m = {'w': w, 'h': h, 'dom': round(float(dom))}
    m.update(eye(s))
    if 'top' not in m:
        c0 = int(w * 0.6)
        col = np.nonzero((s[:, c0 - 3:c0 + 4, 3] > 0).any(1))[0]
        m['top'] = int(col.min()) if len(col) else 0
    m['hx'] = (m['ex0'] + m['ex1']) // 2 if 'ex0' in m else int(w * 0.68)
    meta.append(m)
Image.fromarray(atlas).save('web/assets/whole/whole.png', optimize=True)
json.dump(meta, open('web/assets/whole/whole.json', 'w'))
print(len(meta), 'sprites', atlas.shape)
