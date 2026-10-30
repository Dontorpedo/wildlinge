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
json.dump(out, open(D + 'stamps.json', 'w'))
print({k: len(v) for k, v in out.items()})
