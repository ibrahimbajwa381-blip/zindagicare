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

# Crop the heart icon with breathing room around the figure heads
pad = 20
left = max(0, x0 - pad)
top = max(0, y0 - pad * 2)
right = min(img.width, x1 + pad)
bottom = min(img.height, y1 + pad)
icon_rect = img.crop((left, top, right, bottom))


def build_icon(
    src: Image.Image,
    *,
    content_fraction: float,
    canvas_side: int | None = None,
) -> Image.Image:
    """
    Place artwork on a white square with safe margins for mobile icon masks.

    content_fraction: max share of canvas used by artwork (e.g. 0.5 = 50%, 25% margin each side).
    Android maskable safe zone ~66%; iOS rounded corners need ~20%+ side margin.
    """
    rect_w, rect_h = src.size
    if canvas_side is None:
        inner_side = max(rect_w, rect_h)
        canvas_side = int(round(inner_side / content_fraction))

    scale = min(
        (canvas_side * content_fraction) / rect_w,
        (canvas_side * content_fraction) / rect_h,
    )
    new_w = max(1, int(round(rect_w * scale)))
    new_h = max(1, int(round(rect_h * scale)))
    resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (canvas_side, canvas_side), (255, 255, 255, 255))
    paste_x = (canvas_side - new_w) // 2
    paste_y = (canvas_side - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y), resized)
    return canvas


def flatten_white_rgba(src: Image.Image, bg=(255, 255, 255, 255)) -> Image.Image:
    base = Image.new("RGBA", src.size, bg)
    base.paste(src, mask=src.split()[3])
    return base


# Standard icons — ~58% artwork (safe for most launchers)
icon_any = build_icon(icon_rect, content_fraction=0.58)
# Maskable icons — ~48% artwork (Android adaptive / circular masks)
icon_maskable = build_icon(icon_rect, content_fraction=0.48)

icon_any_rgba = flatten_white_rgba(icon_any)
icon_maskable_rgba = flatten_white_rgba(icon_maskable)
icon_any_rgb = icon_any_rgba.convert("RGB")
icon_maskable_rgb = icon_maskable_rgba.convert("RGB")

app_dir = ROOT / "src" / "app"
public_dir = ROOT / "public"

icon_any_rgb.resize((32, 32), Image.Resampling.LANCZOS).save(app_dir / "icon.png")
icon_any_rgb.resize((180, 180), Image.Resampling.LANCZOS).save(app_dir / "apple-icon.png")

ico_sizes = [(16, 16), (32, 32), (48, 48)]
icon_any_rgba.save(app_dir / "favicon.ico", format="ICO", sizes=ico_sizes)
icon_any_rgba.save(public_dir / "favicon.ico", format="ICO", sizes=ico_sizes)

icon_any_rgb.resize((192, 192), Image.Resampling.LANCZOS).save(public_dir / "icon-192.png")
icon_any_rgb.resize((512, 512), Image.Resampling.LANCZOS).save(public_dir / "icon-512.png")
icon_maskable_rgb.resize((192, 192), Image.Resampling.LANCZOS).save(
    public_dir / "icon-192-maskable.png"
)
icon_maskable_rgb.resize((512, 512), Image.Resampling.LANCZOS).save(
    public_dir / "icon-512-maskable.png"
)

print("Created favicon assets from logo icon")
print("Crop bounds:", left, top, right, bottom)
print("Standard canvas:", icon_any.size, "maskable canvas:", icon_maskable.size)
