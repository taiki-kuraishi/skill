import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { noElse } from "../src/rules/no-else.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("no-else", noElse, {
  valid: ["function save(user) { if (!user) { return 1; } return 2; }", "if (a) { run(); }"],
  invalid: [
    {
      code: "function save(user) { if (user) { return 1; } else { return 2; } }",
      errors: [{ messageId: "else" }],
    },
    {
      code: "if (a) { runA(); } else { runB(); }",
      errors: [{ messageId: "else" }],
    },
    {
      code: "if (a) { runA(); } else if (b) { runB(); } else { runC(); }",
      errors: [{ messageId: "else" }, { messageId: "else" }],
    },
  ],
});
