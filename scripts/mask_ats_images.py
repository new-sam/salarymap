"""Mask SLA-related text from ATS preview screenshots.
Output: ats-*-masked.png written alongside originals."""
from PIL import Image, ImageDraw, ImageFilter
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'public', 'ats-preview')
WHITE = (255, 255, 255)

# (x1, y1, x2, y2) — rectangles to fill with white
KANBAN_RECTS = [
    # Start after "₫850M", swallow "· SLA 32h"
    (575, 108, 685, 138),
]

APPLICANTS_NAME_BOX = (240, 200, 470, 895)  # name column (full height) — light blur

JOBS_RECTS = [
    # Row 1 — bottom-right "SLA Xh" labels (4 cards)
    (415, 388, 502, 412),
    (710, 388, 795, 412),
    (1000, 388, 1085, 412),
    (1295, 388, 1372, 412),
    # Card 3 yellow "SLA 임박" badge
    (770, 180, 895, 220),
    # Row 2 Card 6 "SLA 24h" — widened right
    (680, 632, 800, 662),
]

def apply_mask(filename, rects):
    src = os.path.join(BASE, filename)
    img = Image.open(src).convert('RGB')
    draw = ImageDraw.Draw(img)
    for r in rects:
        draw.rectangle(r, fill=WHITE)
    out_name = filename.replace('.png', '-masked.png')
    img.save(os.path.join(BASE, out_name), optimize=True)
    print(f"wrote {out_name}")

def apply_blur_region(filename, box, radius=5):
    """Blur a rectangular region — for redacting PII while preserving layout."""
    src = os.path.join(BASE, filename)
    img = Image.open(src).convert('RGB')
    region = img.crop(box)
    blurred = region.filter(ImageFilter.GaussianBlur(radius=radius))
    img.paste(blurred, box)
    out_name = filename.replace('.png', '-masked.png')
    img.save(os.path.join(BASE, out_name), optimize=True)
    print(f"wrote {out_name} (blur r={radius})")

def debug_overlay(filename, rects):
    src = os.path.join(BASE, filename)
    img = Image.open(src).convert('RGBA')
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for r in rects:
        draw.rectangle(r, fill=(255, 0, 0, 120))
    Image.alpha_composite(img, overlay).convert('RGB').save(
        os.path.join(BASE, '_dbg_overlay_' + filename)
    )
    print(f"debug overlay: _dbg_overlay_{filename}")

if __name__ == '__main__':
    import sys
    if '--debug' in sys.argv:
        debug_overlay('ats-kanban.png', KANBAN_RECTS)
        debug_overlay('ats-jobs.png', JOBS_RECTS)
        debug_overlay('ats-applicants.png', [APPLICANTS_NAME_BOX])
    else:
        apply_mask('ats-kanban.png', KANBAN_RECTS)
        apply_mask('ats-jobs.png', JOBS_RECTS)
        apply_blur_region('ats-applicants.png', APPLICANTS_NAME_BOX, radius=5)
        Image.open(os.path.join(BASE, 'ats-analytics.png')).convert('RGB').save(
            os.path.join(BASE, 'ats-analytics-masked.png'), optimize=True
        )
        print('ats-analytics-masked.png copied')
