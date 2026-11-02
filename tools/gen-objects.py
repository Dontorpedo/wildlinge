"""Pixellab create-image-pixflux: Terrarium-Gegenstaende und Raumdekor.
Aufruf: PIXELLAB_API_KEY=... python3 tools/gen-objects.py OUTDIR [NAME,NAME]"""
import os, sys, io, json, time, base64, urllib.request, urllib.error
from PIL import Image

API = 'https://api.pixellab.ai/v2'
KEY = os.environ['PIXELLAB_API_KEY']
ST = ', cute kawaii pixel art, dark outline, soft shading, single object, game sprite'
# name: (beschreibung, groesse)
OBJ = {}
for i, d in enumerate(['red and white striped beach ball', 'blue ball with yellow stars', 'green tennis style ball', 'pink rubber ball with polka dots', 'orange basketball style ball', 'rainbow swirl bouncy ball']):
    OBJ[f'ball{i}'] = (d, 32)
for i, d in enumerate(['brown teddy bear plush toy', 'white bunny plush toy with long ears', 'yellow duck plush toy', 'pink elephant plush toy', 'blue cat plush toy', 'green dinosaur plush toy']):
    OBJ[f'plush{i}'] = (d, 48)
for i, d in enumerate(['wooden toy block with letter A', 'small toy drum with sticks', 'toy kite with tail', 'spinning top toy', 'toy rubber duck', 'toy xylophone', 'jump rope', 'toy wooden train', 'music box', 'paper boat']):
    OBJ[f'toy{i}'] = (d, 48)

PROPS = {
 'garden': ['small oak tree with round green crown', 'flowering bush with pink blossoms', 'colorful flower patch tulips and daisies', 'stone birdbath with water', 'red toadstool mushroom cluster', 'small wooden garden bench', 'hanging lantern on wooden post', 'beehive with tiny bees', 'cute scarecrow', 'wooden watering can', 'stack of mossy stones', 'white picket fence segment'],
 'pond': ['green lily pads with pink lotus flower', 'cattail reeds', 'small wooden rowing boat', 'smooth river stones pile', 'cute stone frog statue', 'blue hydrangea bush', 'fishing rod stuck in ground with bobber', 'duck family nest with eggs'],
 'cave': ['cluster of glowing blue crystals', 'cluster of glowing purple crystals', 'glowing cyan mushrooms', 'cozy campfire with logs', 'stalagmite rock formation', 'cozy hay bed with blanket', 'small open treasure chest with gold', 'wall torch with flame', 'rock pile with glowing gems'],
 'shop': ['wooden workbench with tools', 'brass gears and cogs pile', 'tall standing desk lamp', 'potted houseplant', 'toy chest overflowing with toys', 'round colorful rug', 'wall clock with pendulum', 'tall bookshelf with colorful books', 'cardboard boxes stack', 'small glowing robot toy'],
 'home': ['cozy floor lamp', 'potted fern plant', 'round woven rug', 'small bookshelf', 'framed picture of sun and hills', 'cute pet bed cushion', 'wooden toy shelf with toys']
}
for rk, lst in PROPS.items():
    for i, d in enumerate(lst):
        OBJ[f'p_{rk}{i}'] = (d, 64)


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=240) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{e.code} {e.read()[:400]}')


def gen(out, name, desc, size):
    fn = f'{out}/{name}.png'
    if os.path.exists(fn):
        return
    for k in range(6):
        try:
            r = call('/create-image-pixflux', {'description': desc + ST, 'image_size': {'width': size, 'height': size}, 'no_background': True, 'view': 'side', 'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'medium detail'})
            if 'background_job_id' in r or ('image' not in r and 'id' in r):
                jid = r.get('background_job_id') or r['id']
                for _ in range(60):
                    time.sleep(4)
                    j = call('/background-jobs/' + jid)
                    if j.get('status') in ('completed', 'failed'):
                        r = j; break
            img = r.get('image') or (r.get('last_response') or {}).get('image') or (r.get('result') or {}).get('image')
            if not img:
                raise RuntimeError('no image ' + json.dumps(r)[:300])
            data = base64.b64decode(img['base64'] if isinstance(img, dict) else img)
            if data[:4] != b'\x89PNG':
                # raw rgba
                im = Image.frombytes('RGBA', (size, size), data); im.save(fn)
            else:
                open(fn, 'wb').write(data)
            print('ok', name, flush=True)
            return
        except Exception as e:
            print('retry', name, k, str(e)[:200], flush=True)
            time.sleep(15 * (k + 1))
    print('ERR', name, flush=True)


if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    names = sys.argv[2].split(',') if len(sys.argv) > 2 else list(OBJ)
    for n in names:
        gen(out, n, *OBJ[n])
