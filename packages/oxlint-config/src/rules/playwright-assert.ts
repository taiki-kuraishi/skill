import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { memberChainOf, testMembers } from "./vrt-test-name.ts";

interface Matcher {
  name: string;
  node: ESTree.CallExpression;
}

interface Range {
  end: number;
  start: number;
}

/** `expect(x).not.toBeVisible()` の `toBeVisible`。連鎖のどこかに `expect` の呼び出しがある形だけを見る */
const matcherNameOf = ({
  callee,
  expectNames,
}: {
  callee: ESTree.Expression;
  expectNames: Set<string>;
}) => {
  // oxlint-disable-next-line init-declarations -- 連鎖の一番外側の member を、ループの中で決める
  let matcher: string | undefined;
  let current = callee;

  while (current.type === "MemberExpression" && !current.computed) {
    if (matcher === undefined) {
      matcher = current.property.name;
    }
    current = current.object;
  }

  if (matcher === undefined || current.type !== "CallExpression") {
    return undefined;
  }

  const chain = memberChainOf(current.callee);

  if (chain === undefined || !expectNames.has(chain.root)) {
    return undefined;
  }
  return matcher;
};

export const playwrightAssert = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Allow only toHaveURL in E2E tests and only toHaveScreenshot in VRT tests.",
    },
    messages: {
      unsupported:
        "assert は E2E では toHaveURL だけ、VRT では toHaveScreenshot だけにする。toHaveScreenshot を直接呼ばない test は E2E と VRT を構文から区別できない（kstack-playwright）。",
      vrt: "VRT の assert は toHaveScreenshot だけにする。撮影する状態までの待機は locator.waitFor() で行う（kstack-playwright）。",
    },
  },
  createOnce(context) {
    const testNames = new Set<string>();
    const expectNames = new Set<string>();
    const testRanges: Range[] = [];
    const matchers: Matcher[] = [];

    return {
      Program() {
        testNames.clear();
        expectNames.clear();
        testRanges.length = 0;
        matchers.length = 0;
      },
      ImportDeclaration(node) {
        if (node.source.value !== "@playwright/test") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.imported.type !== "Identifier") {
            continue;
          }

          if (specifier.imported.name === "test") {
            testNames.add(specifier.local.name);
          }

          if (specifier.imported.name === "expect") {
            expectNames.add(specifier.local.name);
          }
        }
      },
      CallExpression(node) {
        const chain = memberChainOf(node.callee);

        if (
          chain !== undefined &&
          testNames.has(chain.root) &&
          chain.members.every((member) => testMembers[member] === true)
        ) {
          const callback = node.arguments.at(-1);

          if (
            callback?.type === "ArrowFunctionExpression" ||
            callback?.type === "FunctionExpression"
          ) {
            testRanges.push({ end: callback.range[1], start: callback.range[0] });
          }
        }

        const matcher = matcherNameOf({ callee: node.callee, expectNames });

        if (matcher !== undefined) {
          matchers.push({ name: matcher, node });
        }
      },
      "Program:exit"() {
        // 範囲は test の callback ごとに閉じているので、内側から順に見ればよい
        const ascending = testRanges.toSorted((a, b) => a.start - b.start);
        // VRT かどうかは test の中の toHaveScreenshot で決める。test の外の expect は object の範囲外なので見ない
        const vrtRanges = new Set(
          matchers
            .filter((matcher) => matcher.name === "toHaveScreenshot")
            .map((matcher) =>
              ascending.findLast(
                (range) =>
                  range.start <= matcher.node.range[0] && matcher.node.range[1] <= range.end,
              ),
            )
            .filter((range) => range !== undefined),
        );

        for (const matcher of matchers) {
          const range = ascending.findLast(
            (each) => each.start <= matcher.node.range[0] && matcher.node.range[1] <= each.end,
          );

          if (range === undefined) {
            continue;
          }

          if (vrtRanges.has(range)) {
            if (matcher.name !== "toHaveScreenshot") {
              context.report({ node: matcher.node, messageId: "vrt" });
            }
            continue;
          }

          // 直接の撮影がない test は E2E と断定できないので、両方の規約を並べた汎用の指摘にする
          if (matcher.name !== "toHaveURL") {
            context.report({ node: matcher.node, messageId: "unsupported" });
          }
        }
      },
    };
  },
});
