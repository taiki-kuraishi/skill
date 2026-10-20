---
name: kstack-code-comment
description: コードコメントの規約。言語を問わず、コードや設定ファイル（TypeScript、JavaScript、Python、Go、シェルスクリプト、YAML、TOML、JSONC など）を書く・修正する・レビューする場面すべてで使用すること — コメント・docstring・JSDoc の説明文は日本語で書く。コードの what を書かず、コード・ドキュメント・外部の設定のどこにも書かれていない why だけを書く。why が無ければコメントを書かない。ただし class の method と export する関数には何をするかの 1 行の doc を書き、分岐のあるものは doc の番号付き手順と本文の Step N コメントで書く。チャンク分割などインデックス計算で処理するループには、前に目的の見出しコメントを書く。兄弟ファイルを複製して新しいファイルを作るときも、複製元のコメントを引き継がない。コメントを書くつもりが無くても生成するコードにはコメントが入りうるので、コード生成、リファクタリング、バグ修正、設定ファイルの編集、兄弟ファイルを複製した新規ファイルの作成、レビュー指摘への対応でも発火させる。
---

# kstack-code-comment

コードコメントを書くときの規約。言語を問わず適用する。理由を理解した上で適用すること。

## コメントの説明文は日本語で書く

コメント・docstring・JSDoc の説明文は日本語で書く。識別子・ライブラリ名・コード片は原文を保つ。他の SKILL が指定する `Arrange` / `Act` / `Assert` や `Step N:` の固定表記は維持し、その説明部分を日本語にする。upstream から取り込んだコードのコメントは対象外。

```ts
// Bad
// The provider rejects empty requests with 404.
await client.resume({ selected: true });

// Good
// この provider は空のリクエストを 404 で拒否する。
await client.resume({ selected: true });
```

なぜ: 説明文を日本語に揃えると、コードとコメントの意図を行き来する際に言語を切り替えずに読める。

## コメントにコードの what を書かない

コードが何をするかをコメントで説明しない。コードからもライブラリのドキュメントからも読み取れない why だけを書き、書くべき why が無ければコメントごと書かない。

```ts
// Bad: 次の行が何をするかを言い換えている
// 取得に失敗したら 3 回までリトライする
const feed = await retry(() => fetchFeed(url), { times: 3 });

// Good: コードから読めない理由だけを書く
// 配信元は混雑時に 503 を返すが、数秒で回復する
const feed = await retry(() => fetchFeed(url), { times: 3 });
```

```sh
# Bad: シェルのオプションが何をするかを解説している
# エラー・未定義変数・パイプ途中の失敗で止める
set -euo pipefail

# Good: 書くべき why が無ければコメントを書かない
set -euo pipefail
```

なぜ: what はコード自身が正確に示しているので、言い換えたコメントは読む量を増やすうえ、コードを変えたときに古い説明が残って嘘になる。ライブラリや設定オプションの挙動の解説も what にあたり、ドキュメントに任せる。

例外: 処理の区切りや宣言にコメントを付けるよう別の SKILL や下の節が定めている箇所は、それに従う。関数を合成する `Result.gen` のステップ（kstack-better-result）、テストの Arrange / Act / Assert（kstack-testing）、use case の step 番号付き doc と `Step N` コメント（kstack-layerd-architecture）、class の method と export する関数の doc と `Step N` コメント（下の「class の method と export する関数には doc を書く」）、GDScript の宣言の `##` doc comment とテスト関数の内容コメント（kstack-gdscript）がこれにあたる。これらは個々の行の言い換えではなく、複数のステップを繋ぐ流れや API の契約を上から読むための目次として働く。

例外: インデックス計算でまとまりを処理するループ（チャンク分割、ウィンドウ走査など）は、ループの前に「何を何単位でどうするか」を 1 行の見出しで書く。ループ本体を読み解かないと目的が分からないため、見出しが目次として働く。

```ts
// Bad: 添字の計算を読み解かないと、何のためのループか分からない
for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  await db.insert(table).values(rows.slice(i, i + CHUNK_SIZE));
}

// Good: ループの目的を見出しにする
// rows を CHUNK_SIZE 件ずつに分けて insert する
for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
  await db.insert(table).values(rows.slice(i, i + CHUNK_SIZE));
}
```

## class の method と export する関数には doc を書く

class の method（constructor・getter・private method を含む）と export する関数には、何をするかの 1 行の doc comment を書く。分岐のあるものは、doc に判断・分岐を番号付きの手順で並べ、本文の各分岐の先頭に doc と同じ文言で `// Step N: ...` を書く。

```ts
// Bad: 何をする method か、どこで何を判断しているかを本文から読み解くしかない
public disconnected(code: number) {
  if (this.socket === null) {
    return [];
  }
  this.socket = null;

  if (fatalCodes.has(code)) {
    return [{ type: "stop" }];
  }
  return [this.reconnect()];
}

// Good: doc に要約と手順を並べ、本文の分岐を同じ文言で示す
/**
 * socket が閉じた後の進め方を決める。
 * 1. socket を待っていなければ close を無視する
 * 2. 閉じた socket を忘れる
 * 3. 再接続できない close code なら止まる
 * 4. それ以外は再接続する
 */
public disconnected(code: number) {
  // Step 1: socket を待っていなければ close を無視する
  if (this.socket === null) {
    return [];
  }

  // Step 2: 閉じた socket を忘れる
  this.socket = null;

  // Step 3: 再接続できない close code なら止まる
  if (fatalCodes.has(code)) {
    return [{ type: "stop" }];
  }

  // Step 4: それ以外は再接続する
  return [this.reconnect()];
}

/**
 * 保存用に永続状態の複製を返す。
 */
public get state() {
  return { ...this.persistent };
}
```

なぜ: 1 行の doc は method・関数の契約で、呼び出し側は本文を読まずに何をするかを知れる。手順を doc に並べると判断の一覧を上から読め、本文のどこがどの判断かを番号で辿れる。doc と本文の文言を揃えると、分岐を足し引きしたときのずれが見つかる。

## 理由の形をした what も書かない

「〜ので」「〜しないと」と理由の形で書いても、中身がコード（同じファイルの別の行を含む）、使っているライブラリ・ツール・実行基盤のドキュメント、外部の設定（ruleset など）のどこかに書かれていることなら what にあたる。why として残すのは、コードを読む人が抱く疑問（なぜ定石と違う書き方なのか、なぜこの値なのか）への答えのうち、そのどこにも書かれていないものだけ。

```yaml
permissions:
  contents: read
  # Bad: action のドキュメントにある要件を、理由の形で言い換えている
  # paths-filter は変更ファイル一覧を API から取るので、pull-requests: read が要る
  pull-requests: read

jobs:
  changes:
    steps:
      # Bad: 同じファイルにある各 job の if: が示す挙動を、理由の形で言い換えている
      # workflow_dispatch では各 job の if: で全 job を走らせるので、PR 以外では filter しない
      - if: github.event_name == 'pull_request'
        uses: dorny/paths-filter@v4

  # Bad: 外部の設定（ruleset）を写している
  # required check として ruleset に登録するのはこの job だけ（job 名は ruleset 側と対で固定）
  all-green:
    needs: [changes, lint]
    if: always()
```

```yaml
# Good: 定石の paths: をなぜ使わないのかは、どこにも書かれていない
# workflow の paths: で絞らない。workflow ごと skip されると required check が Pending のまま残り、merge できなくなる
on:
  pull_request:

permissions:
  contents: read
  # Good: ドキュメントから分かる要件にはコメントを書かない
  pull-requests: read
```

なぜ: 中身がコード・ドキュメント・設定の言い換えなら、理由の形をしていても what と同じく読む量を増やし、元が変わったときに嘘になる。定石を避けた判断や配信元の癖のような事情はどこにも書かれていないので、コメントにしか残せない。

## 複製元のコメントを引き継がない

兄弟ファイルを複製して新しいファイルを作るときは、コメントを全部消した状態から始め、新しいファイルでも成り立つ why（外部の制約、定石を避けた理由）だけを足し戻す。複製元にコメントがあることも、兄弟が同じコメントを持つことも、書いてよい根拠にならない。「〜と揃える」のように他ファイルとの一致を言うだけのコメントは、値が同じことの言い換えで why ではない。

```jsonc
// Bad: 複製元のコメントを残し、複製元との一致や設定値の意味を言い換えている
{
  // 他の Worker と揃える。
  "compatibility_date": "2026-01-01",
  // workers.dev での公開を無効にする。
  "workers_dev": false,
  // binding を持たない、という宣言。
  "vars": {},
}

// Good: 新しいファイルに残す why が無いので、コメントを書かない
{
  "compatibility_date": "2026-01-01",
  "workers_dev": false,
  "vars": {},
}
```

なぜ: 複製元のコメントは複製元の事情で書かれていて、残すと what のコメントが複製のたびに増え、元が変わったときに複数のファイルで嘘になる。コメントを消す側ではなく足す側から判断すれば、why の無いコメントが残らない。
