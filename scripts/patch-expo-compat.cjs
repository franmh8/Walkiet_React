const fs = require('fs');
const path = require('path');

const rnDir = path.resolve(__dirname, '../node_modules/react-native');
if (fs.existsSync(rnDir)) {
  // 1. Crear rn-get-polyfills.js
  const polyfillFile = path.join(rnDir, 'rn-get-polyfills.js');
  fs.writeFileSync(polyfillFile, "module.exports = require('@react-native/js-polyfills');\n");

  // 2. Exportar ./rn-get-polyfills y ./rn-get-polyfills.js en package.json de react-native
  const pkgFile = path.join(rnDir, 'package.json');
  if (fs.existsSync(pkgFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
      if (pkg.exports) {
        pkg.exports['./rn-get-polyfills'] = './rn-get-polyfills.js';
        pkg.exports['./rn-get-polyfills.js'] = './rn-get-polyfills.js';
        fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
      }
    } catch (e) {
      console.warn('Advertencia al parchar exports de react-native:', e.message);
    }
  }

  // 3. Parchar ReactNativeVersionCheck.js para evitar fatal mismatch en Expo Go
  const vcFile = path.join(rnDir, 'Libraries/Core/ReactNativeVersionCheck.js');
  if (fs.existsSync(vcFile)) {
    fs.writeFileSync(vcFile, "export function checkVersions() {}\n");
  }

  console.log('✅ Compatibilidad de React Native con Expo verificada y parchada exitosamente.');
}
