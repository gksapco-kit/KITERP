/// <reference types="expo-router/types" />

// Metro inlines EXPO_PUBLIC_* at build time. Declared here instead of pulling in
// @types/node, which shadows React Native globals.
declare const process: {
  env: {
    NODE_ENV?: 'development' | 'production' | 'test'
    EXPO_PUBLIC_API_URL?: string
    EXPO_PUBLIC_STOREFRONT_URL?: string
  }
}
