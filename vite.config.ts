import { defineConfig } from "vite-plus";
import { typescript } from "./packages/oxlint-config/src/index.ts";

export default defineConfig({
  lint: {
    extends: [typescript],
    ignorePatterns: ["**/dist/**"],
  },
  fmt: {
    // both formatters would rewrite these files and disagree on the result
    ignorePatterns: ["**/*.{md,json,jsonc,yml,yaml,toml}", "**/dist/**"],
  },
  run: {
    tasks: {
      lint: "vp lint --deny-warnings",
      fmt: "vp fmt",
      "fmt-check": "vp fmt --check",
      "type-check": "tsc --noEmit",
    },
  },
});
