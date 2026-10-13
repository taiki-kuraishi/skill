import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
    // the emitted declarations match TypeScript 6 byte for byte
    suppressWarnings: ["TypeScript 7.0 does not yet have a stable API"],
  },
  run: {
    tasks: {
      build: "vp pack",
    },
  },
});
