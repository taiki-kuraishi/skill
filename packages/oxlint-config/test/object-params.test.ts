import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { objectParams } from "../src/rules/object-params.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("object-params", objectParams, {
  valid: [
    "function toMentions(args: { answerId: string; text: string }) {}",
    "const byId = (id: string) => id;",
    "[1, 2].reduce((total, value) => total + value, 0);",
    "names.sort((a, b) => a.localeCompare(b));",
    "new Promise((resolve, reject) => resolve(1));",
    "function withThis(this: Repo, id: string) {}",
  ],
  invalid: [
    {
      code: "function toMentions(answerId: string, text: string) {}",
      errors: [{ messageId: "positional" }],
    },
    {
      code: "const add = (a: number, b: number) => a + b;",
      errors: [{ messageId: "positional" }],
    },
    {
      code: "class Api { toMentions(answerId: string, text: string) {} }",
      errors: [{ messageId: "positional" }],
    },
  ],
});
