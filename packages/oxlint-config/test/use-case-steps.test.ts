import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";
import { useCaseSteps } from "../src/rules/use-case-steps.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "tsx" } } });

ruleTester.run("use-case-steps", useCaseSteps, {
  valid: [
    // Good: doc に step を並べ、本文の塊を同じ番号・同じ文言で示す
    `class IssueInvoiceUseCase {
  /**
   * user の請求書を発行する
   * 1. user を取り出す
   * 2. 取り出した user で、決済サービスに請求書を作る
   * 3. 作った請求書を保存して return する
   */
  public execute = (args: { userId: string }) =>
    Result.gen(async function* () {
      // Step 1: user を取り出す
      const user = yield* await this.deps.users.findById(args);

      // Step 2: 取り出した user で、決済サービスに請求書を作る
      const invoice = yield* await this.deps.billing.createInvoice({ user });

      // Step 3: 作った請求書を保存して return する
      return this.deps.invoices.insert({ invoice });
    }, this);
}`,
    // 名前が UseCase で終わらない class は use case と判定できないので対象外
    `class InvoiceService {
  execute = () => {
    return this.invoices.find();
  };
}`,
    // execute を持たない class は対象外
    `class InvoiceUseCase {
  run = () => 1;
}`,
    // 宣言だけの execute（overload）は本体が無いので対象外
    `class InvoiceUseCase {
  execute: (args: { userId: string }) => Promise<void>;
}`,
    // arrow ではなく method で書く形も見る
    `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. 保存済みの user を読む
   * 2. 読んだ user を返す
   */
  public execute(args: { userId: string }) {
    // Step 1: 保存済みの user を読む
    const user = this.users.findById(args);

    // Step 2: 読んだ user を返す
    return user;
  }
}`,
    // `Step N:` の形でないコメント（`Step2:` の空白なし、TODO）は step として見ない
    `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. user を読む
   */
  execute = () => {
    // Step 1: user を読む
    // Step2: 保存する
    // TODO: 保存に失敗したときの retry を書く
    return this.users.find();
  };
}`,
  ],
  invalid: [
    // Bad: doc comment も step コメントも無い
    {
      code: `class IssueInvoiceUseCase {
  public execute = (args: { userId: string }) =>
    Result.gen(async function* () {
      const user = yield* await this.deps.users.findById(args);
      const invoice = yield* await this.deps.billing.createInvoice({ user });
      return this.deps.invoices.insert({ invoice });
    }, this);
}`,
      errors: [{ messageId: "missingDoc" }],
    },
    // doc comment ではなく行コメントを書いている
    {
      code: `class SyncUserUseCase {
  // user を同期する
  execute = () => this.users.find();
}`,
      errors: [{ messageId: "missingDoc" }],
    },
    // doc comment はあるが、番号付きの step が並んでいない
    {
      code: `class SyncUserUseCase {
  /** user を同期する */
  execute = () => this.users.find();
}`,
      errors: [{ messageId: "missingSteps" }],
    },
    // doc comment が step から始まっていて、要約の 1 行が無い
    {
      code: `class SyncUserUseCase {
  /**
   * 1. user を読む
   */
  execute = () => {
    // Step 1: user を読む
    return this.users.find();
  };
}`,
      errors: [{ messageId: "missingSummary" }],
    },
    // Bad: 本文の `// Step 2:` が doc と違う文言
    {
      code: `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. user を読む
   * 2. user を返す
   */
  execute = () => {
    // Step 1: user を読む
    const user = this.users.find();

    // Step 2: 保存する
    return user;
  };
}`,
      errors: [{ messageId: "mismatch" }],
    },
    // doc の step2 に対応する step コメントが本文に無い
    {
      code: `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. user を読む
   * 2. user を返す
   */
  execute = () => {
    // Step 1: user を読む
    return this.users.find();
  };
}`,
      errors: [{ messageId: "missingBodyStep", data: { number: 2 } }],
    },
    // 本文の step2 が doc に無い
    {
      code: `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. user を読む
   */
  execute = () => {
    // Step 1: user を読む
    const user = this.users.find();

    // Step 2: user を返す
    return user;
  };
}`,
      errors: [{ messageId: "mismatch" }],
    },
    // step の間が空行で区切られていない
    {
      code: `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. user を読む
   * 2. user を返す
   */
  public execute() {
    // Step 1: user を読む
    const user = this.users.find();
    // Step 2: user を返す
    return user;
  }
}`,
      errors: [{ messageId: "missingBlankLine" }],
    },
    // doc の step が 2 つとも本文に無い
    {
      code: `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. user を読む
   * 2. user を返す
   */
  execute = () => this.users.find();
}`,
      errors: [
        { messageId: "missingBodyStep", data: { number: 1 } },
        { messageId: "missingBodyStep", data: { number: 2 } },
      ],
    },
    // 旧表記の `// step1:` は step コメントとして受け入れない
    {
      code: `class SyncUserUseCase {
  /**
   * user を同期する
   * 1. user を読む
   */
  execute = () => {
    // step1: user を読む
    return this.users.find();
  };
}`,
      errors: [{ messageId: "missingBodyStep", data: { number: 1 } }],
    },
  ],
});
