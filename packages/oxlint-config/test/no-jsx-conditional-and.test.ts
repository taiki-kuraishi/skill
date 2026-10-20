import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noJsxConditionalAnd } from "../src/rules/no-jsx-conditional-and.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("no-jsx-conditional-and", noJsxConditionalAnd, {
  valid: [
    // Good: 状態を if で判定し、分岐ごとの component を返す
    {
      code: `function Notice() {
  const notice = useNotice();

  if (notice.cancelled) {
    return <CancelledNotice />;
  }
  return null;
}`,
    },
    // 属性値の真偽値の計算は表示の出し分けではない
    {
      code: `function SubmitButton({ busy, locked }: { busy: boolean; locked: boolean }) {
  return <button disabled={busy && locked}>送信</button>;
}`,
    },
    // JSX children でも、真偽値しか返さない式は表示の出し分けではない
    {
      code: `function Summary({ count, hidden }: { count: number; hidden: boolean }) {
  return <p>{count > 0 && !hidden}</p>;
}`,
    },
    // 何も描かない値だけを返す計算も対象外
    {
      code: `function Summary({ ready }: { ready: boolean }) {
  return <p>{ready && false}{ready && null}{ready && undefined}</p>;
}`,
    },
    // && を JSX の外の計算に使う
    {
      code: `function useLabel({ visible, label }: { visible: boolean; label: string }) {
  const text = visible && label;
  return text;
}`,
    },
    // 属性値に JSX を置く形は対象外
    {
      code: `function Field({ visible, value }: { visible: boolean; value: string }) {
  return <FieldShell label={visible && <Label value={value} />} />;
}`,
    },
  ],
  invalid: [
    // Bad: 状態の判定と表示内容が JSX children の中で混ざる
    {
      code: `function Notice() {
  const notice = useNotice();
  return <>{notice.cancelled && <p>キャンセルされました</p>}</>;
}`,
      errors: [{ messageId: "conditional" }],
    },
    // 単純な文言の表示も対象
    {
      code: `function Notice({ cancelled }: { cancelled: boolean }) {
  return <p>{cancelled && "キャンセルされました"}</p>;
}`,
      errors: [{ messageId: "conditional" }],
    },
    // 変数に持った表示内容も対象
    {
      code: `function Notice({ cancelled }: { cancelled: boolean }) {
  const label = "キャンセルされました";
  return <p>{cancelled && label}</p>;
}`,
      errors: [{ messageId: "conditional" }],
    },
    // && の連鎖も対象
    {
      code: `function Notice({ cancelled, ready }: { cancelled: boolean; ready: boolean }) {
  return <p>{ready && cancelled && "キャンセルされました"}</p>;
}`,
      errors: [{ messageId: "conditional" }],
    },
    // 配列を map で表示する形も対象
    {
      code: `function List({ items }: { items: string[] }) {
  return <ul>{items.length > 0 && items.map((item) => <li key={item}>{item}</li>)}</ul>;
}`,
      errors: [{ messageId: "conditional" }],
    },
    // 文字列を返す typeof は表示になる（真偽値の計算ではない）
    {
      code: `function Detail({ value }: { value: unknown }) {
  return <p>{value && typeof value}</p>;
}`,
      errors: [{ messageId: "conditional" }],
    },
    // ネストした JSX の中の && も対象
    {
      code: `function Card({ ready }: { ready: boolean }) {
  return (
    <section>
      <header>
        {ready && <h1>準備完了</h1>}
      </header>
    </section>
  );
}`,
      errors: [{ messageId: "conditional" }],
    },
    // 2 か所あればそれぞれ指摘する
    {
      code: `function Card({ ready, cancelled }: { ready: boolean; cancelled: boolean }) {
  return (
    <section>
      {ready && <h1>準備完了</h1>}
      {cancelled && <p>キャンセルされました</p>}
    </section>
  );
}`,
      errors: [{ messageId: "conditional" }, { messageId: "conditional" }],
    },
  ],
});
