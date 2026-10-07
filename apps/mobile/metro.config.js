/*
 * FILE    : apps/mobile/metro.config.js
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Let Metro bundle the shared @handled/core package from the monorepo.
 */
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../packages/core")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
module.exports = config;
