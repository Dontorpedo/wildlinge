"""Packt Terrarium-Gegenstaende (tools/gen-objects.py) zu web/assets/whole/objs.png + objs.json.
Aufruf: python3 tools/pack-objs.py /tmp/objs"""
import sys, os, json
from PIL import Image
src = sys.argv[1]
names = sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png') and f != 'sheet.png')
ims = {}
for n in names:
    im = Image.open(f'{src}/{n}.png').convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if bb: ims[n] = im.crop(bb)
W = 512; x = y = rowh = 0; pos = {}
for n, im in sorted(ims.items(), key=lambda t: -t[1].height):
    if x + im.width > W: x = 0; y += rowh + 1; rowh = 0
    pos[n] = [x, y, im.width, im.height]; x += im.width + 1; rowh = max(rowh, im.height)
H = y + rowh
at = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for n, im in ims.items(): at.paste(im, tuple(pos[n][:2]))
a = at.quantize(colors=200, method=Image.FASTOCTREE, dither=Image.NONE)
a.save('web/assets/whole/objs.png', optimize=True)
json.dump(pos, open('web/assets/whole/objs.json', 'w'), separators=(',', ':'))
print(len(pos), W, H, os.path.getsize('web/assets/whole/objs.png'))
