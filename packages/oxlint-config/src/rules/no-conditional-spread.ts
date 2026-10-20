import { defineRule } from "@oxlint/plugins";

export const noConditionalSpread = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow spreading a conditional expression into an object literal." },
    messages: {
      conditional:
        "Do not toggle properties with a conditional spread. Use an object union for the arguments and return early.",
    },
  },
  createOnce(context) {
    return {
      SpreadElement(node) {
        if (node.parent.type !== "ObjectExpression") {
          return;
        }

        if (
          node.argument.type !== "ConditionalExpression" &&
          node.argument.type !== "LogicalExpression"
        ) {
          return;
        }
        context.report({ node, messageId: "conditional" });
      },
    };
  },
});
