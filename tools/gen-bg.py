"""Pixellab create-image-pixflux: Raumhintergruende 400x200 (werden 2x skaliert).
Aufruf: PIXELLAB_API_KEY=... python3 tools/gen-bg.py OUTDIR [NAME,...]"""
import os, sys, json, time, base64, urllib.request, urllib.error
API = 'https://api.pixellab.ai/v2'; KEY = os.environ['PIXELLAB_API_KEY']
ST = ', side view 2D game background, cute kawaii pixel art, soft colors, no characters, no text, empty flat floor along the bottom fifth'
BG = {
 'home': 'cozy pastel pink living room interior, striped wallpaper, big window with sky, wooden plank floor',
 'garden': 'sunny garden meadow, blue sky with clouds, rolling green hills, flowering bushes, grass floor',
 'pond': 'peaceful riverbank meadow landscape, blue sky with clouds, green hills and trees in the distance, flat green grassy ground across the whole bottom, no water, no pond',
 'cave': 'dark purple underground cave, rock walls with glowing crystals, stalactites, stone floor',
 'shop': 'cozy inventor workshop interior, wooden wall panels, window, pegboard with tools, wooden plank floor',
}
def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=240) as r: return json.load(r)
    except urllib.error.HTTPError as e: raise RuntimeError(f'{e.code} {e.read()[:300]}')
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for n in (sys.argv[2].split(',') if len(sys.argv) > 2 else BG):
    fn = f'{out}/{n}.png'
    if os.path.exists(fn): continue
    for k in range(5):
        try:
            r = call('/create-image-pixflux', {'description': BG[n] + ST, 'image_size': {'width': 400, 'height': 200}, 'view': 'side', 'outline': 'lineless', 'shading': 'medium shading', 'detail': 'medium detail'})
            if 'image' not in r and 'id' in r:
                for _ in range(60):
                    time.sleep(4); j = call('/background-jobs/' + (r.get('background_job_id') or r['id']))
                    if j.get('status') in ('completed', 'failed'): r = j; break
            img = r.get('image') or (r.get('last_response') or {}).get('image')
            open(fn, 'wb').write(base64.b64decode(img['base64'])); print('ok', n, flush=True); break
        except Exception as e:
            print('retry', n, str(e)[:200], flush=True); time.sleep(15 * (k + 1))
