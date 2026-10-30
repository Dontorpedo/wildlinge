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
    meta.append({'w': w, 'h': h, 'dom': round(float(dom))})
Image.fromarray(atlas).save('web/assets/whole/whole.png', optimize=True)
json.dump(meta, open('web/assets/whole/whole.json', 'w'))
print(len(meta), 'sprites', atlas.shape)
