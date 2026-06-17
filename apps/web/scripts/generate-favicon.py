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
icon_mask[:, 370:] = False
rows, cols = np.where(icon_mask)
x0, y0, x1, y1 = cols.min(), rows.min(), cols.max(), rows.max()

# Tight square crop around the icon with balanced padding
pad = 12
cx = (x0 + x1) // 2
cy = (y0 + y1) // 2
side = max(x1 - x0, y1 - y0) + pad * 2
left = cx - side // 2
top = cy - side // 2
icon = img.crop((left, top, left + side, top + side))


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
print("Icon crop:", left, top, left + side, top + side)
