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

export const react = {
  jsPlugins: ["@taiki-kuraishi/oxlint-config/plugin"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@tanstack/react-query",
            importNames: ["useSuspenseInfiniteQuery", "useSuspenseQueries", "useSuspenseQuery"],
            message:
              "useSuspenseQuery を使わず useQuery で読み、読み込み中は view の hook が data === undefined から判定する（kstack-react）。",
          },
        ],
      },
    ],
    "kstack/no-negated-data": "error",
    "kstack/no-query-error": "error",
    "kstack/no-query-in-component": "error",
  },
} satisfies OxlintConfig;

export const tanstackQuery = {
  jsPlugins: ["@taiki-kuraishi/oxlint-config/plugin"],
  rules: {
    "kstack/no-unspread-options": "error",
    "kstack/no-use-query-destructure": "error",
    "kstack/throw-on-error-placement": "error",
  },
} satisfies OxlintConfig;
