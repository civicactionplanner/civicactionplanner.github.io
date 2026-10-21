#!/usr/bin/env python3
"""Cut Finn's lower jaw and render closed/half/open talking frames.

Recipe: make background transparent; cut the chin polygon out of the base;
fill the hole with dark mouth interior (clipped to the original silhouette);
paste the chin piece back translated down. Closed frame is the original art.
"""
import os
from PIL import Image, ImageDraw, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.abspath(os.path.join(HERE, "../../images/1.png"))

im = Image.open(SRC).convert("RGBA")
w, h = im.size

# white background -> transparent (black outlines stop the flood)
for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 5)]:
    try:
        ImageDraw.floodfill(im, seed, (0, 0, 0, 0), thresh=60)
    except Exception:
        pass

# chin piece: top edge hugs the underside of the lower lip, the rest follows
# just outside the chin outline
JAW = [(343, 402), (400, 362), (460, 322), (515, 288), (550, 266),
       (570, 315), (575, 370), (545, 445), (490, 500), (425, 508),
       (370, 470), (336, 430)]

mask = Image.new("L", (w, h), 0)
ImageDraw.Draw(mask).polygon(JAW, fill=255)

jaw_piece = Image.new("RGBA", (w, h), (0, 0, 0, 0))
jaw_piece.paste(im, (0, 0), mask)

alpha = im.split()[3]
inv = ImageChops.invert(mask)

# base with the chin removed
hole = im.copy()
hole.putalpha(ImageChops.multiply(alpha, inv))

# dark mouth interior: only a band under the lip line, clipped to the silhouette
LIP = [(343, 402), (400, 362), (460, 322), (515, 288), (550, 266)]
BAND = LIP + [(x, y + 34) for (x, y) in reversed(LIP)]
dark = Image.new("RGBA", (w, h), (0, 0, 0, 0))
ImageDraw.Draw(dark).polygon(BAND, fill=(56, 10, 22, 255))
dark.putalpha(ImageChops.multiply(dark.split()[3], alpha))
base_open = Image.alpha_composite(dark, Image.new("RGBA", (w, h), (0, 0, 0, 0)))
base_open = Image.alpha_composite(dark, hole) if False else None
# correct stacking: dark under the holed base? The hole is transparent there, so
# paint dark first, then the holed base, then the moved jaw.
for i, (dx, dy) in enumerate([(0, 0), (0, 12), (0, 26)]):
    if (dx, dy) == (0, 0):
        frame = im.copy()
    else:
        frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        frame = Image.alpha_composite(frame, dark)
        frame = Image.alpha_composite(frame, hole)
        moved = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        moved.paste(jaw_piece, (dx, dy), jaw_piece)
        frame = Image.alpha_composite(frame, moved)
    frame.save(os.path.join(HERE, f"finn_{i}.png"))
    print(f"wrote finn_{i}.png offset ({dx},{dy})")

strip = Image.new("RGBA", (3 * 380, 340), (255, 255, 255, 255))
for i in range(3):
    f = Image.open(os.path.join(HERE, f"finn_{i}.png")).crop((300, 170, 680, 510))
    strip.paste(f, (i * 380, 0), f)
strip.save(os.path.join(HERE, "finn-preview.png"))
print("preview written")
