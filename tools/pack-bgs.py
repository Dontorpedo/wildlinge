"""Packt Raumhintergruende (tools/gen-bg.py) zu web/assets/whole/bgs.png (400x1000, Reihenfolge home,garden,pond,cave,shop).
Aufruf: python3 tools/pack-bgs.py /tmp/bg"""
import sys
from PIL import Image
src = sys.argv[1]
at = Image.new('RGB', (400, 1000))
for i, n in enumerate(['home', 'garden', 'pond', 'cave', 'shop']):
    im = Image.open(f'{src}/{n}.png').convert('RGB').crop((0, 6, 400, 194)).resize((400, 200), Image.NEAREST)
    at.paste(im, (0, i * 200))
at.quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE).save('web/assets/whole/bgs.png', optimize=True)
