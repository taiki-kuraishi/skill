---
name: layerd-architecture
description: レイヤードアーキテクチャの class を書く・修正する・レビューするときの規約。use case 層のクラス設計（execute メソッドへの集約、private メソッドの service への切り出し）を扱う。usecase / use-case / service class の新規作成、メソッド追加、レビュー指摘への対応でも発火させる。
---

# layerd-architecture

レイヤードアーキテクチャの class を書くときの規約。理由を理解した上で適用すること。

## use-case class には execute メソッドしか置かない

公開メソッドは `execute` 1 つにする。2 つ目の公開メソッドが必要になったら、それは別の use case か service に切り出す。

```ts
// Bad: 1 class に複数の操作が入る
class LaunchMirrorUseCase {
  public async execute(args: { cron: string }) { ... }
  private async isPending(instanceId: string) { ... }
  private async createInstance(id: string) { ... }
}

// Good: 外部とのやり取りは service に任せ、use case は execute に集約する
class LaunchMirrorUseCase {
  public async execute(args: { cron: string }) { ... }
}

// src/services/workflow-service.ts
class WorkflowService {
  public async isPending(instanceId: string) { ... }
  public async createInstance(id: string) { ... }
}
```

なぜ: use case は「1 つの操作」の入口でしかない。private メソッドが増えると class 内に複数の責務が滲み、テストも use case 1 つを通す形しか書けなくなる。service に切り出せば service 単体でテストでき、use case は依存を DI して流れを書くだけになる。
