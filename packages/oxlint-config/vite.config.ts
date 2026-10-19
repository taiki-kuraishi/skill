import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    dts: true,
    // The emitted declarations match TypeScript 6 byte for byte
    suppressWarnings: ["TypeScript 7.0 does not yet have a stable API"],
  },
  run: {
    tasks: {
      build: "vp pack",
      test: "vp test",
    },
  },
});
