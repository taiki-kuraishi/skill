import { defineRule } from "@oxlint/plugins";
import { propertyNameOf, queryLikeHookNameOf } from "./query-hooks.ts";

export const noNegatedData = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow negating query data to test for absence; compare with null instead.",
    },
    messages: {
      negated:
        "Use data === null to check for missing data, not !data, which also matches undefined while loading.",
    },
  },
  createOnce(context) {
    const scopes: Set<string>[] = [];
    const currentScope = () => scopes.at(-1);

    const enter = () => scopes.push(new Set());
    const exit = () => scopes.pop();

    return {
      Program() {
        scopes.length = 0;
      },
      FunctionDeclaration: enter,
      FunctionExpression: enter,
      ArrowFunctionExpression: enter,
      "FunctionDeclaration:exit": exit,
      "FunctionExpression:exit": exit,
      "ArrowFunctionExpression:exit": exit,
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || node.init?.type !== "CallExpression") {
          return;
        }

        if (!queryLikeHookNameOf(node.init)) {
          return;
        }

        for (const property of node.id.properties) {
          if (property.type !== "Property" || property.computed) {
            continue;
          }

          if (propertyNameOf(property.key) !== "data" || property.value.type !== "Identifier") {
            continue;
          }
          currentScope()?.add(property.value.name);
        }
      },
      UnaryExpression(node) {
        if (node.operator !== "!" || node.argument.type !== "Identifier") {
          return;
        }

        const name = node.argument.name;

        if (name === "data" || scopes.some((scope) => scope.has(name))) {
          context.report({ node, messageId: "negated" });
        }
      },
    };
  },
});
