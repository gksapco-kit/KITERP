const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Axios >=1.13.3 points "main" at the Node CJS build (needs crypto).
// Point Metro at the browser build so release bundling works on RN/Expo.
// Zustand's ESM build reads `import.meta.env`, which throws in Metro's web
// bundle ("Cannot use 'import.meta' outside a module") — force its CJS build.
const cjsOverrides = {
  axios: 'node_modules/axios/dist/browser/axios.cjs',
  zustand: 'node_modules/zustand/index.js',
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const override = cjsOverrides[moduleName]
  if (override) {
    return {
      filePath: path.resolve(__dirname, override),
      type: 'sourceFile',
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
