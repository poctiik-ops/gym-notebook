"""Готовит иконки PWA из присланного логотипа (icons/source/logo-original.png).

Логотип нарисован внутри скруглённого квадрата на белом фоне. iOS сама скругляет
углы иконки, поэтому вырезаем квадрат, а белые углы заменяем тёмным фоном того же тона.
Запуск: python3 scripts/logo_from_image.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'icons' / 'source' / 'logo-original.png'
OUT = ROOT / 'icons'

im = Image.open(SRC).convert('RGB')
# Границы тёмного квадрата (найдены по исходнику 1254×1254)
left, top, right, bottom = 84, 76, 1170, 1162
inset = 14  # отступаем от светлой кромки
box = (left + inset, top + inset, right - inset, bottom - inset)
crop = im.crop(box)
size = crop.size[0]

# Фон под углами: вертикальный градиент из цветов самого логотипа
bg = Image.new('RGB', (size, size))
top_c, bot_c = (30, 38, 52), (9, 12, 22)
draw = ImageDraw.Draw(bg)
for y in range(size):
    t = y / (size - 1)
    draw.line([(0, y), (size, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top_c, bot_c)))

# Маска скруглённого квадрата с мягким краем — всё за ней заменяется фоном
mask = Image.new('L', (size, size), 0)
ImageDraw.Draw(mask).rounded_rectangle([6, 6, size - 6, size - 6], radius=int(size * 0.17), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(4))
full = Image.composite(crop, bg, mask)

def save(img, name, px):
    img.resize((px, px), Image.LANCZOS).save(OUT / name, optimize=True)
    print('✓', name)

save(full, 'apple-touch-icon.png', 180)
save(full, 'pwa-192x192.png', 192)
save(full, 'pwa-512x512.png', 512)

# maskable: знак в безопасной зоне (80%) на тёмном фоне
canvas = bg.resize((size, size))
inner = int(size * 0.8)
small = full.resize((inner, inner), Image.LANCZOS)
m2 = Image.new('L', (inner, inner), 0)
ImageDraw.Draw(m2).rounded_rectangle([0, 0, inner, inner], radius=int(inner * 0.2), fill=255)
canvas.paste(small, ((size - inner) // 2, (size - inner) // 2), m2.filter(ImageFilter.GaussianBlur(6)))
save(canvas, 'maskable-512x512.png', 512)

# favicon
save(full, 'favicon-64.png', 64)
