"""Pixellab generate-with-style-v2: neue Bilder im Stil der vorhandenen Ganzkoerper-Sprites.
Aufruf: PIXELLAB_API_KEY=... python3 tools/gen-style.py OUTDIR NAME "Beschreibung" IDX,IDX,IDX[,IDX]"""
import os, sys, io, json, time, base64, urllib.request, urllib.error
from PIL import Image

API = 'https://api.pixellab.ai/v2'
KEY = os.environ['PIXELLAB_API_KEY']
STYLE = 'cute chubby pixel art critter, side view facing right, dark outline, soft shading, kawaii, small game sprite'


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{e.code} {e.read()[:600]}')


def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return {'type': 'base64', 'base64': base64.b64encode(b.getvalue()).decode(), 'format': 'png'}


def sprite(idx):
    meta = json.load(open('web/assets/whole/whole.json'))[idx]
    at = Image.open('web/assets/whole/whole.png').convert('RGBA')
    cx, cy = (idx % 10) * 96, (idx // 10) * 64
    return at.crop((cx, cy, cx + meta['w'], cy + meta['h']))


def run(out, name, desc, idxs, styles=None):
    ims = styles or [sprite(i) for i in idxs]
    r = call('/generate-with-style-v2', {'style_images': [{'image': b64(i), 'width': i.width, 'height': i.height} for i in ims], 'description': desc, 'style_description': STYLE, 'no_background': True})
    jid = r.get('background_job_id') or r.get('id')
    for _ in range(120):
        time.sleep(5)
        j = call('/background-jobs/' + jid)
        if j.get('status') in ('completed', 'failed'):
            break
    if j.get('status') != 'completed':
        print('FAIL', name, json.dumps(j)[:400], flush=True); return 0
    lr = j['last_response']
    imgs = lr.get('images') or []
    n = 0
    for i, o in enumerate(imgs):
        d = o.get('base64') or (o.get('image') or {}).get('base64')
        Image.open(io.BytesIO(base64.b64decode(d.split(',')[-1]))).convert('RGBA').save(f'{out}/{name}_{i}.png'); n += 1
    print('ok', name, n, json.dumps({k: v for k, v in j.items() if k != 'last_response'})[:300], flush=True)
    return n


if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    run(out, sys.argv[2], sys.argv[3], [int(x) for x in sys.argv[4].split(',')])
