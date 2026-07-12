"""Generate branded PWA PNG icons (gradient rounded square with 'SAT')."""
import os

from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "public", "icons")
os.makedirs(OUT, exist_ok=True)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make(size, pad_ratio=0.0):
    c1, c2 = (91, 140, 255), (124, 92, 255)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGB", (size, size))
    px = grad.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = lerp(c1, c2, t)
    radius = int(size * 0.22)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)

    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", int(size * 0.34))
    except Exception:
        font = ImageFont.load_default()
    text = "SAT"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), text, font=font, fill=(255, 255, 255, 255))
    return img


for s in (192, 512):
    make(s).save(os.path.join(OUT, f"icon-{s}.png"))
    print("wrote", f"icon-{s}.png")
