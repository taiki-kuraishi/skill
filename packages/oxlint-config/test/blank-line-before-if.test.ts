import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { blankLineBeforeIf } from "../src/rules/blank-line-before-if.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

ruleTester.run("blank-line-before-if", blankLineBeforeIf, {
  valid: [
    "function f() {\n  if (a) {\n    return;\n  }\n}",
    "if (a) {\n  run();\n}",
    "const user = find();\n\nif (user) {\n  run();\n}",
    "const user = find();\n\n// deleted users cannot be updated\nif (user.deletedAt) {\n  run();\n}",
    "const user = find(); // trailing note\n\nif (user) {\n  run();\n}",
    "if (a) {\n  runA();\n} else if (b) {\n  runB();\n}",
    "switch (kind) {\n  case 1:\n    if (a) {\n      run();\n    }\n}",
  ],
  invalid: [
    {
      code: "const user = find();\nif (user) {\n  run();\n}",
      errors: [{ messageId: "missing" }],
    },
    {
      code: "if (a) {\n  runA();\n}\nif (b) {\n  runB();\n}",
      errors: [{ messageId: "missing" }],
    },
    {
      code: "const user = find();\n// deleted users cannot be updated\nif (user.deletedAt) {\n  run();\n}",
      errors: [{ messageId: "missing" }],
    },
    {
      code: "switch (kind) {\n  case 1:\n    run();\n    if (a) {\n      run();\n    }\n}",
      errors: [{ messageId: "missing" }],
    },
  ],
});
