"""
Icon Generator for FSOC PAT Simulator Tauri Build
Generates icon.png and icon.ico in src-tauri/icons/
"""
import os
import cv2
import numpy as np

def generate_icons():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    icons_dir = os.path.join(root_dir, "src-tauri", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    size = 512
    img = np.zeros((size, size, 4), dtype=np.uint8)

    # Dark background circle
    center = (size // 2, size // 2)
    radius = size // 2 - 16
    cv2.circle(img, center, radius, (15, 23, 42, 255), -1) # Slate 900
    cv2.circle(img, center, radius, (56, 189, 248, 255), 8) # Sky 400 ring

    # Crosshair / Boresight icon
    color_cyan = (244, 114, 182, 255) # Pink/Cyan crosshair
    cv2.circle(img, center, size // 4, (56, 189, 248, 255), 4)
    cv2.circle(img, center, size // 8, (99, 102, 241, 255), -1)

    # Crosshair ticks
    cv2.line(img, (center[0] - size//3, center[1]), (center[0] - size//6, center[1]), (56, 189, 248, 255), 6)
    cv2.line(img, (center[0] + size//6, center[1]), (center[0] + size//3, center[1]), (56, 189, 248, 255), 6)
    cv2.line(img, (center[0], center[1] - size//3), (center[0], center[1] - size//6), (56, 189, 248, 255), 6)
    cv2.line(img, (center[0], center[1] + size//6), (center[0], center[1] + size//3), (56, 189, 248, 255), 6)

    # Save 512x512 base PNG
    base_png = os.path.join(icons_dir, "icon.png")
    cv2.imwrite(base_png, img)
    print(f"[Icon Gen] Created base PNG: {base_png}")

    # Create common PNG sizes
    sizes = [32, 128, 256, 512]
    for s in sizes:
        resized = cv2.resize(img, (s, s), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(icons_dir, f"{s}x{s}.png"), resized)
        if s == 32:
            cv2.imwrite(os.path.join(icons_dir, "Square30x30Logo.png"), resized)
            cv2.imwrite(os.path.join(icons_dir, "Square44x44Logo.png"), cv2.resize(img, (44, 44)))
            cv2.imwrite(os.path.join(icons_dir, "Square71x71Logo.png"), cv2.resize(img, (71, 71)))
            cv2.imwrite(os.path.join(icons_dir, "Square89x89Logo.png"), cv2.resize(img, (89, 89)))
            cv2.imwrite(os.path.join(icons_dir, "Square107x107Logo.png"), cv2.resize(img, (107, 107)))
            cv2.imwrite(os.path.join(icons_dir, "Square142x142Logo.png"), cv2.resize(img, (142, 142)))
            cv2.imwrite(os.path.join(icons_dir, "Square150x150Logo.png"), cv2.resize(img, (150, 150)))
            cv2.imwrite(os.path.join(icons_dir, "Square284x284Logo.png"), cv2.resize(img, (284, 284)))
            cv2.imwrite(os.path.join(icons_dir, "Square310x310Logo.png"), cv2.resize(img, (310, 310)))
            cv2.imwrite(os.path.join(icons_dir, "StoreLogo.png"), cv2.resize(img, (50, 50)))

    # Generate ICO file using PIL if available, or write ICO header
    try:
        from PIL import Image
        pil_img = Image.open(base_png)
        ico_path = os.path.join(icons_dir, "icon.ico")
        pil_img.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        print(f"[Icon Gen] Created ICO via PIL: {ico_path}")
    except Exception as e:
        print(f"[Icon Gen] PIL not found ({e}). Generating ICO via OpenCV / raw header...")
        # Save simple BMP ICO or png-compressed ICO container
        ico_path = os.path.join(icons_dir, "icon.ico")
        # ICO header for single 256x256 PNG
        png_data = cv2.imencode(".png", cv2.resize(img, (256, 256)))[1].tobytes()
        header = bytearray([
            0, 0,           # Reserved
            1, 0,           # Type 1 (ICO)
            1, 0,           # Count 1 image
            0,              # Width 256
            0,              # Height 256
            0,              # Color count
            0,              # Reserved
            1, 0,           # Color planes
            32, 0,          # Bits per pixel
        ])
        header.extend(len(png_data).to_bytes(4, byteorder='little'))
        header.extend((6 + 16).to_bytes(4, byteorder='little')) # Offset to image data
        with open(ico_path, "wb") as f:
            f.write(header)
            f.write(png_data)
        print(f"[Icon Gen] Created raw ICO: {ico_path}")

    # Generate icon.icns dummy/PNG placeholder for macOS build compatibility check
    icns_path = os.path.join(icons_dir, "icon.icns")
    cv2.imwrite(icns_path, img)

if __name__ == "__main__":
    generate_icons()
