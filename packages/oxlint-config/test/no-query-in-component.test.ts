import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noQueryInComponent } from "../src/rules/no-query-in-component.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("no-query-in-component", noQueryInComponent, {
  valid: [
    // Good: view の hook が読み込み中を判定し、component は戻り値を描くだけ
    {
      code: `
function useProjectDetail() {
  const { data: project } = useQuery(projectQuery);
  if (project === undefined) {
    return { status: "loading" } as const;
  }
  return { status: "ready", name: project.name } as const;
}

function ProjectDetail() {
  const detail = useProjectDetail();
  if (detail.status === "loading") {
    return <ProjectDetailSkeleton />;
  }
  return <h1>{detail.name}</h1>;
}`,
    },
    // Package の hook（useTodosQuery など）を呼ぶ形は component の仕事
    {
      code: `
function OrderSummary() {
  const summary = useOrderSummary();
  return <Total value={summary.total} />;
}`,
    },
    // セッションの有無のように、data === null だけを見て切り替える gate は残す
    {
      code: `
function SessionGate() {
  const { data: session } = useQuery(sessionQuery);
  if (session === null) {
    return <Navigate to="/sign-in" />;
  }
  return <Outlet />;
}`,
    },
    // 分割代入した data をそのまま子へ渡すだけなら、component でも読んでいない
    {
      code: `
function ProjectDetail({ id }: { id: string }) {
  const { data } = useQuery(userQuery(id));
  return <ProjectName project={data} />;
}`,
    },
    // JSX を返さない関数（hook）の判定は対象外
    {
      code: `
function useProjectDetail() {
  const { data: project, isPending } = useQuery(projectQuery);
  if (isPending) {
    return { status: "loading" } as const;
  }
  return { status: "ready", name: project?.name } as const;
}`,
    },
    // React.lazy のコード分割の Suspense は query を読まない
    {
      code: `
function Page() {
  return (
    <Suspense fallback={<div />}>
      <Heavy />
    </Suspense>
  );
}`,
    },
  ],
  invalid: [
    // Bad: component が isPending で読み込み中を判定している
    {
      code: `
function ProjectPage() {
  const { data: project, isPending } = useQuery(projectQuery);
  if (isPending) {
    return <FullPageSpinner />;
  }
  return (
    <main>
      <Header />
      <ProjectDetail project={project} />
    </main>
  );
}`,
      errors: [{ messageId: "component" }],
    },
    // Bad: data === undefined で読み込み中を判定している
    {
      code: `
function OrderSummary() {
  const { data: orders } = useQuery(ordersQuery);
  if (orders === undefined) {
    return <OrderSummarySkeleton />;
  }
  return <Total value={orders.length} />;
}`,
      errors: [{ messageId: "component" }],
    },
    // Bad: arrow の component でも同じ
    {
      code: `
const ProjectDetail = ({ id }: { id: string }) => {
  const { data } = useQuery(userQuery(id));
  return <h1>{data?.name}</h1>;
};`,
      errors: [{ messageId: "component" }],
    },
    // Bad: フォームをデータが揃う前に mount し、空の初期値に data?.address を渡している
    {
      code: `
function ShippingCard() {
  const { data } = useQuery(shippingQuery);
  const form = useForm({ defaultValues: { address: data?.address ?? "" } });
  return <ShippingFields form={form} />;
}`,
      errors: [{ messageId: "component" }],
    },
    // Bad: useSuspenseQuery を component で読み、中身を描いている
    {
      code: `
function ProjectDetail({ id }: { id: string }) {
  const { data } = useSuspenseQuery(userQuery(id));
  return <h1>{data?.name}</h1>;
}`,
      errors: [{ messageId: "component" }],
    },
    // Bad: 読み込み中の flag を compound で受け取る形も同じ
    {
      code: `
function TodoList() {
  const { data, isFetching } = useQuery(todosQuery);
  return <div>{isFetching ? "..." : data?.todos.length}</div>;
}`,
      errors: [{ messageId: "component" }],
    },
  ],
});
