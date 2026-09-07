"""Turn a supplied brand logo into a tile-ready asset.

Brand logos arrive on a flat ground, usually black or white. Dropping one
straight into a tile brings that ground with it as a visible box, so the ground
has to become the alpha channel first.

Two cases, because they need different maths:

  line art   a single-colour mark on a flat ground. Luminance *is* the coverage,
             so it becomes alpha directly and the mark is repainted in ink. Every
             antialiased edge survives.

  palette    a multi-colour mark on black. Each pixel is a blend of the ground
             and exactly one of the artwork's colours, so projecting it onto each
             candidate and keeping the best fit recovers both the colour and how
             much of it is there. A luminance key would make the darker colours
             semi-transparent; this does not.

`remap` swaps one artwork colour for another after keying, which is how the
paper cut of a logo built for a dark ground gets its lettering back.

Usage:
    python scripts/key_brand_logo.py  # paths are set in main()
"""

import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "brands")
INK = (11, 11, 11)


def _crop(im, pad=6):
    """Trim the keyed-out ground, leaving a little air."""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 8)
    top, bottom = max(ys.min() - pad, 0), min(ys.max() + 1 + pad, a.shape[0])
    left, right = max(xs.min() - pad, 0), min(xs.max() + 1 + pad, a.shape[1])
    return im.crop((left, top, right, bottom))


def key_line_art(path, out, on_white=False, ink=INK):
    lum = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
    alpha = (255.0 - lum) if on_white else lum
    rgba = np.zeros(lum.shape + (4,), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = ink
    rgba[..., 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    im = _crop(Image.fromarray(rgba, "RGBA"))
    im.save(os.path.join(OUT, out))
    return im.size


def key_palette(path, out, palette, remap=None):
    px = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    best_t = np.zeros(px.shape[:2], dtype=np.float32)
    best_resid = np.full(px.shape[:2], np.inf, dtype=np.float32)
    best_colour = np.zeros(px.shape, dtype=np.float32)

    for colour in palette:
        c = np.array(colour, dtype=np.float32)
        t = np.clip((px @ c) / float(c @ c), 0.0, 1.0)
        resid = np.linalg.norm(px - t[..., None] * c, axis=-1)
        take = resid < best_resid
        best_resid = np.where(take, resid, best_resid)
        best_t = np.where(take, t, best_t)
        best_colour = np.where(take[..., None], c, best_colour)

    for src, dst in (remap or {}).items():
        m = np.all(best_colour == np.array(src, dtype=np.float32), axis=-1)
        best_colour[m] = np.array(dst, dtype=np.float32)

    rgba = np.zeros(px.shape[:2] + (4,), dtype=np.uint8)
    rgba[..., :3] = best_colour.astype(np.uint8)
    rgba[..., 3] = (np.clip(best_t, 0, 1) * 255).astype(np.uint8)
    im = _crop(Image.fromarray(rgba, "RGBA"))
    im.save(os.path.join(OUT, out))
    return im.size


def main():
    src = os.environ.get("LOGO_SRC", "logos")
    brown, white, tan = (76, 38, 1), (255, 255, 255), (255, 204, 102)

    print("chrome-hearts", key_line_art(f"{src}/chrome-hearts.png", "chrome-hearts.png"))
    print("gallery-dept ", key_line_art(f"{src}/gallery-dept.png", "gallery-dept.png",
                                        on_white=True))
    # Paper cut: the lettering has to stop being white or it vanishes on the tile.
    print("bape         ", key_palette(f"{src}/bape.png", "bape.png",
                                       [brown, white, tan], remap={white: INK}))
    # Camo cut: the lockup as drawn, which is what its black ground was for.
    print("bape-on-dark ", key_palette(f"{src}/bape.png", "bape-on-dark.png",
                                       [brown, white, tan]))


if __name__ == "__main__":
    main()
