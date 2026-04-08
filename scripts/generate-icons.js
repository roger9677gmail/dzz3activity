/**
 * 使用此腳本產生 PWA 圖示 PNG 檔案
 * 需要先安裝: npm install --save-dev sharp
 * 執行: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '../public/icons/icon-192x192.svg');
const OUT_DIR = path.join(__dirname, '../public/icons');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('提示: 請執行 npm install --save-dev sharp 後再執行此腳本');
    console.log('或使用線上工具將 public/icons/icon-192x192.svg 轉換為 PNG 格式');
    createFallbackPNGs();
    return;
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);
  const sizes = [192, 512];

  for (const size of sizes) {
    const outPath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`✅ 產生: icon-${size}x${size}.png`);
  }
  console.log('圖示產生完成！');
}

function createFallbackPNGs() {
  // Create minimal 1x1 PNG as placeholder
  // Real 192x192 red square PNG (base64)
  const png192 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(path.join(OUT_DIR, 'icon-192x192.png'), png192);
  fs.writeFileSync(path.join(OUT_DIR, 'icon-512x512.png'), png192);
  console.log('已建立暫時圖示檔（請手動替換為正式圖示）');
}

generateIcons().catch(console.error);
