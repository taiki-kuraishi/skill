import type { ESTree } from "@oxlint/plugins";

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

/** 判定に使う hook の名前。`@tanstack/react-query` 自身の hook だけで、kstack の hook（`useTodosQuery` など）は含めない */
const queryHookNames: Record<string, true> = {
  useInfiniteQuery: true,
  useQueries: true,
  useQuery: true,
  useSuspenseInfiniteQuery: true,
  useSuspenseQueries: true,
  useSuspenseQuery: true,
};

/** query の options を受け取る hook（mutation を含む） */
const optionsHookNames: Record<string, true> = {
  useInfiniteQuery: true,
  useMutation: true,
  useQueries: true,
  useQuery: true,
};

/** `useSuspenseQuery` 系は import の制限で扱うので、自作ルールの対象から外す */
const plainQueryHookNames: Record<string, true> = {
  useInfiniteQuery: true,
  useQueries: true,
  useQuery: true,
};

const callNameOf = (node: ESTree.CallExpression) => {
  const { callee } = node;

  if (callee.type !== "Identifier") {
    return undefined;
  }
  return callee.name;
};

export const queryHookNameOf = (node: ESTree.CallExpression) => {
  const name = callNameOf(node);

  if (name === undefined || queryHookNames[name] !== true) {
    return undefined;
  }
  return name;
};

export const plainQueryHookNameOf = (node: ESTree.CallExpression) => {
  const name = callNameOf(node);

  if (name === undefined || plainQueryHookNames[name] !== true) {
    return undefined;
  }
  return name;
};

export const optionsHookNameOf = (node: ESTree.CallExpression) => {
  const name = callNameOf(node);

  if (name === undefined || optionsHookNames[name] !== true) {
    return undefined;
  }
  return name;
};

/**
 * `Query` / `Queries` で終わる hook 呼び出し。kstack の hook（`useTodosQuery` など）が
 * package の hook から `data` / `error` を読む形も見る。`useSuspenseQuery` 系は import の制限で扱う。
 */
export const queryLikeHookNameOf = (node: ESTree.CallExpression) => {
  const name = callNameOf(node);

  if (name === undefined || name.startsWith("useSuspense")) {
    return undefined;
  }

  if (!/^use([A-Z][A-Za-z0-9]*)?Quer(?:y|ies)$/.test(name)) {
    return undefined;
  }
  return name;
};

export const propertyNameOf = (key: ESTree.Node) => {
  if (key.type === "Identifier") {
    return key.name;
  }

  if (key.type === "Literal" && typeof key.value === "string") {
    return key.value;
  }
  return undefined;
};

export const enclosingFunctionOf = (node: ESTree.Node) => {
  let current: ESTree.Node | null = node.parent;

  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return current;
    }
    current = current.parent;
  }
  return undefined;
};

export const functionNameOf = (node: FunctionNode) => {
  if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
    return node.id?.name;
  }

  const { parent } = node;

  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    return parent.id.name;
  }

  if (parent.type === "Property" && parent.key.type === "Identifier") {
    return parent.key.name;
  }
  return undefined;
};

/**
 * 関数が JSX を返す（component）かどうかを、その関数の中の JSX から覚えておく。
 * 呼び出し側で `visitors` を展開し、`Program` で `reset()` する。
 */
export const createJsxFunctionTracker = () => {
  const functions = new Set<FunctionNode>();

  const mark = (node: ESTree.Node) => {
    const fn = enclosingFunctionOf(node);

    if (fn) {
      functions.add(fn);
    }
  };

  return {
    visitors: {
      JSXElement: mark,
      JSXFragment: mark,
    },
    reset: () => functions.clear(),
    contains: (node: FunctionNode) => functions.has(node),
  };
};
