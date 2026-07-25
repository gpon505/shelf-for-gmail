#!/usr/bin/env python3
"""Render Shelf logo concepts (pure Python, no deps).

Shapes are drawn 4x supersampled then box-downsampled. Coordinates are
fractions of the icon size. Shape types:
  ('rrect', inset, radius, color)          rounded square
  ('capsule', x0, y0, x1, y1, r, color)    bar with round caps
  ('circle', cx, cy, r, color)             dot
"""
import os
import struct
import zlib

WHITE = (255, 255, 255)
PAPER = (246, 248, 252)   # Gmail background #F6F8FC
BORDER = (218, 220, 224)  # Google border gray #DADCE0
RED = (217, 48, 37)       # Gmail red #D93025
BLUE = (66, 133, 244)     # Google blue #4285F4
GRED = (234, 67, 53)      # Google red #EA4335
YELLOW = (251, 188, 4)    # Google yellow #FBBC04
GRAY = (95, 99, 104)      # Google gray #5F6368
INK = (32, 33, 36)        # Google ink #202124

CONCEPTS = {
    # A — "Sections, in Google colors": paper card, three capsule bars
    'concept_a': [
        ('rrect', 0.0, 0.22, PAPER),
        ('rrect_border', 0.0, 0.22, 0.03, BORDER),
        ('capsule', 0.26, 0.30, 0.74, 0.30, 0.045, BLUE),
        ('capsule', 0.26, 0.50, 0.74, 0.50, 0.045, GRED),
        ('capsule', 0.26, 0.70, 0.60, 0.70, 0.045, YELLOW),
    ],
    # B — "Envelope, shelved": Gmail-red card, white flap chevron + two bars
    'concept_b': [
        ('rrect', 0.0, 0.22, RED),
        ('capsule', 0.26, 0.30, 0.50, 0.44, 0.042, WHITE),
        ('capsule', 0.50, 0.44, 0.74, 0.30, 0.042, WHITE),
        ('capsule', 0.26, 0.62, 0.74, 0.62, 0.042, WHITE),
        ('capsule', 0.26, 0.78, 0.60, 0.78, 0.042, WHITE),
    ],
    # C — "Bookend": white card, red upright spine, gray items beside it
    'concept_c': [
        ('rrect', 0.0, 0.22, WHITE),
        ('rrect_border', 0.0, 0.22, 0.03, BORDER),
        ('capsule', 0.28, 0.30, 0.28, 0.70, 0.05, RED),
        ('capsule', 0.44, 0.32, 0.74, 0.32, 0.042, GRAY),
        ('capsule', 0.44, 0.50, 0.74, 0.50, 0.042, GRAY),
        ('capsule', 0.44, 0.68, 0.64, 0.68, 0.042, GRAY),
    ],
    # D — "Sections + note": ink card, white bars, amber note-dot
    'concept_d': [
        ('rrect', 0.0, 0.22, INK),
        ('capsule', 0.26, 0.31, 0.66, 0.31, 0.045, WHITE),
        ('circle', 0.755, 0.31, 0.048, YELLOW),
        ('capsule', 0.26, 0.51, 0.74, 0.51, 0.045, WHITE),
        ('capsule', 0.26, 0.71, 0.60, 0.71, 0.045, WHITE),
    ],
}


def sd_rrect(x, y, S, inset, radius):
    """True if point inside rounded rect."""
    a = inset * S
    b = S - inset * S
    r = radius * S
    if x < a or x > b or y < a or y > b:
        return False
    cx = min(max(x, a + r), b - r)
    cy = min(max(y, a + r), b - r)
    if (x < a + r or x > b - r) and (y < a + r or y > b - r):
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    return True


def dist_seg(px, py, x0, y0, x1, y1):
    dx, dy = x1 - x0, y1 - y0
    if dx == 0 and dy == 0:
        return ((px - x0) ** 2 + (py - y0) ** 2) ** 0.5
    t = ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    qx, qy = x0 + t * dx, y0 + t * dy
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5


def render(shapes, size, ss=4):
    S = size * ss
    px = bytearray(S * S * 4)
    for y in range(S):
        for x in range(S):
            cx, cy = x + 0.5, y + 0.5
            color = None
            for sh in shapes:
                kind = sh[0]
                if kind == 'rrect':
                    _, inset, radius, col = sh
                    if sd_rrect(cx, cy, S, inset, radius):
                        color = col
                elif kind == 'rrect_border':
                    _, inset, radius, width, col = sh
                    if sd_rrect(cx, cy, S, inset, radius) and not sd_rrect(
                            cx, cy, S, inset + width, radius - width * 0.6):
                        color = col
                elif kind == 'capsule':
                    _, x0, y0, x1, y1, r, col = sh
                    if dist_seg(cx, cy, x0 * S, y0 * S, x1 * S, y1 * S) <= r * S:
                        color = col
                elif kind == 'circle':
                    _, ccx, ccy, r, col = sh
                    if (cx - ccx * S) ** 2 + (cy - ccy * S) ** 2 <= (r * S) ** 2:
                        color = col
            if color:
                i = (y * S + x) * 4
                px[i], px[i + 1], px[i + 2], px[i + 3] = color[0], color[1], color[2], 255

    out = bytearray(size * size * 4)
    n = ss * ss
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0, 0]
            for dy in range(ss):
                for dx in range(ss):
                    i = ((y * ss + dy) * S + (x * ss + dx)) * 4
                    a = px[i + 3]
                    acc[0] += px[i] * a
                    acc[1] += px[i + 1] * a
                    acc[2] += px[i + 2] * a
                    acc[3] += a
            o = (y * size + x) * 4
            if acc[3]:
                out[o] = acc[0] // acc[3]
                out[o + 1] = acc[1] // acc[3]
                out[o + 2] = acc[2] // acc[3]
            out[o + 3] = acc[3] // n
    return bytes(out)


def write_png(path, size, rgba):
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))
    raw = b''.join(b'\x00' + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n'
                + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9))
                + chunk(b'IEND', b''))


if __name__ == '__main__':
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'logo-concepts')
    os.makedirs(out_dir, exist_ok=True)
    for name, shapes in CONCEPTS.items():
        write_png(os.path.join(out_dir, name + '.png'), 128, render(shapes, 128))
        print(name, 'done')
