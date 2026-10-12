import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noConditionalSpread } from "../src/rules/no-conditional-spread.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("no-conditional-spread", noConditionalSpread, {
  valid: [
    "const built = { id, ...rest };",
    "const { id, ...rest } = args;",
    "call(...(flag ? a : b));",
  ],
  invalid: [
    {
      code: 'const built = { id, ...("metadata" in args ? { metadata: args.metadata } : {}) };',
      errors: [{ messageId: "conditional" }],
    },
    {
      code: "const built = { id, ...(args.metadata && { metadata: args.metadata }) };",
      errors: [{ messageId: "conditional" }],
    },
  ],
});
