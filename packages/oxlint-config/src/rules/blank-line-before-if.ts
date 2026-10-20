import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

const previousStatementOf = (node: ESTree.IfStatement) => {
  const parent = node.parent;

  if (parent.type === "SwitchCase") {
    return parent.consequent[parent.consequent.indexOf(node) - 1];
  }

  if (
    parent.type === "Program" ||
    parent.type === "BlockStatement" ||
    parent.type === "StaticBlock"
  ) {
    return parent.body[parent.body.indexOf(node) - 1];
  }
  return undefined;
};

export const blankLineBeforeIf = defineRule({
  meta: {
    type: "layout",
    docs: { description: "Require a blank line before if statements that do not open a block." },
    messages: {
      missing: "if の前に空行を 1 行入れる。if にコメントを付けるなら、空行はコメントの前に置く。",
    },
  },
  createOnce(context) {
    return {
      IfStatement(node) {
        const previous = previousStatementOf(node);

        if (!previous) {
          return;
        }

        // A comment on the previous statement's last line belongs to that statement, not to this if
        const leadingCommentLines = context.sourceCode
          .getCommentsBefore(node)
          .map((comment) => comment.loc.start.line)
          .filter((line) => line > previous.loc.end.line);
        const firstLine = Math.min(node.loc.start.line, ...leadingCommentLines);

        if (firstLine - previous.loc.end.line > 1) {
          return;
        }
        context.report({ node, messageId: "missing" });
      },
    };
  },
});
