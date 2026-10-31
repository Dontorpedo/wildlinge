"""Pixellab: erzeugt Animations-Frames (walk/sleep/eat/attack) fuer die Ganzkoerper-Sprites.
Aufruf: PIXELLAB_API_KEY=... python3 tools/gen-frames.py OUTDIR IDX[,IDX...] [action,...]"""
import os, sys, io, json, time, base64, urllib.request
from PIL import Image

API = 'https://api.pixellab.ai/v2'
KEY = os.environ['PIXELLAB_API_KEY']
ACTIONS = {
    'walk': 'walking forward with small hopping steps, body bobbing up and down',
    'sleep': 'lying down and sleeping, eyes closed, gentle slow breathing',
    'eat': 'head dipping down to eat and coming back up',
    'attack': 'lunging forward to bite and then recoiling back',
    'swim': 'swimming forward, paddling with its legs, body gently rising and sinking',
    'fly': 'flying in place, wings flapping up and down, body hovering',
}
S, CW, CH = 2, 160, 112


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG'); return {'type': 'base64', 'base64': base64.b64encode(b.getvalue()).decode(), 'format': 'png'}


def frame_img(o):
    d = o.get('base64') or o.get('image', {}).get('base64')
    return Image.open(io.BytesIO(base64.b64decode(d.split(',')[-1]))).convert('RGBA')


def run(idx, action, out, frames=8):
    meta = json.load(open('web/assets/whole/whole.json'))[idx]
    at = Image.open('web/assets/whole/whole.png').convert('RGBA')
    cx, cy = (idx % 10) * 96, (idx // 10) * 64
    sp = at.crop((cx, cy, cx + meta['w'], cy + meta['h'])).resize((meta['w'] * S, meta['h'] * S), Image.NEAREST)
    can = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
    can.alpha_composite(sp, ((CW - sp.width) // 2, CH - 8 - sp.height))
    can.save(f'{out}/{idx}_base.png')
    r = call('/animate-pixminimax', {'first_frame': b64(can), 'description': ACTIONS[action], 'frame_count': frames, 'no_background': True, 'direction': 'east', 'view': 'side'})
    jid = r.get('background_job_id') or r.get('id')
    for _ in range(90):
        time.sleep(4)
        j = call('/background-jobs/' + jid)
        if j.get('status') in ('completed', 'failed'):
            break
    if j.get('status') != 'completed':
        print('FAIL', idx, action, json.dumps(j)[:300], flush=True); return
    ims = j['last_response']['images']
    for i, o in enumerate(ims):
        frame_img(o).save(f'{out}/{idx}_{action}_{i}.png')
    print('ok', idx, action, len(ims), 'frames', json.dumps({k: v for k, v in j.items() if k != 'last_response'})[:200])


if __name__ == '__main__':
    from concurrent.futures import ThreadPoolExecutor
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    idxs = [int(x) for x in sys.argv[2].split(',')] if sys.argv[2] != 'all' else range(len(json.load(open('web/assets/whole/whole.json'))))
    acts = sys.argv[3].split(',') if len(sys.argv) > 3 else list(ACTIONS)
    jobs = [(i, a) for i in idxs for a in acts if not os.path.exists(f'{out}/{i}_{a}_8.png')]

    def go(t):
        for k in range(3):
            try:
                run(t[0], t[1], out); return
            except Exception as e:
                print('ERR', t, e, flush=True); time.sleep(5)
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(go, jobs))
    print('done', len(jobs), flush=True)
