#!/usr/bin/env python3
"""Regenerate icons/ — the Shelf mark: dark bars on a sticky-note-yellow tile.

Matches the brand mark used on the popup, landing page, and promo art
(the previous multicolor-bars design predated that mark).
Requires Pillow (macOS system python3 has it; else: pip3 install Pillow).
"""
from PIL import Image, ImageDraw
import os

INK = (32, 33, 36, 255)        # #202124
TILE = (253, 214, 99, 255)     # #fdd663 — saturated enough for tiny sizes

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')


def draw_large(size):
    """Draw at 512 and downscale for crisp edges."""
    S = 512
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=115, fill=TILE)
    bar_h, gap, radius = 46, 34, 23
    widths = [280, 280, 172]
    total = bar_h * 3 + gap * 2
    y = (S - total) // 2
    x = (S - widths[0]) // 2
    for w in widths:
        d.rounded_rectangle([x, y, x + w, y + bar_h], radius=radius, fill=INK)
        y += bar_h + gap
    return img.resize((size, size), Image.LANCZOS)


def draw_16():
    """Hand-tuned at native size — downscaling smears 2px bars."""
    img = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, 15, 15], radius=4, fill=TILE)
    for i, w in enumerate([8, 8, 5]):
        y = 4 + i * 3
        d.rectangle([4, y, 4 + w, y + 1], fill=INK)
    return img


draw_large(128).save(os.path.join(OUT, 'icon128.png'))
draw_large(48).save(os.path.join(OUT, 'icon48.png'))
draw_16().save(os.path.join(OUT, 'icon16.png'))
print('wrote icon128/48/16 to', os.path.abspath(OUT))
