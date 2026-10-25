"""Publica una versión nueva de una app para que le salga el aviso «Actualizar».

Uso:  python3 tools/release.py gym "Nota del cambio" ["Otra nota"...] [--minor|--major]
      python3 tools/release.py all "Nota común"

Sube el número de versión en <app>/version.json, guarda la fecha y las novedades
y renueva el nombre de la caché del service worker (<app>/sw.js).
"""
import json, re, sys, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPS = ['estudio', 'focus', 'gym', 'foco']

def bump(v, part):
    a, b, c = (int(x) for x in v.split('.'))
    return f'{a + 1}.0.0' if part == 'major' else f'{a}.{b + 1}.0' if part == 'minor' else f'{a}.{b}.{c + 1}'

def release(app, notes, part):
    vf = ROOT / app / 'version.json'
    data = json.loads(vf.read_text()) if vf.exists() else {'version': '1.0.0', 'notes': [], 'history': []}
    old = data['version']
    new = bump(old, part)
    history = data.get('history', [])
    history.insert(0, {'version': new, 'date': datetime.date.today().isoformat(), 'notes': notes})
    data = {'version': new, 'date': history[0]['date'], 'notes': notes, 'history': history[:20]}
    vf.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    sw = ROOT / app / 'sw.js'
    s = sw.read_text()
    s = re.sub(r"const CACHE = '[^']*';", f"const CACHE = '{app}-v{new}';", s, count=1)
    sw.write_text(s)
    print(f'{app}: {old} → {new}')

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    part = 'major' if '--major' in sys.argv else 'minor' if '--minor' in sys.argv else 'patch'
    if len(args) < 2:
        sys.exit(__doc__)
    targets = APPS if args[0] == 'all' else [args[0]]
    for app in targets:
        if app not in APPS:
            sys.exit(f'App desconocida: {app}')
        release(app, args[1:], part)
