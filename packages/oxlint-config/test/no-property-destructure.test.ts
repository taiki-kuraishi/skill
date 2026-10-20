import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noPropertyDestructure } from "../src/rules/no-property-destructure.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("no-property-destructure", noPropertyDestructure, {
  valid: [
    // Good: 元のオブジェクトから直接読む
    `const open = (args: { update: { userId: string; status: string; receivedAt: number } }) => ({
  userId: args.update.userId,
  status: args.update.status,
  startedAt: args.update.receivedAt,
});`,
    // Good: this のプロパティを直接絞り込む
    `class Handler {
  private readonly session: { user: string } | null = null;

  public received(text: string) {
    if (this.session === null) {
      return [];
    }
    return [this.session.user, text];
  }
}`,
    // 関数呼び出しの戻り値を受ける分割代入は対象外
    `const { data } = useQuery({ queryKey: ["todos"], queryFn: fetchTodos });`,
    `const { data } = await fetchData();`,
    // 残りの取り出し（rest）なので対象外
    `const { id, ...rest } = args;`,
    // 宣言に初期化子が無い for-of は対象外
    `for (const { id } of items) {
  use(id);
}`,
    // 関数の引数の分割代入は対象外
    `const read = ({ id }: { id: string }) => id;`,
    // 配列の分割代入は対象外
    `const [first] = items;`,
    // 演算子を含む式の結果は対象外
    `const { id } = args ?? fallback;`,
    `const { id } = pick(args);`,
    `const { id } = { id: "1" };`,
  ],
  invalid: [
    // Bad: プロパティを読むためだけに、同じ値の別名を作っている
    {
      code: `const open = (args: { update: { userId: string; status: string; receivedAt: number } }) => {
  const { userId, status, receivedAt } = args.update;
  return { userId, status, startedAt: receivedAt };
};`,
      errors: [{ messageId: "destructure" }],
    },
    // Bad: 絞り込むためだけに、this のプロパティを別名の変数に移している
    {
      code: `class Handler {
  private readonly session: { user: string } | null = null;

  public received(text: string) {
    const { session } = this;

    if (session === null) {
      return [];
    }
    return this.handle({ session, text });
  }
}`,
      errors: [{ messageId: "destructure" }],
    },
    // 名前で参照できる変数も同じ
    {
      code: `const { DATABASE_URL } = env;`,
      errors: [{ messageId: "destructure" }],
    },
    // メンバー式（this のプロパティも含む）も同じ
    {
      code: `const { timeout } = config.client;`,
      errors: [{ messageId: "destructure" }],
    },
    // 既定値付きでも別名を作っている
    {
      code: `const { limit = 10 } = args;`,
      errors: [{ messageId: "destructure" }],
    },
  ],
});
