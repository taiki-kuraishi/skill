import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    dts: true,
  },
  run: {
    tasks: {
      build: "vp pack",
    },
  },
});
