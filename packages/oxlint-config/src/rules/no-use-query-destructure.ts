import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  createJsxFunctionTracker,
  enclosingFunctionOf,
  functionNameOf,
  plainQueryHookNameOf,
} from "./query-hooks.ts";

/** package の query hook の名前（`use-todos-query.ts` は `useTodosQuery`） */
const queryHookFunctionName = /^use[A-Z][A-Za-z0-9]*Quer(?:y|ies)$/;

export const noUseQueryDestructure = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow consuming a useQuery result in a query hook; return it as-is.",
    },
    messages: {
      destructure:
        "package の query hook は useQuery の結果をそのまま返す（return useQuery(...)）。app の hook は package の hook を呼び、読み込み中の判定と整形だけをする。",
    },
  },
  createOnce(context) {
    const declarators: ESTree.Node[] = [];
    const jsxFunctions = createJsxFunctionTracker();

    return {
      ...jsxFunctions.visitors,
      Program() {
        declarators.length = 0;
        jsxFunctions.reset();
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || node.init?.type !== "CallExpression") {
          return;
        }

        if (plainQueryHookNameOf(node.init)) {
          declarators.push(node);
        }
      },
      "Program:exit"() {
        for (const declarator of declarators) {
          const fn = enclosingFunctionOf(declarator);

          // 層は構文から決まらないので、名前が package の query hook の形のときだけ指摘する。
          // component が query を読む形は no-query-in-component が指摘する
          if (fn === undefined || jsxFunctions.contains(fn)) {
            continue;
          }

          if (!queryHookFunctionName.test(functionNameOf(fn) ?? "")) {
            continue;
          }
          context.report({ node: declarator, messageId: "destructure" });
        }
      },
    };
  },
});
