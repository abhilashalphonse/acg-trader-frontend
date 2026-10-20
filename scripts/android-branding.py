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
if '@mipmap/acg_icon' not in raw and '@mipmap/ic_launcher' not in raw:
    raise RuntimeError("Expected ACG or generated launcher resource missing from AndroidManifest")
raw = raw.replace('@mipmap/ic_launcher_round', '@mipmap/acg_icon')
raw = raw.replace('@mipmap/ic_launcher', '@mipmap/acg_icon')

MANIFEST.write_text(raw)

# Native launch splash: the same genuine mark, never an invented alternate logo.
# Capacitor's Android theme points to @drawable/splash.
splash_dir = RES / "drawable"
splash_dir.mkdir(parents=True, exist_ok=True)
splash = Image.new("RGB", (720, 1280), (0, 0, 0))
splash_scale = min(340 / logo.width, 125 / logo.height)
splash_logo = logo.resize((
    max(1, round(logo.width * splash_scale)),
    max(1, round(logo.height * splash_scale))
), Image.Resampling.LANCZOS)
splash.paste(splash_logo, ((720 - splash_logo.width) // 2, (1280 - splash_logo.height) // 2), splash_logo)
splash.save(splash_dir / "splash.png", optimize=True)

# Android chooses drawable-port/land + density-qualified resources ahead of
# drawable/splash.png. Replace every generated stock Capacitor splash in place.
# Keep their original dimensions so high-density devices render sharply.
for splash_asset in RES.glob("drawable*/splash.png"):
    if splash_asset == splash_dir / "splash.png":
        continue
    with Image.open(splash_asset) as original:
        width, height = original.size
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    target_width = max(24, round(width * 0.47))
    target_height = max(12, round(height * 0.12))
    ratio = min(target_width / logo.width, target_height / logo.height)
    artwork = logo.resize((max(1, round(logo.width * ratio)),
                           max(1, round(logo.height * ratio))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(artwork, ((width - artwork.width) // 2, (height - artwork.height) // 2))
    canvas.convert("RGB").save(splash_asset, optimize=True)

# Android 12+ shows a native splash controlled by the launch theme.
styles = RES / "values" / "styles.xml"
if styles.exists():
    text = styles.read_text()
    if 'AppTheme.NoActionBarLaunch' in text:
        from xml.etree import ElementTree as ET
        tree = ET.parse(styles)
        ET.register_namespace("android", "http://schemas.android.com/apk/res/android")
        ns = "{http://schemas.android.com/apk/res/android}"
        root = tree.getroot()
        target = next((node for node in root.findall("style")
                       if node.get("name") == "AppTheme.NoActionBarLaunch"), None)
        if target is not None:
            for name, value in [
                ("android:windowSplashScreenBackground", "#000000"),
                ("android:windowSplashScreenAnimatedIcon", "@mipmap/acg_icon"),
                ("android:statusBarColor", "#000000"),
                ("android:navigationBarColor", "#000000"),
            ]:
                item_name = name if name.startswith("android:") else name
                existing = next((i for i in target.findall("item") if i.get("name") == item_name), None)
                if existing is None:
                    existing = ET.SubElement(target, "item", {"name": item_name})
                existing.text = value
            tree.write(styles, encoding="utf-8", xml_declaration=True)

# Keep Android native code in version control and copy it into the generated
# Capacitor tree. This file does NOT change any backend authentication rule.
activity_source = ROOT / "scripts" / "android" / "MainActivity.java"
activity_target = ROOT / "android" / "app" / "src" / "main" / "java" / "com" / "acgtrader" / "app" / "MainActivity.java"
if activity_source.exists():
    from shutil import copyfile
    activity_target.parent.mkdir(parents=True, exist_ok=True)
    copyfile(activity_source, activity_target)

print("Android icon, black launch splash, session cookie bridge prepared from official ACG assets")

