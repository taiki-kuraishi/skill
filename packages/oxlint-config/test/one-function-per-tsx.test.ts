import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { oneFunctionPerTsx } from "../src/rules/one-function-per-tsx.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("one-function-per-tsx", oneFunctionPerTsx, {
  valid: [
    // Good: component 1 つと、関数でない定数・型
    {
      filename: "order-summary.tsx",
      code: `type Props = { name: string };
const label = "名前";

export function OrderSummary({ name }: Props) {
  return <h1>{label}{name}</h1>;
}`,
    },
    // 関数の中の handler はトップレベルではない
    {
      filename: "order-summary.tsx",
      code: `export function OrderSummary({ onSave }: { onSave: () => void }) {
  const handleClick = () => {
    onSave();
  };
  return <button onClick={handleClick}>保存</button>;
}`,
    },
    // 多重定義のシグネチャは実装として数えない
    {
      filename: "format.tsx",
      code: `export function format(value: string): string;
export function format(value: number): string;
export function format(value: string | number) {
  return String(value);
}`,
    },
    // 無名の arrow を default export する形
    {
      filename: "page.tsx",
      code: `export default () => <h1>ページ</h1>;`,
    },
    // 関数 1 つの .tsx
    {
      filename: "price.tsx",
      code: `export const formatPrice = (value: number) => \`\${value}円\`;`,
    },
    // .ts は対象外
    {
      filename: "metrics.ts",
      code: `export function total(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

export function average(values: number[]) {
  return total(values) / values.length;
}`,
    },
  ],
  invalid: [
    // Bad: component と補助の関数が同居する
    {
      filename: "order-summary.tsx",
      code: `export function OrderSummary() {
  return <OrderRow />;
}

function OrderRow() {
  return <tr />;
}`,
      errors: [{ messageId: "multiple" }],
    },
    // 補助が arrow の変数でも数える
    {
      filename: "order-summary.tsx",
      code: `export function OrderSummary() {
  return <OrderRow />;
}

const OrderRow = () => <tr />;`,
      errors: [{ messageId: "multiple" }],
    },
    // 補助が function 式の変数でも数える
    {
      filename: "order-summary.tsx",
      code: `export function OrderSummary() {
  return <OrderRow />;
}

const OrderRow = function () {
  return <tr />;
};`,
      errors: [{ messageId: "multiple" }],
    },
    // 複数の関数を default / named export する形
    {
      filename: "page.tsx",
      code: `export default function Page() {
  return <main />;
}

export function Header() {
  return <header />;
}`,
      errors: [{ messageId: "multiple" }],
    },
    // 公開する arrow の変数も数える
    {
      filename: "page.tsx",
      code: `export function Page() {
  return <main />;
}

export const Header = () => <header />;`,
      errors: [{ messageId: "multiple" }],
    },
    // 3 つあれば 2 つ目以降を指摘する
    {
      filename: "page.tsx",
      code: `export function Page() {
  return <main />;
}

function Header() {
  return <header />;
}

function Footer() {
  return <footer />;
}`,
      errors: [{ messageId: "multiple" }, { messageId: "multiple" }],
    },
  ],
});
