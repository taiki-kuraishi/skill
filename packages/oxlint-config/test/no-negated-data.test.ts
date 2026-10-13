import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noNegatedData } from "../src/rules/no-negated-data.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("no-negated-data", noNegatedData, {
  valid: [
    // Good: 見つからない判定は data === null
    `function useMaybeUser(id: string) {
  const { data: user } = useQuery(userQuery(id));
  if (user === undefined) {
    return { status: "loading" } as const;
  }
  if (user === null) {
    return { status: "notFound" } as const;
  }
  return { status: "ready", name: user.name } as const;
}`,
    // null 合体や任意プロパティは読み込み中と見つからないを区別できる
    `
function useThing(id: string) {
  const { data } = useQuery(userQuery(id));
  return { name: data?.name ?? "Untitled" };
}`,
    // query の data ではない値の否定
    `
function isEmpty(value: string) {
  return !value;
}`,
    // 見つからない値でも、query の data を束縛した名前ではない
    `
function useThing(id: string) {
  const { data } = useQuery(userQuery(id));
  return { found: !data.name };
}`,
  ],
  invalid: [
    // Bad: data を直接否定する
    {
      code: `function useThing(id: string) {
  const { data } = useQuery(userQuery(id));
  if (!data) {
    return { status: "notFound" } as const;
  }
  return { status: "ready" } as const;
}`,
      errors: [{ messageId: "negated" }],
    },
    // Bad: data を別名で受けた場合も同じ
    {
      code: `function useUserCard(id: string) {
  const { data: user } = useQuery(userQuery(id));
  if (!user) {
    return { status: "notFound" } as const;
  }
  return { status: "ready", name: user.name } as const;
}`,
      errors: [{ messageId: "negated" }],
    },
    // 内側の関数から外側の data を否定する形も見る
    {
      code: `function useThing(id: string) {
  const { data: project } = useQuery(userQuery(id));
  const isMissing = () => !project;
  return isMissing();
}`,
      errors: [{ messageId: "negated" }],
    },
  ],
});
