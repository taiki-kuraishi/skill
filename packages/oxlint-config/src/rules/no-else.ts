import { defineRule } from "@oxlint/plugins";

export const noElse = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow else; return early instead." },
    messages: {
      else: "else を使わず、異常系をガード句として先に return する。",
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
