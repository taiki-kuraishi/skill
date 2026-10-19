import type { OxlintConfig } from "oxlint";

export const typescript = {
  jsPlugins: ["@taiki-kuraishi/oxlint-config/plugin"],
  rules: {
    // 利用側が categories.restriction を有効にしても、this を使わない private method などを指させない
    "class-methods-use-this": "off",
    "no-ternary": "error",
    // better-result の class 定義 `extends TaggedError("XxxError")<...>()` を、new 無しで Error を作る呼び出しとして指させない
    "unicorn/throw-new-error": "off",
    "kstack/blank-line-before-if": "error",
    "kstack/no-conditional-spread": "error",
    "kstack/no-else": "error",
    "kstack/no-explicit-return-type": "error",
    "kstack/object-params": "error",
  },
} satisfies OxlintConfig;

export const layerdArchitecture = {
  jsPlugins: ["@taiki-kuraishi/oxlint-config/plugin"],
  rules: {
    "kstack/use-case-steps": "error",
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

export const testing = {
  plugins: ["vitest"],
  rules: {
    // plugins に vitest を入れると有効になる correctness の既定ルールは、SKILL に無い規約なので切る
    "vitest/expect-expect": "off",
    "vitest/hoisted-apis-on-top": "off",
    "vitest/no-conditional-expect": "off",
    "vitest/no-conditional-tests": "off",
    "vitest/no-disabled-tests": "off",
    "vitest/no-focused-tests": "off",
    "vitest/no-standalone-expect": "off",
    "vitest/prefer-snapshot-hint": "off",
    "vitest/require-awaited-expect-poll": "off",
    "vitest/require-local-test-context-for-concurrent-snapshots": "off",
    "vitest/require-mock-type-parameters": "off",
    "vitest/require-to-throw-message": "off",
    "vitest/valid-describe-callback": "off",
    "vitest/valid-expect": "off",
    "vitest/valid-expect-in-promise": "off",
    "vitest/warn-todo": "off",
    "vitest/valid-title": [
      "error",
      {
        // valid-title の既定の検査（前後の空白、文字列でないタイトル）は SKILL に無い規約なので切る
        ignoreSpaces: true,
        ignoreTypeOfDescribeName: true,
        ignoreTypeOfTestName: true,
        mustMatch: [
          "[\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}]",
          "テスト名は日本語で書く（kstack-testing）。",
        ],
      },
    ],
  },
} satisfies OxlintConfig;
