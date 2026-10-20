import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

/** 実装本体を持つ関数だけを返す。overload の宣言と `declare` は数えない */
const implementationOf = (node: ESTree.Node | null | undefined) => {
  if (
    node?.type === "FunctionDeclaration" ||
    node?.type === "FunctionExpression" ||
    node?.type === "TSDeclareFunction" ||
    node?.type === "TSEmptyBodyFunctionExpression"
  ) {
    if (node.body === null || node.declare === true) {
      return undefined;
    }
    return node;
  }

  if (node?.type === "ArrowFunctionExpression") {
    return node;
  }
  return undefined;
};

export const oneFunctionPerTsx = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow multiple top-level functions in one .tsx file; split helpers out.",
    },
    messages: {
      multiple:
        ".tsx のトップレベルには関数を 1 つだけ置き、補助のコンポーネントや関数は別ファイルへ出す。",
    },
  },
  createOnce(context) {
    return {
      Program(node) {
        if (!context.filename.endsWith(".tsx")) {
          return;
        }

        let count = 0;

        const countFunction = (fn: ESTree.Node | undefined) => {
          if (!fn) {
            return;
          }
          count += 1;

          if (count > 1) {
            context.report({ node: fn, messageId: "multiple" });
          }
        };

        const countDeclaration = (declaration: ESTree.Node | null | undefined) => {
          if (declaration?.type === "VariableDeclaration") {
            for (const declarator of declaration.declarations) {
              countFunction(implementationOf(declarator.init));
            }
            return;
          }
          countFunction(implementationOf(declaration));
        };

        for (const statement of node.body) {
          if (
            statement.type === "FunctionDeclaration" ||
            statement.type === "VariableDeclaration"
          ) {
            countDeclaration(statement);
            continue;
          }

          if (
            statement.type === "ExportNamedDeclaration" ||
            statement.type === "ExportDefaultDeclaration"
          ) {
            countDeclaration(statement.declaration);
          }
        }
      },
    };
  },
});
