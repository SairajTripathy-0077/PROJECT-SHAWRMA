import os
import sys
import struct
import cv2
import numpy as np

def create_dib_ico(width, height, bgra_pixels):
    """
    Creates a Windows 3.00 DIB format ICO byte stream for a single icon frame.
    bgra_pixels: numpy array of shape (height, width, 4) with BGRA values.
    """
    # ICO Directory Header (6 bytes)
    idReserved = 0
    idType = 1 # ICO
    idCount = 1
    icodir = struct.pack("<HHH", idReserved, idType, idCount)

    # BITMAPINFOHEADER (40 bytes)
    biSize = 40
    biWidth = width
    biHeight = height * 2 # doubled for XOR + AND masks
    biPlanes = 1
    biBitCount = 32
    biCompression = 0 # BI_RGB
    biSizeImage = width * height * 4
    biXPelsPerMeter = 0
    biYPelsPerMeter = 0
    biClrUsed = 0
    biClrImportant = 0

    bmp_header = struct.pack("<IIIHHIIIIII",
                             biSize, biWidth, biHeight, biPlanes, biBitCount,
                             biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter,
                             biClrUsed, biClrImportant)

    # XOR Mask (BGRA pixels bottom-to-top)
    xor_mask = bytearray()
    for y in range(height - 1, -1, -1):
        for x in range(width):
            b, g, r, a = bgra_pixels[y, x]
            xor_mask.extend([b, g, r, a])

    # AND Mask (1 bit per pixel, 0 = opaque, 1 = transparent, row padded to DWORD / 4 bytes)
    row_bytes = (width + 31) // 32 * 4
    and_mask = bytearray()
    for y in range(height - 1, -1, -1):
        row_bits = 0
        for x in range(width):
            alpha = bgra_pixels[y, x][3]
            if alpha < 128:
                row_bits |= (1 << (7 - (x % 8)))
            if (x % 8 == 7) or (x == width - 1):
                and_mask.append(row_bits)
                row_bits = 0
        # Pad row to DWORD boundary
        remainder = (width + 7) // 8
        pad = row_bytes - remainder
        and_mask.extend([0] * pad)

    image_data = bmp_header + xor_mask + and_mask
    dwBytesInRes = len(image_data)
    dwImageOffset = 6 + 16 # Header (6) + Entry (16)

    # ICONDIRENTRY (16 bytes)
    bWidth = width if width < 256 else 0
    bHeight = height if height < 256 else 0
    bColorCount = 0
    bReserved = 0
    wPlanes = 1
    wBitCount = 32

    entry = struct.pack("<BBBBHHII",
                        bWidth, bHeight, bColorCount, bReserved,
                        wPlanes, wBitCount, dwBytesInRes, dwImageOffset)

    return icodir + entry + image_data

def generate_windows_ico():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    icons_dir = os.path.join(root_dir, "src-tauri", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    size = 32
    img = np.zeros((size, size, 4), dtype=np.uint8)

    # Create futuristic crosshair icon
    center = (size // 2, size // 2)
    cv2.circle(img, center, size // 2 - 2, (15, 23, 42, 255), -1) # Slate background
    cv2.circle(img, center, size // 2 - 2, (56, 189, 248, 255), 2) # Cyan border
    cv2.circle(img, center, size // 4, (244, 114, 182, 255), 1) # Reticle
    cv2.circle(img, center, 2, (56, 189, 248, 255), -1) # Center dot

    # Lines
    cv2.line(img, (center[0] - 8, center[1]), (center[0] - 3, center[1]), (56, 189, 248, 255), 1)
    cv2.line(img, (center[0] + 3, center[1]), (center[0] + 8, center[1]), (56, 189, 248, 255), 1)
    cv2.line(img, (center[0], center[1] - 8), (center[0], center[1] - 3), (56, 189, 248, 255), 1)
    cv2.line(img, (center[0], center[1] + 3), (center[0], center[1] + 8), (56, 189, 248, 255), 1)

    # Convert to BGRA
    bgra = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)

    # Try Pillow first for multi-size ICO
    try:
        from PIL import Image
        pil_img = Image.fromarray(img)
        ico_path = os.path.join(icons_dir, "icon.ico")
        pil_img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        print(f"[Win32 ICO] Successfully created multi-res ICO with PIL at: {ico_path}")
    except Exception as e:
        print(f"[Win32 ICO] PIL not available ({e}). Creating native Windows 3.00 DIB format ICO...")
        ico_data = create_dib_ico(size, size, bgra)
        ico_path = os.path.join(icons_dir, "icon.ico")
        with open(ico_path, "wb") as f:
            f.write(ico_data)
        print(f"[Win32 ICO] Successfully written 3.00 DIB ICO format file at: {ico_path}")

    # Generate PNG files
    png_path = os.path.join(icons_dir, "icon.png")
    cv2.imwrite(png_path, img)

    sizes = [32, 128]
    for s in sizes:
        resized = cv2.resize(img, (s, s))
        cv2.imwrite(os.path.join(icons_dir, f"{s}x{s}.png"), resized)
        if s == 128:
            cv2.imwrite(os.path.join(icons_dir, "128x128@2x.png"), cv2.resize(img, (256, 256)))
            cv2.imwrite(os.path.join(icons_dir, "Square150x150Logo.png"), cv2.resize(img, (150, 150)))
            cv2.imwrite(os.path.join(icons_dir, "Square44x44Logo.png"), cv2.resize(img, (44, 44)))
            cv2.imwrite(os.path.join(icons_dir, "Square30x30Logo.png"), cv2.resize(img, (30, 30)))
            cv2.imwrite(os.path.join(icons_dir, "StoreLogo.png"), cv2.resize(img, (50, 50)))

if __name__ == "__main__":
    generate_windows_ico()
