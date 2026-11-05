import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      test: "bun test test",
    },
  },
});
