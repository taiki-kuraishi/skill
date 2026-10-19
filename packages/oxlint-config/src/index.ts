import type { OxlintConfig } from "oxlint";

export const typescript = {
  jsPlugins: ["@taiki-kuraishi/oxlint-config/plugin"],
  categories: {
    correctness: "error",
    perf: "error",
    restriction: "error",
    style: "error",
    suspicious: "error",
  },
  rules: {
    // `categories` で一括有効になるが SKILL の規約と逆を向く、または規約に無い書き方を強いるルールを切る（理由は README）
    "class-methods-use-this": "off",
    "eslint/max-statements": "off",
    "eslint/sort-imports": "off",
    "func-names": "off",
    "func-style": "off",
    "id-length": "off",
    "max-params": "off",
    "new-cap": "off",
    "no-console": "off",
    "no-continue": "off",
    "no-duplicate-imports": "off",
    "no-empty-function": "off",
    "no-magic-numbers": "off",
    "no-ternary": "error",
    "no-undefined": "off",
    "no-void": "off",
    "object-shorthand": "off",
    "one-var": "off",
    "oxc/no-async-await": "off",
    "oxc/no-optional-chaining": "off",
    "oxc/no-rest-spread-properties": "off",
    "prefer-destructuring": "off",
    "sort-keys": "off",
    "typescript/explicit-function-return-type": "off",
    "typescript/explicit-module-boundary-types": "off",
    "typescript/no-extraneous-class": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/no-anonymous-default-export": "off",
    "unicorn/no-null": "off",
    "unicorn/no-static-only-class": "off",
    "unicorn/prefer-ternary": "off",
    "unicorn/require-module-specifiers": "off",
    // `better-result` の class 定義 `extends TaggedError("XxxError")<...>()` を、new 無しで Error を作る呼び出しとして指させない
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
    // `plugins` に vitest を入れると有効になる correctness の既定ルールは、SKILL に無い規約なので切る
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
        // `valid-title` の既定の検査（前後の空白、文字列でないタイトル）は SKILL に無い規約なので切る
        ignoreSpaces: true,
        ignoreTypeOfDescribeName: true,
        ignoreTypeOfTestName: true,
        // 種別ごとの値は文字列しか受け付けず、配列で渡した message は黙って無視される（oxlint 1.88）。
        // そのため SKILL 名は verbose mode のコメントとして pattern に埋め、指摘の文面に出す
        mustMatch: {
          it: "(?x)[\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}] # テスト名は日本語で書く（kstack-testing）。",
          test: "(?x)[\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}] # テスト名は日本語で書く（kstack-testing）。",
        },
        mustNotMatch: {
          describe:
            "(?x)[\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}] # describe は英語で書く（kstack-testing）。",
        },
      },
    ],
  },
} satisfies OxlintConfig;

export const playwright = {
  jsPlugins: ["@taiki-kuraishi/oxlint-config/plugin"],
  rules: {
    "kstack/vrt-test-name": "error",
  },
} satisfies OxlintConfig;
