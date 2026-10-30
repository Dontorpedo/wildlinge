"""Cuts small decoration stamps out of the tile sheets and writes web/assets/tiles/stamps.json (raw RGBA, base64)."""
import base64, json
import numpy as np
from PIL import Image
from scipy import ndimage

D = 'web/assets/tiles/'
SHEETS = {'grass': 32, 'rock': 32, 'sand': 32, 'snow': 32}
out = {}
for n, c in SHEETS.items():
    im = np.array(Image.open(D + n + '.png').convert('RGBA'))
    a = im[:, :, 3] > 128
    k = im.shape[0] // c
    lst = []
    for r in range(k):
        for q in range(k):
            cell = a[r * c:(r + 1) * c, q * c:(q + 1) * c]
            if cell.mean() > 0.5:
                continue
            lab, nl = ndimage.label(ndimage.binary_dilation(cell, iterations=1), structure=np.ones((3, 3)))
            for i in range(1, nl + 1):
                m = (lab == i) & cell
                ys, xs = np.where(m)
                if len(ys) < 8:
                    continue
                w = xs.max() - xs.min() + 1
                h = ys.max() - ys.min() + 1
                if w > 22 or h > 22 or w < 3 or h < 3:
                    continue
                sub = im[r * c:(r + 1) * c, q * c:(q + 1) * c][ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
                sub[~m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]] = 0
                lst.append({'w': int(w), 'h': int(h), 'd': base64.b64encode(sub.tobytes()).decode()})
    out[n] = lst

def half(p):
    h, w = p.shape[0] // 2, p.shape[1] // 2
    o = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            blk = [p[y * 2 + j, x * 2 + i] for j in (0, 1) for i in (0, 1) if p[y * 2 + j, x * 2 + i][3] > 128]
            if len(blk) < 2:
                continue
            lum = [px[0] * 0.3 + px[1] * 0.59 + px[2] * 0.11 for px in blk]
            k = int(np.argmin(lum))
            o[y, x] = blk[k] if lum[k] < 95 else blk[0]
            o[y, x, 3] = 255
    return o

im = np.array(Image.open(D + 'objects.png').convert('RGBA'))
for row, name in enumerate(['tree', 'pine', 'orock', 'bush', 'mush', 'cactus', 'snowtree', 'reed']):
    lst = []
    for q in range(8):
        cell = im[row * 32:(row + 1) * 32, q * 32:(q + 1) * 32]
        ys, xs = np.where(cell[:, :, 3] > 128)
        if not len(ys):
            continue
        sub = half(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy())
        ys, xs = np.where(sub[:, :, 3] > 0)
        if not len(ys):
            continue
        sub = sub[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        lst.append({'w': int(sub.shape[1]), 'h': int(sub.shape[0]), 'd': base64.b64encode(sub.tobytes()).decode()})
    out[name] = lst
json.dump(out, open(D + 'stamps.json', 'w'))
print({k: len(v) for k, v in out.items()})
