import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import { functionNameOf } from "./query-hooks.ts";

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

/** 先頭が大文字の名前。component の判定に使う */
const isComponentName = (name: string | undefined) => name !== undefined && /^[A-Z]/.test(name);

/** 関数が JSX を 1 つだけ返す形か。body が 1 つの return だけなら hook・分岐・加工を持たない */
const returnedJsxOf = (node: FunctionNode) => {
  const body = node.body;

  if (body === null) {
    return undefined;
  }

  if (body.type !== "BlockStatement") {
    if (body.type === "JSXElement" || body.type === "JSXFragment") {
      return body;
    }
    return undefined;
  }

  if (body.body.length !== 1) {
    return undefined;
  }

  const [statement] = body.body;

  if (statement.type !== "ReturnStatement") {
    return undefined;
  }

  const argument = statement.argument;

  if (argument?.type === "JSXElement" || argument?.type === "JSXFragment") {
    return argument;
  }
  return undefined;
};

/** 返している JSX の名前が component か。`div` などの host element は委譲ではない */
const componentNameOf = (element: ESTree.JSXElement) => {
  const name = element.openingElement.name;

  if (name.type === "JSXIdentifier") {
    if (!isComponentName(name.name)) {
      return undefined;
    }
    return name.name;
  }

  if (name.type === "JSXMemberExpression") {
    let object: ESTree.JSXMemberExpressionObject = name.object;

    while (object.type === "JSXMemberExpression") {
      object = object.object;
    }

    if (!isComponentName(object.name)) {
      return undefined;
    }
    return name.property.name;
  }
  return undefined;
};

const hasVisibleChildren = (element: ESTree.JSXElement) =>
  element.children.some((child) => {
    if (child.type === "JSXText") {
      return child.value.trim() !== "";
    }

    if (child.type === "JSXExpressionContainer") {
      return child.expression.type !== "JSXEmptyExpression";
    }
    return true;
  });

/** 属性が props の中継だけか。呼び出し・演算・条件など「加工」が 1 つでもあれば委譲だけではない */
const isForwardingAttribute = (attribute: ESTree.JSXAttributeItem) => {
  if (attribute.type === "JSXSpreadAttribute") {
    return (
      attribute.argument.type === "Identifier" || attribute.argument.type === "MemberExpression"
    );
  }

  const value = attribute.value;

  if (value === null) {
    return true;
  }

  if (value.type !== "JSXExpressionContainer") {
    return true;
  }

  const expression = value.expression;

  return (
    expression.type === "Identifier" ||
    expression.type === "MemberExpression" ||
    expression.type === "Literal" ||
    expression.type === "JSXEmptyExpression" ||
    expression.type === "JSXElement" ||
    expression.type === "JSXFragment"
  );
};

export const noDelegationOnlyComponent = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow a component that only renders another component without branching, hooks, or prop processing.",
    },
    messages: {
      delegation:
        "Do not create a wrapper that only renders another component. Use that component directly at the call site.",
    },
  },
  createOnce(context) {
    const check = (node: FunctionNode) => {
      if (node.generator || !isComponentName(functionNameOf(node))) {
        return;
      }

      const jsx = returnedJsxOf(node);

      if (jsx?.type !== "JSXElement" || hasVisibleChildren(jsx) || !componentNameOf(jsx)) {
        return;
      }

      if (!jsx.openingElement.attributes.every(isForwardingAttribute)) {
        return;
      }
      context.report({ node: jsx, messageId: "delegation" });
    };

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
