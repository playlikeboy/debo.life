// Bundles the API into one file so production does not need node_modules or a TypeScript
// loader. The shared packages in ../packages are TypeScript source with extensionless
// imports; plain `node dist` cannot load them, but esbuild resolves and compiles them.
//   node scripts/bundle-server.mjs   -> dist/server.mjs (API) and dist/worker.mjs (task worker)
import { build } from "esbuild";

await build({
  entryPoints: { server: "apps/server/src/index.ts", worker: "apps/server/src/worker-entry.ts" },
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  // Some dependencies are CommonJS and call require() or use __dirname inside the ESM bundle.
  banner: {
    js: [
      'import { createRequire as __createRequire } from "node:module";',
      'import { fileURLToPath as __fileURLToPath } from "node:url";',
      'import { dirname as __dirname_ } from "node:path";',
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __dirname_(__filename);",
    ].join("\n"),
  },
  // pg-native is an optional add-on of pg that is never installed here.
  external: ["pg-native"],
  logLevel: "info",
});
