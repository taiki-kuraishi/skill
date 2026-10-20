import { definePlugin, eslintCompatPlugin } from "@oxlint/plugins";
import { blankLineBeforeIf } from "./rules/blank-line-before-if.ts";
import { noConditionalSpread } from "./rules/no-conditional-spread.ts";
import { noDelegationOnlyComponent } from "./rules/no-delegation-only-component.ts";
import { noElse } from "./rules/no-else.ts";
import { noExplicitReturnType } from "./rules/no-explicit-return-type.ts";
import { noJsxConditionalAnd } from "./rules/no-jsx-conditional-and.ts";
import { noNegatedData } from "./rules/no-negated-data.ts";
import { noPropertyDestructure } from "./rules/no-property-destructure.ts";
import { noQueryError } from "./rules/no-query-error.ts";
import { noQueryInComponent } from "./rules/no-query-in-component.ts";
import { noUnspreadOptions } from "./rules/no-unspread-options.ts";
import { noUseQueryDestructure } from "./rules/no-use-query-destructure.ts";
import { objectParams } from "./rules/object-params.ts";
import { oneFunctionPerTsx } from "./rules/one-function-per-tsx.ts";
import { playwrightAssert } from "./rules/playwright-assert.ts";
import { throwOnErrorPlacement } from "./rules/throw-on-error-placement.ts";
import { useCaseSteps } from "./rules/use-case-steps.ts";
import { vrtTestName } from "./rules/vrt-test-name.ts";

export default eslintCompatPlugin(
  definePlugin({
    meta: { name: "kstack" },
    rules: {
      "blank-line-before-if": blankLineBeforeIf,
      "no-conditional-spread": noConditionalSpread,
      "no-delegation-only-component": noDelegationOnlyComponent,
      "no-else": noElse,
      "no-explicit-return-type": noExplicitReturnType,
      "no-jsx-conditional-and": noJsxConditionalAnd,
      "no-negated-data": noNegatedData,
      "no-property-destructure": noPropertyDestructure,
      "no-query-error": noQueryError,
      "no-query-in-component": noQueryInComponent,
      "no-unspread-options": noUnspreadOptions,
      "no-use-query-destructure": noUseQueryDestructure,
      "object-params": objectParams,
      "one-function-per-tsx": oneFunctionPerTsx,
      "playwright-assert": playwrightAssert,
      "throw-on-error-placement": throwOnErrorPlacement,
      "use-case-steps": useCaseSteps,
      "vrt-test-name": vrtTestName,
    },
  }),
);
