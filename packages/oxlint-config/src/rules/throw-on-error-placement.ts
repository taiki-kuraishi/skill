import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";
import {
  enclosingFunctionOf,
  functionNameOf,
  propertyNameOf,
  queryLikeHookNameOf,
} from "./query-hooks.ts";

/** Hook ではないが、query の options を作る関数 */
const queryOptionsFactoryNames: Record<string, true> = {
  infiniteQueryOptions: true,
  queryOptions: true,
};

/** Query の options を受け取る呼び出しの名前。`use*Query` 系の hook も含める */
const queryOptionsCallNameOf = (node: ESTree.CallExpression) => {
  const callee = node.callee;

  if (callee.type !== "Identifier") {
    return undefined;
  }

  if (queryOptionsFactoryNames[callee.name] === true) {
    return callee.name;
  }
  return queryLikeHookNameOf(node);
};

/** `new QueryClient({ defaultOptions: { queries: {...} } })` の `queries` の object か */
const isDefaultOptionsQueries = (node: ESTree.ObjectExpression) => {
  const queries = node.parent;

  if (
    queries.type !== "Property" ||
    queries.computed ||
    propertyNameOf(queries.key) !== "queries"
  ) {
    return false;
  }

  const defaultOptions = queries.parent;

  if (defaultOptions.type !== "ObjectExpression") {
    return false;
  }

  const defaults = defaultOptions.parent;

  if (
    defaults.type !== "Property" ||
    defaults.computed ||
    propertyNameOf(defaults.key) !== "defaultOptions"
  ) {
    return false;
  }

  const clientOptions = defaults.parent;

  if (clientOptions.type !== "ObjectExpression") {
    return false;
  }

  const newExpression = clientOptions.parent;

  if (newExpression.type !== "NewExpression") {
    return false;
  }
  return newExpression.callee.type === "Identifier" && newExpression.callee.name === "QueryClient";
};

/**
 * Object が query の options として渡されている呼び出し（`useQuery` 系の第 1 引数、
 * `useQueries` の `queries` 配列の要素、`queryOptions` 系の引数）を返す
 */
const queryOptionsCallOf = (node: ESTree.ObjectExpression) => {
  const parent = node.parent;

  if (parent.type === "CallExpression") {
    if (parent.arguments[0] !== node) {
      return undefined;
    }
    return queryOptionsCallNameOf(parent);
  }

  // `useQueries({ queries: [{...}] })` の配列の要素
  let queries: ESTree.Node = parent;

  if (queries.type === "ArrayExpression") {
    queries = queries.parent;
  }

  if (
    queries.type !== "Property" ||
    queries.computed ||
    propertyNameOf(queries.key) !== "queries"
  ) {
    return undefined;
  }

  const holder = queries.parent;

  if (holder.type !== "ObjectExpression") {
    return undefined;
  }

  const call = holder.parent;

  if (call.type !== "CallExpression" || call.arguments[0] !== holder) {
    return undefined;
  }

  const name = queryOptionsCallNameOf(call);

  if (name !== "useQueries") {
    return undefined;
  }
  return name;
};

export const throwOnErrorPlacement = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `throwOnError: true` and `throwOnError` in hooks; set it in the QueryClient defaults.",
    },
    messages: {
      literal:
        "throwOnError: true にせず、data が無いときだけ投げる関数（(_error, query) => query.state.data === undefined）を QueryClient の既定に渡す。",
      inHook: "throwOnError は QueryClient の既定に置き、package や app の hook には書かない。",
    },
  },
  createOnce(context) {
    return {
      Property(node) {
        if (node.parent.type !== "ObjectExpression" || node.computed) {
          return;
        }

        if (propertyNameOf(node.key) !== "throwOnError") {
          return;
        }

        const object = node.parent;

        // `new QueryClient({ defaultOptions: { queries: {...} } })` は query の既定
        if (isDefaultOptionsQueries(object)) {
          if (node.value.type === "Literal" && node.value.value === true) {
            context.report({ node, messageId: "literal" });
          }
          return;
        }

        // Query の options（useQuery 系・queryOptions 系）の中でだけ hook を指摘する
        if (queryOptionsCallOf(object) === undefined) {
          return;
        }

        const fn = enclosingFunctionOf(node);

        if (fn !== undefined && /^use[A-Z]/.test(functionNameOf(fn) ?? "")) {
          context.report({ node, messageId: "inHook" });
          return;
        }

        if (node.value.type === "Literal" && node.value.value === true) {
          context.report({ node, messageId: "literal" });
        }
      },
    };
  },
});
