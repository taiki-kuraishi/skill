import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noQueryError } from "../src/rules/no-query-error.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("no-query-error", noQueryError, {
  valid: [
    // Good: hook は data だけを見る
    `function useTodoList() {
  const { data } = useTodosQuery();
  if (data === undefined) {
    return { status: "loading" } as const;
  }
  return { status: "ready", todos: data.todos } as const;
}`,
    // component が error を読む形は no-query-in-component が指摘するので、ここでは見逃す
    `function ProjectDetail({ id }: { id: string }) {
  const { data, error } = useQuery(userQuery(id));
  return <h1>{error ? "error" : data?.name}</h1>;
}`,
    // mutation の onError は画面の hook が持つ
    `function useCreateTodo() {
  return useMutation({
    mutationFn: (body) => createTodo(body),
    onError: (error) => reportError(error),
  });
}`,
    // query の data ではない分割代入
    `function useThing(state: { error: string | null }) {
  const { error } = state;
  return error;
}`,
  ],
  invalid: [
    // Bad: hook が error を分岐している
    {
      code: `function useProjectDetail(id: string) {
  const { data, error } = useQuery(userQuery(id));
  if (error) {
    return { status: "error" } as const;
  }
  if (data === undefined) {
    return { status: "loading" } as const;
  }
  return { status: "ready" } as const;
}`,
      errors: [{ messageId: "error" }],
    },
    // Bad: isError を見る場合も同じ
    {
      code: `function useProjectDetail(id: string) {
  const { isError } = useQuery(userQuery(id));
  return { failed: isError };
}`,
      errors: [{ messageId: "error" }],
    },
    // Bad: app の hook でも package の hook でも同じ
    {
      code: `function useTodoList() {
  const { data, error } = useTodosQuery();
  if (error) {
    return { status: "error" } as const;
  }
  return { status: "ready", todos: data?.todos } as const;
}`,
      errors: [{ messageId: "error" }],
    },
    // Bad: 2 つ読めば 2 回指摘する
    {
      code: `function useProjectDetail(id: string) {
  const { error, isError } = useQuery(userQuery(id));
  return { error, isError };
}`,
      errors: [{ messageId: "error" }, { messageId: "error" }],
    },
  ],
});
