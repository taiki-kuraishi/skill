import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  createJsxFunctionTracker,
  enclosingFunctionOf,
  propertyNameOf,
  queryLikeHookNameOf,
} from "./query-hooks.ts";

const errorNames: Record<string, true> = {
  error: true,
  failureReason: true,
  isError: true,
};

export const noQueryError = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow branching on a query error in a hook; let the Error Boundary handle it.",
    },
    messages: {
      error:
        "Do not branch on error in hooks. Configure QueryClient defaults to throw failed queries without data to an Error Boundary.",
    },
  },
  createOnce(context) {
    const properties: ESTree.Node[] = [];
    const jsxFunctions = createJsxFunctionTracker();

    return {
      ...jsxFunctions.visitors,
      Program() {
        properties.length = 0;
        jsxFunctions.reset();
      },
      Property(node) {
        if (node.parent.type !== "ObjectPattern" || node.computed) {
          return;
        }

        const name = propertyNameOf(node.key);

        if (name === undefined || errorNames[name] !== true) {
          return;
        }

        const declarator = node.parent.parent;

        if (
          declarator.type !== "VariableDeclarator" ||
          declarator.init?.type !== "CallExpression"
        ) {
          return;
        }

        if (!queryLikeHookNameOf(declarator.init)) {
          return;
        }
        properties.push(node);
      },
      "Program:exit"() {
        for (const property of properties) {
          const fn = enclosingFunctionOf(property);

          // Component が query を読む形は no-query-in-component が指摘する
          if (fn === undefined || jsxFunctions.contains(fn)) {
            continue;
          }
          context.report({ node: property, messageId: "error" });
        }
      },
    };
  },
});
