import { defineRule } from "@oxlint/plugins";

export const noConditionalSpread = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow spreading a conditional expression into an object literal." },
    messages: {
      conditional:
        "プロパティの有無を spread で切り替えず、引数を object union に分けて早期 return する。",
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
