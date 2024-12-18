import alias from "@rollup/plugin-alias"
import commonjs from "@rollup/plugin-commonjs"
import json from "@rollup/plugin-json"
import resolve from "@rollup/plugin-node-resolve"
import sucrase from "@rollup/plugin-sucrase"
import { Features } from "lightningcss"
import cleanup from "rollup-plugin-cleanup"
import copy from "rollup-plugin-copy"
import del from "rollup-plugin-delete"
import { string } from "rollup-plugin-string"
import styles from "rollup-plugin-styles"
import svelte from "rollup-plugin-svelte"
import webpackStatsPlugin from "rollup-plugin-webpack-stats"
import { sveltePreprocess } from "svelte-preprocess"
import lightning from "unplugin-lightningcss/rollup"

const noise = new Set(["index", "dist", "src", "source", "distribution", "node_modules", ".pnpm", "main", "esm", "cjs", "build", "built"])

/** @type {import('rollup').RollupOptions} */
const rollup = {
  input: {
    "options": "./src/options.tsx",
    "welcome": "./src/welcome.svelte",
    "background": "./src/background.ts",
    "content-script": "./src/content-script.ts",
    "index": "./src/index.ts",
    // Features
    "preview-results": "./src/preview-results.tsx",
  },
  output: {
    dir: "distribution/assets",
    preserveModules: true,
    preserveModulesRoot: "src",
    assetFileNames: "[name][extname]", // For CSS
    entryFileNames(chunkInfo) {
      if (chunkInfo.name.includes("node_modules")) {
        const cleanName = chunkInfo.name
          .split("/")
          .filter(part => !noise.has(part))
          .join("-")

        return `npm/${cleanName}.js`
      }

      return `${chunkInfo.name.replace("build/__snapshots__/", "")}.js`
    },
  },
  watch: {
    clearScreen: false,
  },

  // TODO: Drop after https://github.com/sindresorhus/memoize/issues/102
  context: "globalThis",

  plugins: [
    del({
      targets: ["distribution/assets"],
      runOnce: true, // `false` would be nice, but it deletes the files too early, causing two extension reloads
    }),
    lightning({
      options: {
        include: Features.Nesting,
      },
    }),
    svelte({
      compilerOptions: {
        customElement: true,
      },
      preprocess: sveltePreprocess(),
    }),
    json(),
    styles({
      mode: "extract",
      url: false,
    }),
    string({
      include: "**/*.gql",
    }),
    alias({
      entries: [
        { find: "react", replacement: "dom-chef" },
      ],
    }),
    sucrase({
      transforms: ["typescript", "jsx"],

      // Output modern JS
      disableESTransforms: true,

      // Drop `__self` in JSX https://github.com/alangpierce/sucrase/issues/232#issuecomment-468898878
      production: true,
    }),
    resolve({ browser: true }),
    commonjs(),
    copy({
      targets: [
        { src: "./src/manifest.json", dest: "distribution" },
        { src: "./src/*.+(html|png)", dest: "distribution/assets" },
      ],
    }),
    cleanup(),
  ],
}

if (process.env.RELATIVE_CI_STATS) {
  rollup.plugins.push(webpackStatsPlugin())
}

export default rollup
