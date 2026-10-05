"""Generate synthetic test images for the scan detector.

Each fake "passport photo" is a 350x450 card: light backdrop, dark shoulders,
a skin-tone head and an "UP" label so orientation is visible in the output.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random

random.seed(7)
W, H = 350, 450

def fake_photo(i, bg=(225, 232, 240)):
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    d.ellipse([60, 330, 290, 560], fill=(40 + i * 20, 50, 90))           # shoulders
    d.ellipse([110, 110, 240, 290], fill=(224, 180, 150))                 # head
    d.ellipse([105, 95, 245, 190], fill=(60, 40, 30))                     # hair
    d.ellipse([140, 190, 160, 205], fill=(30, 30, 30)); d.ellipse([190, 190, 210, 205], fill=(30, 30, 30))
    d.arc([150, 230, 200, 260], 20, 160, fill=(150, 60, 60), width=4)
    font = ImageFont.truetype("arial.ttf", 40)
    d.text((W / 2, 40), f"UP {i + 1}", fill=(20, 20, 20), font=font, anchor="mm")
    return im

def paste_rotated(canvas, photo, cx, cy, angle):
    """angle: clockwise degrees (PIL rotates counter-clockwise, hence the minus)."""
    r = photo.convert("RGBA").rotate(-angle, expand=True, resample=Image.Resampling.BICUBIC)
    canvas.paste(r, (int(cx - r.width / 2), int(cy - r.height / 2)), r)

# 1) Loose photos on a scanner bed, mixed tilts, one sideways, one upside down.
scan = Image.new("RGB", (2400, 1700), (246, 246, 244))
shadow = Image.new("RGBA", scan.size, (0, 0, 0, 0))
placements = [(450, 450, -8), (1200, 430, 4), (1950, 480, 92), (500, 1230, 177), (1250, 1250, 12), (1950, 1220, -3)]
for i, (cx, cy, a) in enumerate(placements):
    paste_rotated(shadow, Image.new("RGB", (W + 6, H + 6), (0, 0, 0)).convert("RGBA").point(lambda v: v) , cx + 4, cy + 4, a)
scan.paste(Image.new("RGB", scan.size, (200, 200, 200)), (0, 0), shadow.split()[3].point(lambda v: 60 if v else 0).filter(ImageFilter.GaussianBlur(3)))
for i, (cx, cy, a) in enumerate(placements):
    paste_rotated(scan, fake_photo(i), cx, cy, a)
scan.save("samples/scan-loose-photos.png")

# 2) Same, but white-background photos on a white scanner (hard case).
scan2 = Image.new("RGB", (1800, 1200), (250, 250, 250))
for i, (cx, cy, a) in enumerate([(400, 600, 6), (950, 580, -11), (1450, 620, 2)]):
    p = fake_photo(i, bg=(244, 244, 244))
    ImageDraw.Draw(p).rectangle([0, 0, W - 1, H - 1], outline=(215, 215, 215), width=2)
    paste_rotated(scan2, p, cx, cy, a)
scan2.save("samples/scan-white-on-white.jpg", quality=90)

# 2b) Realistic white-on-white: the backdrop is a shade off the bed colour, only
#     the paper's top edge shows as a faint line, and the shoulders run into both
#     sides of the photo, so the photo's outline is otherwise invisible.
def white_backdrop_photo(i):
    im = Image.new("RGB", (W, H), (252, 252, 251))
    d = ImageDraw.Draw(im)
    d.line([0, 0, W - 1, 0], fill=(222, 222, 222), width=1)
    d.polygon([(0, H), (0, 340), (40, 315), (120, 300), (230, 300), (310, 315), (W, 340), (W, H)], fill=(30 + i * 25, 35, 60))
    d.ellipse([110, 95, 240, 300], fill=(60, 40, 30))                     # hair
    d.ellipse([125, 125, 225, 290], fill=(224, 180, 150))                 # face
    d.ellipse([148, 185, 166, 197], fill=(30, 30, 30)); d.ellipse([184, 185, 202, 197], fill=(30, 30, 30))
    d.arc([155, 235, 195, 260], 20, 160, fill=(150, 60, 60), width=4)
    return im

scan3 = Image.new("RGB", (2000, 1500), (255, 255, 255))
for i, (cx, cy, a) in enumerate([(550, 420, -2), (1400, 430, 3), (560, 1080, -4), (1420, 1090, 5)]):
    paste_rotated(scan3, white_backdrop_photo(i), cx, cy, a)
scan3.save("samples/scan-white-on-white-no-edge.jpg", quality=90)

print("ok")
