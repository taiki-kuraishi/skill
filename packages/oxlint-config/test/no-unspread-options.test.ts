import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noUnspreadOptions } from "../src/rules/no-unspread-options.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("no-unspread-options", noUnspreadOptions, {
  valid: [
    // Good: mutation hook は options を受け取って展開する
    `export const useCreateTodo = (options?: Options) => {
  const client = useApi();

  return useMutation<Data, Error, Variables>({
    ...options,
    mutationFn: (variables) => parseResponse(client.api.todos.$post(variables)),
  });
};`,
    // Good: query hook も画面ごとに変わる options を展開する
    `export const useTodosQuery = (options?: Options) => {
  const client = useApi();

  return useQuery({
    ...todosQuery,
    ...options,
    queryFn: () => parseResponse(client.api.todos.$get()),
  });
};`,
    // options を受けない hook は展開しない
    `export const useTodosQuery = () => {
  const client = useApi();

  return useQuery({ queryKey: ["todos"], queryFn: () => parseResponse(client.api.todos.$get()) });
};`,
    // options をそのまま渡す形は展開しなくてよい
    `export const useTodosQuery = (options?: Options) => useQuery(options ?? todosQuery);`,
    // options を null 合体で展開する形も展開として扱う
    `export const useTodosQuery = (options?: Options) => {
  const client = useApi();

  return useQuery({
    ...todosQuery,
    ...(options ?? {}),
    queryFn: () => parseResponse(client.api.todos.$get()),
  });
};`,
    // query 以外の呼び出しは対象外
    `export const useThing = (options?: Options) => client.request({ query: options });`,
  ],
  invalid: [
    // Bad: options を受けているのに使っていない
    {
      code: `export const useTodosQuery = (options?: Options) => {
  const client = useApi();

  return useQuery({ queryKey: ["todos"], queryFn: () => parseResponse(client.api.todos.$get()) });
};`,
      errors: [{ messageId: "unspread" }],
    },
    // Bad: mutation hook でも同じ
    {
      code: `export const useCreateTodo = (options?: Options) =>
  useMutation<Data, Error, Variables>({ mutationFn: (variables) => parseResponse(options) });`,
      errors: [{ messageId: "unspread" }],
    },
  ],
});
