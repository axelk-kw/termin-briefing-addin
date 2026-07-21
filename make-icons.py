"""Erzeugt die Add-in-Icons (indigo Kachel mit weißem Haken) in mehreren Größen.

Nur Standardbibliothek — kein Pillow nötig. Aufruf:  python3 make-icons.py
Schreibt assets/icon-16.png, -32, -64, -80, -128. Logo später frei ersetzbar.
"""
import os
import struct
import zlib

# Markenfarbe (Indigo) wie im Digest — Hintergrund der Kachel
BG = (99, 102, 241, 255)   # #6366f1
FG = (255, 255, 255, 255)  # weißer Haken
SIZES = [16, 32, 64, 80, 128]
HERE = os.path.dirname(os.path.abspath(__file__))


def _blend(bg, fg, a):
    return tuple(round(bg[i] * (1 - a) + fg[i] * a) for i in range(3)) + (255,)


def _disk(px, w, h, cx, cy, r, color):
    """Weiche Kreisscheibe (Anti-Aliasing über Randabstand) stempeln."""
    x0, x1 = max(0, int(cx - r - 1)), min(w, int(cx + r + 2))
    y0, y1 = max(0, int(cy - r - 1)), min(h, int(cy + r + 2))
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) ** 0.5
            a = max(0.0, min(1.0, r - d + 0.5))
            if a > 0:
                px[y][x] = _blend(px[y][x], color, a)


def _thick_line(px, w, h, p0, p1, th, color):
    x0, y0 = p0
    x1, y1 = p1
    steps = max(2, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5) * 2)
    for i in range(steps + 1):
        t = i / steps
        _disk(px, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, th, color)


def make(size):
    w = h = size
    px = [[BG for _ in range(w)] for _ in range(h)]
    th = max(0.9, size / 13.0)  # Strichstärke des Hakens
    # Häkchen in normierten Koordinaten -> auf Größe skalieren
    a = (0.26 * size, 0.52 * size)
    b = (0.44 * size, 0.70 * size)
    c = (0.74 * size, 0.30 * size)
    _thick_line(px, w, h, a, b, th, FG)
    _thick_line(px, w, h, b, c, th, FG)

    raw = bytearray()
    for y in range(h):
        raw.append(0)  # Filter-Typ 0
        for x in range(w):
            raw += bytes(px[y][x])

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data
                + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))

    out = os.path.join(HERE, "assets", f"icon-{size}.png")
    with open(out, "wb") as f:
        f.write(png)
    print(f"  {out}  ({len(png)} Bytes)")


if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "assets"), exist_ok=True)
    print("Icons erzeugen:")
    for s in SIZES:
        make(s)
    print("fertig.")
