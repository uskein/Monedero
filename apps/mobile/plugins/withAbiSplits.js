/**
 * withAbiSplits — plugin local de Expo Config (v0.3.0).
 * Inyecta `splits { abi { ... } }` en el bloque android{} de build.gradle
 * para generar un APK por ABI (arm64-v8a, armeabi-v7a, x86_64) + universal.
 * Motivo: los .so nativos se empaquetan en 4 ABIs (~68 MB); con splits el
 * usuario instala SOLO su arquitectura (~35 MB). universalApk=true conserva
 * un APK completo para sideload multi-dispositivo.
 * Sobrevive a `expo prebuild` porque es un config plugin (no edición manual).
 */
const { withAppBuildGradle } = require('@expo/config-plugins');

const ABI_SPLITS_BLOCK = `    splits {
        abi {
            enable true
            reset()
            include "armeabi-v7a", "arm64-v8a", "x86_64"
            universalApk true
        }
    }
`;

module.exports = function withAbiSplits(config) {
  return withAppBuildGradle(config, (cfg) => {
    // Idempotente: si ya existe un bloque splits, no duplicar.
    if (!cfg.modResults.contents.includes('splits {')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /android \{/,
        `android {\n${ABI_SPLITS_BLOCK}`,
      );
    }
    return cfg;
  });
};
