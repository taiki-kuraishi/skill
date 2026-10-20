import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

/** `test` に付けて test のまま扱う member。`test.beforeEach` などの hook と `test.extend` は対象外 */
export const testMembers: Record<string, true> = {
  concurrent: true,
  fail: true,
  fixme: true,
  only: true,
  parallel: true,
  sequential: true,
  skip: true,
  slow: true,
  todo: true,
};

interface Call {
  node: ESTree.CallExpression;
  kind: "describe" | "test";
  title: string;
}

const staticTitleOf = (argument: ESTree.Argument | undefined) => {
  if (argument?.type === "Literal" && typeof argument.value === "string") {
    return argument.value;
  }

  if (argument?.type === "TemplateLiteral" && argument.expressions.length === 0) {
    return argument.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
};

/** `test.describe.skip(...)` → `{ root: "test", members: ["describe", "skip"] }` */
export const memberChainOf = (callee: ESTree.Expression) => {
  const members: string[] = [];
  let current = callee;

  while (current.type === "MemberExpression" && !current.computed) {
    members.unshift(current.property.name);
    current = current.object;
  }

  if (current.type !== "Identifier") {
    return undefined;
  }
  return { root: current.name, members };
};

export const vrtTestName = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require English VRT test names with a Japanese comment on the line above each test.",
    },
    messages: {
      notEnglish:
        "Write VRT test and describe names in English. Put Japanese descriptions in comments above the tests (kstack-playwright).",
      missingJapanese:
        "Add a Japanese comment on the line immediately above each VRT test describing what it captures (kstack-playwright).",
    },
  },
  createOnce(context) {
    const testNames = new Set<string>();
    const describeNames = new Set<string>();
    const calls: Call[] = [];
    let hasScreenshot = false;

    return {
      Program() {
        testNames.clear();
        describeNames.clear();
        calls.length = 0;
        hasScreenshot = false;
      },
      ImportDeclaration(node) {
        if (node.source.value !== "@playwright/test") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            continue;
          }

          if (specifier.imported.type === "Identifier") {
            if (specifier.imported.name === "test") {
              testNames.add(specifier.local.name);
            }

            if (specifier.imported.name === "describe") {
              describeNames.add(specifier.local.name);
            }
          }
        }
      },
      Identifier(node) {
        if (node.name === "toHaveScreenshot") {
          hasScreenshot = true;
        }
      },
      CallExpression(node) {
        const chain = memberChainOf(node.callee);

        if (!chain) {
          return;
        }

        const isDescribe =
          describeNames.has(chain.root) ||
          (testNames.has(chain.root) && chain.members.includes("describe"));
        const isTest =
          testNames.has(chain.root) &&
          chain.members.every((member) => testMembers[member] === true);

        if (!isDescribe && !isTest) {
          return;
        }

        const title = staticTitleOf(node.arguments[0]);

        if (title === undefined) {
          return;
        }

        if (isDescribe) {
          calls.push({ node, kind: "describe", title });
          return;
        }
        calls.push({ node, kind: "test", title });
      },
      "Program:exit"() {
        // `toHaveScreenshot` を呼ばないファイルは VRT ではない
        if (!hasScreenshot) {
          return;
        }

        for (const call of calls) {
          if (japanese.test(call.title)) {
            context.report({ node: call.node.arguments[0] ?? call.node, messageId: "notEnglish" });
            continue;
          }

          if (
            call.kind === "test" &&
            !context.sourceCode
              .getCommentsBefore(call.node)
              .some(
                (comment) =>
                  comment.loc.end.line === call.node.loc.start.line - 1 &&
                  japanese.test(comment.value),
              )
          ) {
            context.report({
              node: call.node.arguments[0] ?? call.node,
              messageId: "missingJapanese",
            });
          }
        }
      },
    };
  },
});
