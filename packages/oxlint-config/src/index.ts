import type { OxlintConfig } from "oxlint";

export const typescript = {
  rules: {
    "no-else-return": ["error", { allowElseIf: false }],
    "no-ternary": "error",
  },
} satisfies OxlintConfig;
