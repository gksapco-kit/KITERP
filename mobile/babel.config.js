module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    // Must be listed last (Reanimated / Worklets)
    plugins: ['react-native-reanimated/plugin'],
  }
}
