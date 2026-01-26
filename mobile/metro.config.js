// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for make-plural package (ES modules without main field)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
