import { defineRule } from "@oxlint/plugins";

export const noElse = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow else; return early instead." },
    messages: {
      else: "Do not use else. Handle exceptional cases with guard clauses and return early.",
    },
  },
  createOnce(context) {
    return {
      IfStatement(node) {
        if (!node.alternate) {
          return;
        }
        context.report({ node: node.alternate, messageId: "else" });
      },
    };
  },
});
