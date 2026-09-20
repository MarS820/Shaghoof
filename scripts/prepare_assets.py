from pathlib import Path
from PIL import Image
import shutil

ROOT = Path(__file__).resolve().parents[1]
SHARED = Path('/home/ubuntu/projects/shaghoof-5069bb10')
OUT = ROOT / 'public' / 'brand'
OUT.mkdir(parents=True, exist_ok=True)

# Reuse the supplied transparent artwork as the source of truth.
for source_name, target_name in {
    'shaghoofmascot.png': 'mascot-main.png',
    'shaghoof waving.png': 'mascot-waving.png',
    'shaghoof expression.png': 'mascot-expressions.png',
    'home bg .png': 'home-splash.png',
    'login page.png': 'login-splash.png',
    'dusk theme .png': 'dusk-splash.png',
}.items():
    source = SHARED / source_name
    if source.exists():
        shutil.copy2(source, OUT / target_name)

for number in range(1, 10):
    source = SHARED / f'badge{number}.png'
    if not source.exists() and number == 3:
        # The source pack skips badge3; use the next numbered badge as a graceful fallback.
        source = SHARED / 'badge4.png'
    if source.exists():
        shutil.copy2(source, OUT / f'badge-{number}.png')

# The old mark/wordmark JPEGs contain a dark matte. Remove near-black pixels so
# they stay crisp on light and dark surfaces without changing the illustration.
for source_name, target_name in [('shaghoof-mark.png', 'shaghoof-mark-clear.png'), ('shaghoof-wordmark.png', 'shaghoof-wordmark-clear.png')]:
    source = OUT / source_name
    if not source.exists():
        continue
    image = Image.open(source).convert('RGBA')
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if r < 35 and g < 35 and b < 35:
                pixels[x, y] = (r, g, b, 0)
            elif r < 70 and g < 70 and b < 70:
                alpha = int(a * max(r, g, b) / 70)
                pixels[x, y] = (r, g, b, alpha)
    image.save(OUT / target_name)
