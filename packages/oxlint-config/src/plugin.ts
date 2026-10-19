import { definePlugin, eslintCompatPlugin } from "@oxlint/plugins";
import { blankLineBeforeIf } from "./rules/blank-line-before-if.ts";
import { noConditionalSpread } from "./rules/no-conditional-spread.ts";
import { noElse } from "./rules/no-else.ts";
import { noExplicitReturnType } from "./rules/no-explicit-return-type.ts";
import { noNegatedData } from "./rules/no-negated-data.ts";
import { noQueryError } from "./rules/no-query-error.ts";
import { noQueryInComponent } from "./rules/no-query-in-component.ts";
import { noUnspreadOptions } from "./rules/no-unspread-options.ts";
import { noUseQueryDestructure } from "./rules/no-use-query-destructure.ts";
import { objectParams } from "./rules/object-params.ts";
import { throwOnErrorPlacement } from "./rules/throw-on-error-placement.ts";
import { useCaseSteps } from "./rules/use-case-steps.ts";
import { vrtTestName } from "./rules/vrt-test-name.ts";

export default eslintCompatPlugin(
  definePlugin({
    meta: { name: "kstack" },
    rules: {
      "blank-line-before-if": blankLineBeforeIf,
      "no-conditional-spread": noConditionalSpread,
      "no-else": noElse,
      "no-explicit-return-type": noExplicitReturnType,
      "no-negated-data": noNegatedData,
      "no-query-error": noQueryError,
      "no-query-in-component": noQueryInComponent,
      "no-unspread-options": noUnspreadOptions,
      "no-use-query-destructure": noUseQueryDestructure,
      "object-params": objectParams,
      "throw-on-error-placement": throwOnErrorPlacement,
      "use-case-steps": useCaseSteps,
      "vrt-test-name": vrtTestName,
    },
  }),
);
