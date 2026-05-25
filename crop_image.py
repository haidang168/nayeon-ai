from PIL import Image, ImageChops
import os

img_path = 'public/Screenshot 2026-05-17 173718.png'
im = Image.open(img_path).convert('RGBA')

# Get background color from top-left corner
bg_color = im.getpixel((0,0))
bg = Image.new(im.mode, im.size, bg_color)

# Find difference to get bounding box
diff = ImageChops.difference(im, bg)
diff = ImageChops.add(diff, diff, 2.0, -100)
bbox = diff.getbbox()

if bbox:
    im = im.crop(bbox)

# Make it a perfect square
w, h = im.size
size = max(w, h) # Let's pad it to a square with bg_color to avoid cutting off anything
new_im = Image.new(im.mode, (size, size), bg_color)
new_im.paste(im, ((size - w) // 2, (size - h) // 2))

im_square = new_im

# Actually, if it's a rounded icon on a white background, maybe we want a transparent background?
# For now, let's just make it a square and resize to 192 and 512. PWA icons can be solid.
im_square.resize((192, 192), Image.Resampling.LANCZOS).save('public/icon-192.png', 'PNG')
im_square.resize((512, 512), Image.Resampling.LANCZOS).save('public/icon-512.png', 'PNG')

# Also save a copy for the main app logo if needed (e.g. public/vite.svg or src/assets/react.svg? Wait, does the app use a logo?)
# We'll just replace the icons first.

print("Success")
