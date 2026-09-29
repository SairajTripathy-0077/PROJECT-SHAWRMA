import fs from 'fs';
import path from 'path';

const root = process.cwd();
const iconsDir = path.join(root, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Minimal valid PNG buffer (1x1 pixel RGBA #38bdf8)
const pngBuffer = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x73, 0x7a, 0x7a, 0xf4,
  0x00, 0x00, 0x00, 0x1d, 0x49, 0x44, 0x41, 0x54,
  0x78, 0x9c, 0x63, 0xfc, 0xcf, 0x80, 0x0d, 0x30,
  0xa6, 0xc1, 0x0c, 0x66, 0xd0, 0x00, 0x24, 0x5e,
  0x03, 0x98, 0xd9, 0x9d, 0x03, 0x30, 0xd7, 0x90,
  0x01, 0x00, 0x1f, 0xc7, 0x04, 0x68, 0xec, 0x27,
  0x55, 0xb6, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

// Standard ICO header framing 1 PNG entry
const icoHeader = Buffer.from([
  0x00, 0x00, // Reserved
  0x01, 0x00, // Type 1 (ICO)
  0x01, 0x00, // Image count 1
  0x20,       // Width 32
  0x20,       // Height 32
  0x00,       // Color count
  0x00,       // Reserved
  0x01, 0x00, // Color planes
  0x20, 0x00  // Bits per pixel (32)
]);

const sizeBuf = Buffer.alloc(4);
sizeBuf.writeUInt32LE(pngBuffer.length, 0);

const offsetBuf = Buffer.alloc(4);
offsetBuf.writeUInt32LE(22, 0); // 6 (header) + 16 (dir entry)

const icoBuffer = Buffer.concat([icoHeader, sizeBuf, offsetBuf, pngBuffer]);

fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '32x32.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square30x30Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square44x44Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square71x71Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square89x89Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square107x107Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square142x142Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square150x150Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square284x284Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'Square310x310Logo.png'), pngBuffer);
fs.writeFileSync(path.join(iconsDir, 'StoreLogo.png'), pngBuffer);

console.log('Generated Tauri icons successfully in src-tauri/icons/');
