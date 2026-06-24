from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
logo_path = ROOT / "public" / "logo1.png"
img = Image.open(logo_path).convert("RGBA")

# Heart icon only — exclude the wordmark on the right
data = np.array(img)
alpha = data[:, :, 3]
rgb = data[:, :, :3]
mask = (alpha > 10) & np.any(rgb < 245, axis=2)
icon_mask = mask.copy()
icon_mask[:, 260:] = False
rows, cols = np.where(icon_mask)
if rows.size == 0:
    raise SystemExit("Could not detect logo icon region")
x0, y0, x1, y1 = cols.min(), rows.min(), cols.max(), rows.max()

# Rectangular crop of the heart icon only, with extra top padding for the figure heads
pad = 20
left = max(0, x0 - pad)
top = max(0, y0 - pad * 2)
right = min(img.width, x1 + pad)
bottom = min(img.height, y1 + pad)
icon_rect = img.crop((left, top, right, bottom))

# Pad to square if crop hit the image edge, then add outer safe-zone for mobile/PWA masks
rect_w, rect_h = icon_rect.size
inner_side = max(rect_w, rect_h)
inner = Image.new("RGBA", (inner_side, inner_side), (255, 255, 255, 0))
inner.paste(icon_rect, ((inner_side - rect_w) // 2, (inner_side - rect_h) // 2), icon_rect)

safe_ratio = 0.14
outer_side = int(inner_side * (1 + safe_ratio * 2))
icon = Image.new("RGBA", (outer_side, outer_side), (255, 255, 255, 255))
inset = (outer_side - inner_side) // 2
icon.paste(inner, (inset, inset), inner)


def flatten_white_rgba(src: Image.Image, bg=(255, 255, 255, 255)) -> Image.Image:
    base = Image.new("RGBA", src.size, bg)
    base.paste(src, mask=src.split()[3])
    return base


icon_rgba = flatten_white_rgba(icon)
icon_rgb = icon_rgba.convert("RGB")

app_dir = ROOT / "src" / "app"
public_dir = ROOT / "public"

icon_rgb.resize((32, 32), Image.Resampling.LANCZOS).save(app_dir / "icon.png")
icon_rgb.resize((180, 180), Image.Resampling.LANCZOS).save(app_dir / "apple-icon.png")

ico_sizes = [(16, 16), (32, 32), (48, 48)]
icon_rgba.save(app_dir / "favicon.ico", format="ICO", sizes=ico_sizes)
icon_rgba.save(public_dir / "favicon.ico", format="ICO", sizes=ico_sizes)

icon_rgb.resize((192, 192), Image.Resampling.LANCZOS).save(public_dir / "icon-192.png")
icon_rgb.resize((512, 512), Image.Resampling.LANCZOS).save(public_dir / "icon-512.png")

print("Created favicon assets from logo icon")
print("Icon bounds:", left, top, right, bottom, "canvas", outer_side)
