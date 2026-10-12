import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/plugin.ts"],
    dts: true,
  },
  run: {
    tasks: {
      build: "vp pack",
      test: "vp test",
    },
  },
});
