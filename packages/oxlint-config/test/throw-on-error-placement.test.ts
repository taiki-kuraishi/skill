import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { throwOnErrorPlacement } from "../src/rules/throw-on-error-placement.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("throw-on-error-placement", throwOnErrorPlacement, {
  valid: [
    // Good: data が無いときの失敗だけを Error Boundary へ投げる
    `new QueryClient({
  defaultOptions: {
    queries: { throwOnError: (_error, query) => query.state.data === undefined },
  },
});`,
    // `defaultOptions` 以外の場所に置く形は対象外
    `const options = { throwOnError: (error) => error !== null };`,
    // `false` で明示的に切るのは対象外
    `new QueryClient({ defaultOptions: { queries: { throwOnError: false } } });`,
    // 画面の hook が retry を決めるのは対象外
    `export const useTodosQuery = (options?: Options) => useQuery({ ...todosQuery, ...options });`,
    // Mutation の既定は query の options ではない
    `new QueryClient({ defaultOptions: { mutations: { throwOnError: true } } });`,
    // Mutation の hook も対象外
    `export const useCreateTodo = () =>
  useMutation({ mutationFn: createTodo, throwOnError: true });`,
    // Hook の外の、query とは関係ない object
    `const requestConfig = { throwOnError: true };`,
    // Hook の中でも、query の options でなければ対象外
    `export function useRequestConfig() {
  return { throwOnError: true };
}`,
    // Query の options でも、`true` 以外は対象外
    `export const todosQuery = queryOptions({
  queryKey: ["todos"],
  queryFn: fetchTodos,
  throwOnError: (error) => error !== null,
});`,
  ],
  invalid: [
    // Bad: true では、表示済みのデータがある再取得の失敗でも投げる
    {
      code: `new QueryClient({ defaultOptions: { queries: { throwOnError: true } } });`,
      errors: [{ messageId: "literal" }],
    },
    // Bad: package の hook に throwOnError を書かない
    {
      code: `export const useTodosQuery = () =>
  useQuery({ queryKey: ["todos"], queryFn: fetchTodos, throwOnError: true });`,
      errors: [{ messageId: "inHook" }],
    },
    // Bad: app の hook でも同じ
    {
      code: `export function useTodoList() {
  const { data } = useTodosQuery({ throwOnError: false });
  return data;
}`,
      errors: [{ messageId: "inHook" }],
    },
    // Bad: hook の中に置けば関数でも指摘する
    {
      code: `export function useTodosQuery() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
}`,
      errors: [{ messageId: "inHook" }],
    },
    // Bad: queryOptions の中でも true は指摘する
    {
      code: `export const todosQuery = queryOptions({
  queryKey: ["todos"],
  queryFn: fetchTodos,
  throwOnError: true,
});`,
      errors: [{ messageId: "literal" }],
    },
    // Bad: infiniteQueryOptions の hook 内も同じ
    {
      code: `export function useTodosInfiniteQuery() {
  return infiniteQueryOptions({
    queryKey: ["todos"],
    queryFn: fetchTodos,
    throwOnError: false,
  });
}`,
      errors: [{ messageId: "inHook" }],
    },
    // Bad: useQueries の queries 配列の要素
    {
      code: `export function useTodoQueries() {
  return useQueries({
    queries: [
      { queryKey: ["todos"], queryFn: fetchTodos, throwOnError: true },
      { queryKey: ["users"], queryFn: fetchUsers },
    ],
  });
}`,
      errors: [{ messageId: "inHook" }],
    },
  ],
});
