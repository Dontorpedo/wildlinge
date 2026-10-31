"""Bereitet Pixellab-Ausgaben auf: entfernt den Bodenschatten, schneidet zu.
Aufruf: python3 tools/prep-extra.py SRC.png DST.png [shadow=1]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def prep(src, dst, shadow=True):
    a = np.array(Image.open(src).convert('RGBA'))
    al = a[:, :, 3] > 127
    a[~al] = 0
    if shadow and al.any():
        ys = np.nonzero(al.any(1))[0]
        y0, y1 = ys.min(), ys.max()
        bottom = {tuple(p) for p in a[y1][al[y1]][:, :3]}
        rgb = a[:, :, :3].astype(int)
        mx, mn = rgb.max(2), rgb.min(2)
        grey = (mx - mn < 45) & (mx < 140) & (mx > 30)
        low = np.zeros_like(al); low[int(y1 - (y1 - y0) * 0.3):, :] = True
        cand = np.zeros_like(al)
        for c in bottom:
            if max(c) - min(c) < 45 and max(c) < 140:
                cand |= (rgb == np.array(c)).all(2)
        cand &= low & grey
        a[cand] = 0
        al = a[:, :, 3] > 0
    lab, n = ndi.label(al, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndi.sum(al, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= max(6, sizes.max() * 0.04)])
        a[~keep] = 0
        al = keep
    ys, xs = np.nonzero(al)
    out = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(out).save(dst)
    return out.shape[1], out.shape[0]


if __name__ == '__main__':
    print(prep(sys.argv[1], sys.argv[2], len(sys.argv) < 4 or sys.argv[3] != '0'))
