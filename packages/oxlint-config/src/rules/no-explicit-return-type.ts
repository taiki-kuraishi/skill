import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

export const noExplicitReturnType = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow return type annotations that TypeScript can infer." },
    messages: {
      explicit:
        "Let TypeScript infer the return type. If inference is impossible, such as for a recursive function, explain why in a disable comment.",
    },
  },
  createOnce(context) {
    const check = (node: ESTree.Function | ESTree.ArrowFunctionExpression) => {
      if (!node.returnType) {
        return;
      }

      // A type predicate is not inferred from an arbitrary body, so writing it duplicates nothing
      if (node.returnType.typeAnnotation.type === "TSTypePredicate") {
        return;
      }
      context.report({ node: node.returnType, messageId: "explicit" });
    };

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
