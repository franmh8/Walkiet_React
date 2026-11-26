// Expo's asset pipeline resizes the existing institutional logo without redrawing it.
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  generateImageAsync,
  generateImageBackgroundAsync,
  compositeImagesAsync,
} = require('@expo/image-utils');

const projectRoot = path.resolve(__dirname, '..');
const logo = path.join(projectRoot, 'assets/c5i-logo.png');

async function launcherIcon(filename, logoWidth, backgroundColor) {
  const logoHeight = Math.round(logoWidth * 2200 / 2600);
  const foreground = (await generateImageAsync({ projectRoot }, {
    src: logo, width: logoWidth, height: logoHeight, resizeMode: 'contain',
  })).source;
  const background = await generateImageBackgroundAsync({
    width: 1024, height: 1024, resizeMode: 'contain', backgroundColor,
  });
  const icon = await compositeImagesAsync({
    foreground, background,
    x: Math.round((1024 - logoWidth) / 2),
    y: Math.round((1024 - logoHeight) / 2),
  });
  await fs.writeFile(path.join(projectRoot, filename), icon);
}

async function main() {
  // iOS requires an opaque square. Android foreground stays inside the mask-safe area.
  await launcherIcon('assets/icon.png', 820, '#FFFFFF');
  const opaque = (await generateImageAsync({ projectRoot }, {
    src: path.join(projectRoot, 'assets/icon.png'),
    width: 1024, height: 1024, resizeMode: 'contain',
    backgroundColor: '#FFFFFF', removeTransparency: true,
  })).source;
  await fs.writeFile(path.join(projectRoot, 'assets/icon.png'), opaque);
  await launcherIcon('assets/adaptive-icon.png', 520, '#00000000');
  for (const [filename, size] of [['favicon.png', 48], ['apple-touch-icon.png', 180]]) {
    const { source } = await generateImageAsync({ projectRoot }, {
      src: path.join(projectRoot, 'assets/icon.png'),
      width: size, height: size, resizeMode: 'contain',
      backgroundColor: '#FFFFFF', removeTransparency: true,
    });
    await fs.writeFile(path.join(projectRoot, 'public/assets', filename), source);
  }
  console.log('Iconos del C5i generados para iOS, Android y web.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
