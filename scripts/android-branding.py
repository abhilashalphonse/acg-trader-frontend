"""Create ACG Trader debug launcher icons from the actual checked-in ACG logo.

No logo redesign and no example Capacitor icon. Used only after 'npx cap add android'.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
MANIFEST = ROOT / "android" / "app" / "src" / "main" / "AndroidManifest.xml"
SOURCE = ROOT / "public" / "acg-logo.png"

sizes = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

logo = Image.open(SOURCE).convert("RGBA")
gray = logo.convert("RGB").convert("L")
# The actual source asset is a white ACG wordmark on a black/transparent canvas.
visible = gray.point(lambda v: 255 if v >= 90 else 0)
bounds = visible.getbbox()
if not bounds:
    raise RuntimeError("ACG repo logo has no visible white mark")
logo = logo.crop(bounds)

for density, size in sizes.items():
    destination = RES / ("mipmap-" + density)
    destination.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    max_width = int(size * 0.83)
    max_height = int(size * 0.55)
    scale = min(max_width / logo.width, max_height / logo.height)
    resized = logo.resize((max(1, round(logo.width * scale)), max(1, round(logo.height * scale))), Image.Resampling.LANCZOS)
    x = (size - resized.width) // 2
    y = (size - resized.height) // 2
    canvas.alpha_composite(resized, (x, y))
    canvas.convert("RGB").save(destination / "acg_icon.png", optimize=True)

raw = MANIFEST.read_text()
for old in ('@mipmap/ic_launcher', '@mipmap/ic_launcher_round'):
    if old not in raw:
        raise RuntimeError("Expected launcher resource missing from generated AndroidManifest: " + old)
raw = raw.replace('@mipmap/ic_launcher_round', '@mipmap/acg_icon')
raw = raw.replace('@mipmap/ic_launcher', '@mipmap/acg_icon')
MANIFEST.write_text(raw)
print("Android launcher stamped with public/acg-logo.png")
