"""Packt die Pixellab-Frames (tools/gen-frames.py) in web/assets/whole/anim.png + anim.json.
Aufruf: python3 tools/pack-anim.py FRAMEDIR"""
import sys, json, os
import numpy as np
from PIL import Image

src = sys.argv[1]
ACTS = ['walk', 'sleep', 'eat', 'attack', 'swim', 'fly']
NEED = ['walk', 'sleep', 'eat', 'attack']
NF, S, CW, CH = 8, 2, 160, 112
MX, MT, MB = 8, 6, 3
meta = json.load(open('web/assets/whole/whole.json'))


def down(a):
    h, w = a.shape[0] // 2, a.shape[1] // 2
    blk = a[:h * 2, :w * 2].reshape(h, 2, w, 2, 4).transpose(0, 2, 1, 3, 4).reshape(h, w, 4, 4)
    out = np.zeros((h, w, 4), np.uint8)
    op = blk[..., 3] > 127
    cnt = op.sum(2)
    for y in range(h):
        for x in range(w):
            if cnt[y, x] < 2:
                continue
            px = blk[y, x][op[y, x]]
            vals, c = np.unique(px, axis=0, return_counts=True)
            out[y, x] = vals[c.argmax()]
            out[y, x, 3] = 255
    return out


cells = []
rows = []
for i, m in enumerate(meta):
    w, h = m['w'], m['h']
    aw, ah = w + 2 * MX, h + MT + MB
    have = [all(os.path.exists(f'{src}/{i}_{a}_{k}.png') for k in range(1, NF + 1)) for a in ACTS]
    ok = all(have[ACTS.index(a)] for a in NEED)
    if not ok:
        rows.append(None); continue
    x0, y0 = (CW - w * S) // 2 - MX * S, CH - 8 - h * S - MT * S
    row = Image.new('RGBA', (aw * NF * sum(have), ah), (0, 0, 0, 0))
    slot = -1
    for ai, a in enumerate(ACTS):
        if not have[ai]:
            continue
        slot += 1
        for k in range(1, NF + 1):
            im = Image.open(f'{src}/{i}_{a}_{k}.png').convert('RGBA')
            big = Image.new('RGBA', (aw * S, ah * S), (0, 0, 0, 0))
            big.paste(im.crop((x0, y0, x0 + aw * S, y0 + ah * S)), (0, 0))
            row.paste(Image.fromarray(down(np.array(big))), ((slot * NF + k - 1) * aw, 0))
    rows.append((row, sum(1 << j for j in range(len(ACTS)) if have[j])))
W = 4096
place, x, y, rh = [], 0, 0, 0
for r in rows:
    if r is None:
        place.append(None); continue
    if x + r[0].width > W:
        x = 0; y += rh; rh = 0
    place.append((x, y)); x += r[0].width; rh = max(rh, r[0].height)
H = y + rh
atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
am = []
for i, r in enumerate(rows):
    if r is None:
        am.append(None); continue
    r, mask = r
    x, y = place[i]
    atlas.paste(r, (x, y))
    am.append({'x': x, 'y': y, 'aw': r.width // (NF * bin(mask).count('1')), 'ah': r.height, 'mx': MX, 'mt': MT, 'mb': MB, 'm': mask})
q = atlas.quantize(colors=160, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
q.save('web/assets/whole/anim.png', optimize=True)
json.dump({'acts': ACTS, 'nf': NF, 'sp': am}, open('web/assets/whole/anim.json', 'w'))
print(sum(1 for a in am if a), 'sprites', atlas.size, os.path.getsize('web/assets/whole/anim.png') // 1024, 'KB')
