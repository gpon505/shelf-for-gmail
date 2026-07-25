#!/usr/bin/env python3
"""Generate Shelf extension icons (pure Python, no dependencies).

Final design ("concept A, green"): Gmail paper-white card with a soft
gray border and three round-capped section bars in Google blue, green,
and yellow. Rendered 4x supersampled, box-downsampled per size.
"""
import os
import struct
import zlib

PAPER = (246, 248, 252)   # Gmail background #F6F8FC
BORDER = (218, 220, 224)  # Google border gray #DADCE0
BLUE = (66, 133, 244)     # Google blue #4285F4
GREEN = (52, 168, 83)     # Google green #34A853
YELLOW = (251, 188, 4)    # Google yellow #FBBC04


def shapes_for(size):
    # At 16px, drop the border and thicken bars so they stay legible.
    small = size <= 16
    r = 0.065 if small else 0.045
    shapes = [('rrect', 0.0, 0.22, PAPER)]
    if not small:
        shapes.append(('rrect_border', 0.0, 0.22, 0.03, BORDER))
    shapes += [
        ('capsule', 0.26, 0.30, 0.74, 0.30, r, BLUE),
        ('capsule', 0.26, 0.50, 0.74, 0.50, r, GREEN),
        ('capsule', 0.26, 0.70, 0.60, 0.70, r, YELLOW),
    ]
    return shapes


def sd_rrect(x, y, S, inset, radius):
    a = inset * S
    b = S - inset * S
    r = radius * S
    if x < a or x > b or y < a or y > b:
        return False
    if (x < a + r or x > b - r) and (y < a + r or y > b - r):
        cx = min(max(x, a + r), b - r)
        cy = min(max(y, a + r), b - r)
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
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    for size in (16, 48, 128):
        write_png(os.path.join(out_dir, f'icon{size}.png'), size, render(shapes_for(size), size))
        print(f'icon{size}.png done')
