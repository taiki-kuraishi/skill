import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noExplicitReturnType } from "../src/rules/no-explicit-return-type.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("no-explicit-return-type", noExplicitReturnType, {
  valid: [
    "const load = () => fetchContent();",
    "function save(user: User) { return user; }",
    "class Api { list() { return []; } }",
    'const isUser = (value: unknown): value is User => typeof value === "object";',
    "function assertUser(value: unknown): asserts value is User {}",
    "declare function fetchContent(): Promise<Content>;",
    "class Api { overload(id: string): void; overload(id: string) {} }",
  ],
  invalid: [
    {
      code: "const load = (): Promise<Content> => fetchContent();",
      errors: [{ messageId: "explicit" }],
    },
    {
      code: "function load(): Content { return fetchContent(); }",
      errors: [{ messageId: "explicit" }],
    },
    {
      code: "class Api { list(): string[] { return []; } }",
      errors: [{ messageId: "explicit" }],
    },
  ],
});
