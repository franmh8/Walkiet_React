// Update generated native projects without running prebuild or changing signing/capabilities.
const fs = require('node:fs/promises');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { IOSConfig, AndroidConfig, XML } = require('@expo/config-plugins');
const { setIconsAsync } = require('@expo/prebuild-config/build/plugins/icons/withIosIcons');
const { getIcon, getAdaptiveIcon, setIconAsync } = require('@expo/prebuild-config/build/plugins/icons/withAndroidIcons');

async function syncBranding(projectRoot) {
  const { expo: config } = JSON.parse(await fs.readFile(path.join(projectRoot, 'app.base.json'), 'utf8'));
  for (const platform of ['ios', 'android']) {
    try { await fs.access(path.join(projectRoot, platform)); }
    catch { console.log(`${platform}: sin proyecto nativo; Expo aplicará la configuración al crearlo.`); continue; }

    if (platform === 'ios') {
      const file = IOSConfig.Paths.getInfoPlistPath(projectRoot);
      const info = plist.parse(await fs.readFile(file, 'utf8'));
      info.CFBundleDisplayName = config.name;
      await setIconsAsync(config, projectRoot);
      await fs.writeFile(file, plist.build(info));
    } else {
      const { Resources, Strings, Colors } = AndroidConfig;
      const file = await Strings.getProjectStringsXMLPathAsync(projectRoot);
      const strings = await Resources.readResourcesXMLAsync({ path: file });
      Strings.setStringItem([Resources.buildResourceItem({ name: 'app_name', value: config.name })], strings);
      await setIconAsync(projectRoot, {
        icon: getIcon(config), ...getAdaptiveIcon(config), isAdaptive: true,
      });
      const colorsPath = await Colors.getProjectColorsXMLPathAsync(projectRoot);
      const colors = await Resources.readResourcesXMLAsync({ path: colorsPath });
      Colors.assignColorValue(colors, { name: 'iconBackground', value: config.android.adaptiveIcon.backgroundColor });
      await XML.writeXMLAsync({ path: colorsPath, xml: colors });
      await XML.writeXMLAsync({ path: file, xml: strings });
    }
    console.log(`${platform}: nombre «${config.name}» e iconos actualizados. Vuelve a compilar la app.`);
  }
}

module.exports = { syncBranding };
if (require.main === module) {
  syncBranding(path.resolve(__dirname, '..')).catch((error) => {
    console.error(`No se pudo actualizar el proyecto nativo: ${error.message}`);
    process.exitCode = 1;
  });
}
