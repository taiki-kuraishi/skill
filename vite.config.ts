import { defineConfig } from "vite-plus";
import { typescript } from "./packages/oxlint-config/src/index.ts";

export default defineConfig({
  lint: {
    extends: [typescript],
    ignorePatterns: ["**/dist/**"],
  },
  fmt: {
    // Both formatters would rewrite these files and disagree on the result
    ignorePatterns: ["**/*.{md,json,jsonc,yml,yaml,toml}", "**/dist/**"],
  },
  run: {
    tasks: {
      lint: {
        command: "vp lint --deny-warnings",
        // The jsPlugins option loads the plugin from the package's dist, which only exists after a build
        dependsOn: ["@taiki-kuraishi/oxlint-config#build"],
      },
      fmt: "vp fmt",
      "fmt-check": "vp fmt --check",
      "type-check": "tsc --noEmit",
    },
  },
});
