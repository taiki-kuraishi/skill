import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { createJsxFunctionTracker, propertyNameOf, queryHookNameOf } from "./query-hooks.ts";

const loadingFlagNames: Record<string, true> = {
  isFetching: true,
  isLoading: true,
  isPending: true,
  isRefetching: true,
};

interface Frame {
  calls: ESTree.CallExpression[];
  dataNames: Set<string>;
  loading: boolean;
}

const isUndefined = (node: ESTree.Node) => node.type === "Identifier" && node.name === "undefined";

export const noQueryInComponent = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow deciding loading state or reading query data in a component; return the display shape from a hook.",
    },
    messages: {
      component:
        "component では query を読まない。view の hook（hooks/use-<view>.ts）が読み込み中を判定し、表示の形（status など）で返す。",
    },
  },
  createOnce(context) {
    const frames: Frame[] = [];
    const jsxFunctions = createJsxFunctionTracker();
    const currentFrame = () => frames.at(-1);

    const enter = () => frames.push({ calls: [], dataNames: new Set(), loading: false });

    const exit = (node: ESTree.Function | ESTree.ArrowFunctionExpression) => {
      const frame = frames.pop();

      // Component が data の中身を読む・読み込み中を判定したときだけ指摘する。
      // `data === null` の確認だけ（セッションの有無を見る gate）は kstack-tanstack-router の例なので残す
      if (!frame?.loading || !jsxFunctions.contains(node)) {
        return;
      }

      for (const call of frame.calls) {
        context.report({ node: call, messageId: "component" });
      }
    };

    return {
      ...jsxFunctions.visitors,
      Program() {
        frames.length = 0;
        jsxFunctions.reset();
      },
      FunctionDeclaration: enter,
      FunctionExpression: enter,
      ArrowFunctionExpression: enter,
      "FunctionDeclaration:exit": exit,
      "FunctionExpression:exit": exit,
      "ArrowFunctionExpression:exit": exit,
      CallExpression(node) {
        if (queryHookNameOf(node)) {
          currentFrame()?.calls.push(node);
        }
      },
      VariableDeclarator(node) {
        const frame = currentFrame();

        if (!frame || node.id.type !== "ObjectPattern" || node.init?.type !== "CallExpression") {
          return;
        }

        if (!queryHookNameOf(node.init)) {
          return;
        }

        for (const property of node.id.properties) {
          if (property.type !== "Property" || property.computed) {
            continue;
          }

          const key = propertyNameOf(property.key);

          if (key === undefined || property.value.type !== "Identifier") {
            continue;
          }

          if (key === "data") {
            frame.dataNames.add(property.value.name);
          }

          if (loadingFlagNames[key] === true) {
            frame.loading = true;
          }
        }
      },
      MemberExpression(node) {
        const frame = currentFrame();

        if (frame && node.object.type === "Identifier" && frame.dataNames.has(node.object.name)) {
          frame.loading = true;
        }
      },
      BinaryExpression(node) {
        const frame = currentFrame();

        if (!frame || (node.operator !== "===" && node.operator !== "!==")) {
          return;
        }

        const leftIsUndefined = isUndefined(node.left);
        const rightIsUndefined = isUndefined(node.right);

        if (!leftIsUndefined && !rightIsUndefined) {
          return;
        }

        let other = node.left;

        if (leftIsUndefined) {
          other = node.right;
        }

        if (other.type === "Identifier" && frame.dataNames.has(other.name)) {
          frame.loading = true;
        }
      },
    };
  },
});
