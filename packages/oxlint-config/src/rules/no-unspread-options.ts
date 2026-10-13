import { defineRule } from "@oxlint/plugins";
import { enclosingFunctionOf, optionsHookNameOf } from "./query-hooks.ts";

export const noUnspreadOptions = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Require query hooks with an options parameter to spread it into the hook call.",
    },
    messages: {
      unspread:
        "画面ごとに変わる query の options（placeholderData など）は options で受けて展開する（{ ...options }）。",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!optionsHookNameOf(node)) {
          return;
        }

        const fn = enclosingFunctionOf(node);

        if (fn === undefined) {
          return;
        }

        const takesOptions = fn.params.some(
          (param) => param.type === "Identifier" && param.name === "options",
        );
        const [first] = node.arguments;

        if (!takesOptions || first?.type !== "ObjectExpression") {
          return;
        }

        // `...options` のほか、`...(options ?? {})` の null 合体も options の展開として扱う
        const spreadsOptions = first.properties.some(
          (property) =>
            property.type === "SpreadElement" &&
            ((property.argument.type === "Identifier" && property.argument.name === "options") ||
              (property.argument.type === "LogicalExpression" &&
                property.argument.left.type === "Identifier" &&
                property.argument.left.name === "options")),
        );

        if (!spreadsOptions) {
          context.report({ node, messageId: "unspread" });
        }
      },
    };
  },
});
