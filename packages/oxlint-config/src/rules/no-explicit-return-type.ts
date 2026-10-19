import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

export const noExplicitReturnType = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow return type annotations that TypeScript can infer." },
    messages: {
      explicit:
        "戻り値の型を書かず、TypeScript の導出に任せる。導出できない再帰関数などは disable コメントで理由を残す。",
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
