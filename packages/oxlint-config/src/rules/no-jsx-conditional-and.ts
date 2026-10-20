import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

/** 描画されない値だけを返す式。JSX children で `条件 && 真偽値` を書く計算は表示の出し分けではない */
// oxlint-disable-next-line kstack/no-explicit-return-type -- 再帰で自身の戻り値に依存するため型を明示する
const isBooleanExpression = (node: ESTree.Expression): boolean => {
  if (node.type === "BinaryExpression") {
    return (
      node.operator === "==" ||
      node.operator === "===" ||
      node.operator === "!=" ||
      node.operator === "!==" ||
      node.operator === "<" ||
      node.operator === "<=" ||
      node.operator === ">" ||
      node.operator === ">=" ||
      node.operator === "in" ||
      node.operator === "instanceof"
    );
  }

  if (node.type === "UnaryExpression") {
    return node.operator === "!" || node.operator === "void";
  }

  if (node.type === "CallExpression") {
    return node.callee.type === "Identifier" && node.callee.name === "Boolean";
  }

  if (node.type === "LogicalExpression") {
    return isBooleanExpression(node.left) && isBooleanExpression(node.right);
  }

  if (node.type === "Literal") {
    return typeof node.value === "boolean" || node.value === null;
  }
  return node.type === "Identifier" && node.name === "undefined";
};

export const noJsxConditionalAnd = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow conditional rendering with && inside JSX children; branch with if instead.",
    },
    messages: {
      conditional:
        "JSX children で 条件 && 表示 を書かず、状態を if で判定して分岐ごとの component を返す。",
    },
  },
  createOnce(context) {
    return {
      JSXExpressionContainer(node) {
        const { parent } = node;

        // 属性値の `disabled={busy && locked}` は表示の出し分けではないので対象外
        if (parent.type !== "JSXElement" && parent.type !== "JSXFragment") {
          return;
        }

        const { expression } = node;

        if (expression.type !== "LogicalExpression" || expression.operator !== "&&") {
          return;
        }

        if (isBooleanExpression(expression.right)) {
          return;
        }
        context.report({ node: expression, messageId: "conditional" });
      },
    };
  },
});
