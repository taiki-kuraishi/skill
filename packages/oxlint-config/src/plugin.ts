import { definePlugin, eslintCompatPlugin } from "@oxlint/plugins";
import { blankLineBeforeIf } from "./rules/blank-line-before-if.ts";
import { noConditionalSpread } from "./rules/no-conditional-spread.ts";
import { noElse } from "./rules/no-else.ts";
import { noExplicitReturnType } from "./rules/no-explicit-return-type.ts";
import { objectParams } from "./rules/object-params.ts";

export default eslintCompatPlugin(
  definePlugin({
    meta: { name: "kstack" },
    rules: {
      "blank-line-before-if": blankLineBeforeIf,
      "no-conditional-spread": noConditionalSpread,
      "no-else": noElse,
      "no-explicit-return-type": noExplicitReturnType,
      "object-params": objectParams,
    },
  }),
);
