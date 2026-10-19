import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { propertyNameOf } from "./query-hooks.ts";

/** Use case とみなす class 名の末尾。構文から use case かどうかは決められないので、命名を手掛かりにする */
const useCaseClassSuffix = "UseCase";

const docStepPattern = /^(?<number>\d+)\.\s*(?<text>.+)$/;
const bodyStepPattern = /^Step (?<number>\d+):\s*(?<text>.+)$/;

/** 本体を持つ `execute` の method / property。宣言だけの overload は doc も step も書けないので対象外 */
const executeMemberOf = (node: ESTree.Class) => {
  for (const element of node.body.body) {
    if (element.type !== "MethodDefinition" && element.type !== "PropertyDefinition") {
      continue;
    }

    if (propertyNameOf(element.key) !== "execute") {
      continue;
    }

    const { value } = element;

    if (value?.type === "ArrowFunctionExpression" || value?.type === "FunctionExpression") {
      return element;
    }
  }
  return undefined;
};

/** Doc comment の要約行と、`1. ...` の形の番号付き step。step より後ろの行は要約にしない */
const parseDocOf = (comment: ESTree.Comment) => {
  const steps: { number: number; text: string }[] = [];
  let summary: string | undefined = undefined;

  for (const rawLine of comment.value.split("\n")) {
    const line = rawLine
      .trim()
      .replace(/^\*\s?/, "")
      .trim();
    const groups = docStepPattern.exec(line)?.groups;

    if (groups) {
      steps.push({ number: Number(groups.number), text: groups.text.trim() });
      continue;
    }

    if (steps.length === 0 && summary === undefined && line !== "" && !line.startsWith("@")) {
      summary = line;
    }
  }
  return { summary, steps };
};

/** `execute` の中の `// Step N: ...` コメントを本文の順に返す */
const bodyStepsOf = ({
  comments,
  member,
}: {
  comments: readonly ESTree.Comment[];
  member: ESTree.Node;
}) => {
  const steps: { number: number; text: string; comment: ESTree.Comment }[] = [];

  for (const comment of comments) {
    if (
      comment.type !== "Line" ||
      comment.range[0] < member.range[0] ||
      comment.range[1] > member.range[1]
    ) {
      continue;
    }

    const groups = bodyStepPattern.exec(comment.value.trim())?.groups;

    if (groups) {
      steps.push({ number: Number(groups.number), text: groups.text.trim(), comment });
    }
  }
  return steps;
};

export const useCaseSteps = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Require numbered steps in the execute doc comment and matching step comments.",
    },
    messages: {
      missingDoc:
        "use case の execute には、何を処理するかの 1 行と番号付きの step を並べた doc comment を書く。",
      missingSteps: "doc comment に処理の流れを番号付きで並べる（`1. ...` の形）。",
      missingSummary: "doc comment の番号付き step の前に、何を処理するかの 1 行を書く。",
      missingBodyStep:
        "doc の step {{number}} に対応する `// Step {{number}}: ...` を、本文の step の先頭に doc と同じ文言で書く。",
      mismatch: "本文の `// Step N:` は doc の step と番号・文言を揃える。",
      missingBlankLine: "step の間は空行で区切る。",
    },
  },
  createOnce(context) {
    const check = (node: ESTree.Class) => {
      const className = node.id?.name;

      if (className === undefined || !className.endsWith(useCaseClassSuffix)) {
        return;
      }

      const member = executeMemberOf(node);

      if (member === undefined) {
        return;
      }

      const doc = context.sourceCode
        .getCommentsBefore(member)
        .findLast(
          (comment) =>
            comment.type === "Block" &&
            comment.value.startsWith("*") &&
            comment.loc.end.line === member.loc.start.line - 1,
        );

      if (doc === undefined) {
        context.report({ node: member, messageId: "missingDoc" });
        return;
      }

      const { summary, steps } = parseDocOf(doc);

      if (steps.length === 0) {
        context.report({ node: member, messageId: "missingSteps" });
        return;
      }

      if (summary === undefined) {
        context.report({ node: member, messageId: "missingSummary" });
      }

      const bodySteps = bodyStepsOf({ comments: context.sourceCode.getAllComments(), member });
      const bodyNumbers = new Set(bodySteps.map((step) => step.number));

      for (const step of bodySteps) {
        const docStep = steps.find((each) => each.number === step.number);

        if (docStep === undefined || docStep.text !== step.text) {
          context.report({ node: step.comment, messageId: "mismatch" });
        }
      }

      for (const step of steps) {
        if (bodyNumbers.has(step.number)) {
          continue;
        }
        context.report({
          node: member,
          messageId: "missingBodyStep",
          data: { number: step.number },
        });
      }

      for (const [index, step] of bodySteps.entries()) {
        // 1 つ目の step は doc の直後（本体の先頭）に来るので、空行を要求するのは 2 つ目から
        const lineAbove = context.sourceCode.lines[step.comment.loc.start.line - 2] ?? "";

        if (index > 0 && lineAbove.trim() !== "") {
          context.report({ node: step.comment, messageId: "missingBlankLine" });
        }
      }
    };

    return {
      ClassDeclaration: check,
      ClassExpression: check,
    };
  },
});
