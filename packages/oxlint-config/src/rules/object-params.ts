import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

export const objectParams = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Require functions with several parameters to take a single object." },
    messages: {
      positional: "Use a single object parameter instead of multiple positional parameters.",
    },
  },
  createOnce(context) {
    const check = (node: ESTree.Function | ESTree.ArrowFunctionExpression) => {
      const params = node.params.filter(
        (param) => param.type !== "Identifier" || param.name !== "this",
      );

      if (params.length < 2) {
        return;
      }

      const parent = node.parent;

      // A callback receives arguments in the order its caller defines, so it cannot take one object
      if (
        (parent.type === "CallExpression" || parent.type === "NewExpression") &&
        parent.callee !== node
      ) {
        return;
      }
      context.report({ node, messageId: "positional" });
    };

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
