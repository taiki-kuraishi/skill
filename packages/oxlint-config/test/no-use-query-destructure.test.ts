import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noUseQueryDestructure } from "../src/rules/no-use-query-destructure.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("no-use-query-destructure", noUseQueryDestructure, {
  valid: [
    // Good: package の query hook は useQuery の結果をそのまま返す
    `export const useTodosQuery = () => useQuery({ queryKey: ["todos"], queryFn: fetchTodos });`,
    `export function useTodosQuery() {
  const client = useApi();
  return useQuery({ queryKey: ["todos"], queryFn: () => parseResponse(client.api.todos.$get()) });
}`,
    // Good: app の hook は package の hook を呼んで表示の形に整える
    `export function useTodoList() {
  const { data } = useTodosQuery();
  if (data === undefined) {
    return { status: "loading" } as const;
  }
  return { status: "ready", todos: data.todos } as const;
}`,
    // view の hook が useQuery を読む形は kstack-react の例なので指摘しない（層が区別できない）
    `function useProjectDetail() {
  const { data: project } = useQuery(projectQuery);
  if (project === undefined) {
    return { status: "loading" } as const;
  }
  return { status: "ready", name: project.name } as const;
}`,
    `function useUserCard(id: string) {
  const { data: user } = useQuery({ queryKey: ["user", id], queryFn: () => fetchUser(id) });
  return user ?? null;
}`,
    // 結果を分割代入しない形は対象外
    `export const useTodosQuery = () => {
  const query = useQuery({ queryKey: ["todos"], queryFn: fetchTodos });
  return query;
};`,
    // component が query を読む形は no-query-in-component が指摘する
    `function OrderSummary() {
  const { data } = useQuery(ordersQuery);
  return <div>{data?.length}</div>;
}`,
  ],
  invalid: [
    // Bad: package の query hook が結果を分割代入して整形している
    {
      code: `export function useTodosQuery() {
  const { data } = useQuery({ queryKey: ["todos"], queryFn: fetchTodos });
  return data?.todos.map((todo) => ({ id: todo.id, label: todo.title ?? "Untitled" }));
}`,
      errors: [{ messageId: "destructure" }],
    },
    // Bad: arrow の package hook でも同じ
    {
      code: `export const useTodoQuery = (id: string) => {
  const { data } = useQuery({ queryKey: ["todo", id], queryFn: () => fetchTodo(id) });
  return data ?? null;
};`,
      errors: [{ messageId: "destructure" }],
    },
    // Bad: useInfiniteQuery も同じ
    {
      code: `export function useTodoPagesQuery() {
  const { data } = useInfiniteQuery(todoPagesQuery);
  return data?.pages ?? [];
}`,
      errors: [{ messageId: "destructure" }],
    },
  ],
});
