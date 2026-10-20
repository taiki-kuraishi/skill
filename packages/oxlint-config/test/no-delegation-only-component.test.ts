import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noDelegationOnlyComponent } from "../src/rules/no-delegation-only-component.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("no-delegation-only-component", noDelegationOnlyComponent, {
  valid: [
    // Good: 呼び出し側で実体を使う
    {
      code: `function AccountPage() {
  const account = useAccountPage();
  return <AccountCard account={account} />;
}`,
    },
    // 組み込みの host element を返す component は委譲ではない
    {
      code: `function AccountPage() {
  return <main />;
}`,
    },
    // 状態を読む hook・分岐を持つ component は委譲だけではない
    {
      code: `function AccountPage() {
  const account = useAccountPage();

  if (account.status === "loading") {
    return <AccountPageSkeleton />;
  }
  return <AccountCard account={account} />;
}`,
    },
    // 属性で値を加工していれば委譲だけではない
    {
      code: `function AccountCard({ raw }: { raw: string }) {
  return <Card title={formatTitle(raw)} />;
}`,
    },
    // 子要素を持つ component は組み立てを持っている
    {
      code: `function AccountPage() {
  return (
    <Layout>
      <AccountCard />
    </Layout>
  );
}`,
    },
    // 複数の文を持つ component
    {
      code: `function AccountPage() {
  trackPageView();
  return <AccountCard />;
}`,
    },
    // 小文字で始まる関数は component として扱わない
    {
      code: `function renderAccount() {
  return <AccountCard />;
}`,
    },
    // 状態を読む hook は component ではない
    {
      code: `function useAccountPage() {
  return <AccountCard />;
}`,
    },
  ],
  invalid: [
    // Bad: 名前を増やすだけの委譲
    {
      code: `function AccountPage() {
  return <AccountCard />;
}`,
      errors: [{ messageId: "delegation" }],
    },
    // 引数なしの arrow component も同じ
    {
      code: `const AccountPage = () => <AccountCard />;`,
      errors: [{ messageId: "delegation" }],
    },
    // 親から受けた props をそのまま中継するだけでも委譲
    {
      code: `function AccountHeader({ name }: { name: string }) {
  return <Header name={name} />;
}`,
      errors: [{ messageId: "delegation" }],
    },
    // 親から受けた props を spread で中継する形も委譲
    {
      code: `function AccountHeader(props: { name: string }) {
  return <Header {...props} />;
}`,
      errors: [{ messageId: "delegation" }],
    },
    // 静的な値だけを渡す形も委譲
    {
      code: `function AccountPage() {
  return <AccountCard title="アカウント" />;
}`,
      errors: [{ messageId: "delegation" }],
    },
    // メンバー式の component も委譲先として見る
    {
      code: `function AccountPage() {
  return <Layout.AccountCard />;
}`,
      errors: [{ messageId: "delegation" }],
    },
    // コメントだけの子は子要素と見なさない
    {
      code: `function AccountPage() {
  return (
    <AccountCard>{/* 表示は AccountCard が持つ */}</AccountCard>
  );
}`,
      errors: [{ messageId: "delegation" }],
    },
  ],
});
