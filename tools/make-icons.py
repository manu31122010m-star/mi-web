"""Genera los iconos de cada app a partir de su imagen original (uso: python3 tools/make-icons.py)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
# app: (recorte cuadrado de la cara en la imagen original, color de fondo para el icono adaptable)
APPS = {
    'estudio': ((40, 560, 680, 1200), (35, 43, 53)),
    'focus': ((60, 800, 720, 1460), (12, 14, 14)),
    'gym': ((10, 540, 730, 1260), (36, 43, 51)),
}

for app, (box, bg) in APPS.items():
    d = ROOT / app / 'icons'
    face = Image.open(d / 'logo-original.jpg').convert('RGB').crop(box)
    for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon-32.png', 32)]:
        face.resize((size, size), Image.LANCZOS).save(d / name, optimize=True)
    # Icono adaptable de Android: la cara dentro de la zona segura sobre su color de fondo
    m = Image.new('RGB', (512, 512), bg)
    inner = face.resize((440, 440), Image.LANCZOS)
    m.paste(inner, (36, 36))
    m.save(d / 'maskable-512.png', optimize=True)
    print(app, 'ok')
