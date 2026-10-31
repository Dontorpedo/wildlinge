"""Packt ausgewaehlte Anbau-Teile (web/assets/whole/src/parts/KIND_N.png) in parts.png + parts.json."""
import glob, json, os
from PIL import Image
files = sorted(glob.glob('web/assets/whole/src/parts/*.png'))
ims = [(os.path.basename(f)[:-4].rsplit('_', 1)[0], Image.open(f).convert('RGBA')) for f in files]
W = 256; x = y = rowh = 0; pos = []
for k, im in ims:
    if x + im.width > W:
        x = 0; y += rowh + 1; rowh = 0
    pos.append((k, x, y, im.width, im.height)); x += im.width + 1; rowh = max(rowh, im.height)
atlas = Image.new('RGBA', (W, y + rowh + 1), (0, 0, 0, 0))
meta = {}
for (k, im), (_, px, py, w, h) in zip(ims, pos):
    atlas.paste(im, (px, py)); meta.setdefault(k, []).append([px, py, w, h])
atlas.save('web/assets/whole/parts.png', optimize=True)
json.dump(meta, open('web/assets/whole/parts.json', 'w'))
print({k: len(v) for k, v in meta.items()}, atlas.size)
