const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICONS_DIR = path.join(__dirname, '../public/icons');
const SOURCE_PATH = path.join(ICONS_DIR, 'original-logo.png');

async function generateIcons() {
  const sourceBuffer = fs.readFileSync(SOURCE_PATH);

  // Get original image metadata
  const meta = await sharp(sourceBuffer).metadata();
  console.log(`Original: ${meta.width}x${meta.height}`);

  // Remove white background: extract raw pixels and make white→transparent
  const { data, info } = await sharp(sourceBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 200 && g > 200 && b > 200) {
      // White background → transparent
      data[i + 3] = 0;
    } else {
      // Dark silhouette → temple gold (#C4962A)
      data[i] = 196;     // R
      data[i + 1] = 150;  // G
      data[i + 2] = 42;   // B
    }
  }

  const transparentBuffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  // Create a square version: temple-red background with logo centered and padded
  const maxDim = Math.max(info.width, info.height);
  const padding = Math.round(maxDim * 0.15);
  const canvasSize = maxDim + padding * 2;

  const squareBuffer = await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 139, g: 26, b: 26, alpha: 255 },
    },
  })
    .composite([{
      input: transparentBuffer,
      gravity: 'centre',
    }])
    .png()
    .toBuffer();

  const sizes = [
    { name: 'icon-192x192.png', size: 192 },
    { name: 'icon-512x512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-16x16.png', size: 16 },
  ];

  for (const { name, size } of sizes) {
    const outPath = path.join(ICONS_DIR, name);
    await sharp(squareBuffer)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    console.log(`✅ ${name} (${size}x${size})`);
  }

  // Also generate a favicon.ico-compatible PNG
  console.log('\n🎉 所有圖示產生完成！');
}

generateIcons().catch(console.error);
