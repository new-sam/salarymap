"""Mask PII in candidate detail capture.
Strategy:
- Heavy blur over PDF content area (thumbnails + main view)
- Whiteout hard PII strips (name, subtitle, panel values, PDF header title)
Output: ats-candidate-detail-masked.png"""
from PIL import Image, ImageDraw, ImageFilter
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'public', 'ats-preview')
WHITE = (255, 255, 255)

# Very light blur — content remains mostly recognizable, the landing's scaling does the rest
PDF_BLUR_BOX = (15, 195, 1310, 867)
PDF_BLUR_RADIUS = 3

WHITEOUT_RECTS = [
    # Top-left "김슬기" + "kee@likelion.net · IMPACT MAKER"
    (0, 0, 360, 82),
    # PDF dark header bar "위승주 | AI-Native Planner & Product Owner"
    (75, 150, 510, 205),
    # Right panel "이메일" value (kee@likelion.net)
    (1610, 125, 1865, 152),
    # Right panel "지원일" value (timestamp)
    (1530, 158, 1865, 188),
]

def apply():
    src = os.path.join(BASE, 'candidate-detail-raw.png')
    img = Image.open(src).convert('RGB')

    # Heavy blur over PDF area
    region = img.crop(PDF_BLUR_BOX)
    blurred = region.filter(ImageFilter.GaussianBlur(radius=PDF_BLUR_RADIUS))
    img.paste(blurred, PDF_BLUR_BOX)

    # Whiteout PII strips
    draw = ImageDraw.Draw(img)
    for r in WHITEOUT_RECTS:
        draw.rectangle(r, fill=WHITE)

    out = os.path.join(BASE, 'ats-candidate-detail-masked.png')
    img.save(out, optimize=True)
    print('wrote ats-candidate-detail-masked.png')

def debug():
    src = os.path.join(BASE, 'candidate-detail-raw.png')
    img = Image.open(src).convert('RGBA')
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.rectangle(PDF_BLUR_BOX, fill=(0, 120, 255, 80))
    for r in WHITEOUT_RECTS:
        draw.rectangle(r, fill=(255, 0, 0, 150))
    Image.alpha_composite(img, overlay).convert('RGB').save(
        os.path.join(BASE, '_dbg_cd_overlay.png')
    )
    print('debug overlay saved')

if __name__ == '__main__':
    import sys
    if '--debug' in sys.argv:
        debug()
    else:
        apply()
