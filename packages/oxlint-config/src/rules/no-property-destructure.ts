import { defineRule } from "@oxlint/plugins";

export const noPropertyDestructure = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow destructuring an object that is already referable by name just to read its properties.",
    },
    messages: {
      destructure:
        "Do not destructure objects accessible by name, such as arguments, this, or env. Read properties from the original object, as in args.update.userId.",
    },
  },
  createOnce(context) {
    return {
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || node.init === null) {
          return;
        }

        // `const { id, ...rest } = obj` はプロパティの読み出しではなく残りの取り出しなので除く
        if (node.id.properties.some((property) => property.type === "RestElement")) {
          return;
        }

        const init = node.init;

        // 関数呼び出し・await の戻り値を受ける分割代入は対象外
        if (
          init.type !== "Identifier" &&
          init.type !== "MemberExpression" &&
          init.type !== "ThisExpression"
        ) {
          return;
        }
        context.report({ node, messageId: "destructure" });
      },
    };
  },
});
