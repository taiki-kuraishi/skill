import type { OxlintConfig } from "oxlint";

export const typescript = {
  jsPlugins: ["@taiki-kuraishi/oxlint-config/plugin"],
  rules: {
    "no-ternary": "error",
    "kstack/blank-line-before-if": "error",
    "kstack/no-conditional-spread": "error",
    "kstack/no-else": "error",
    "kstack/no-explicit-return-type": "error",
    "kstack/object-params": "error",
  },
} satisfies OxlintConfig;
