---
name: kstack-mise
description: mise（mise.toml、jdx/mise-action）でツールを管理するリポジトリの規約。GitHub Actions の jdx/mise-action を、依存の install を包む composite action（setup-bun など）に入れず job の steps で composite action より前に呼ぶこと、install_args にその job の実行に要る最低限のツールだけを書くことを扱う。mise-action を使う workflow や composite action（.github/actions/*/action.yml）を書く・修正する・レビューするとき、CI の job・step の追加、composite action の作成・分割、レビュー指摘への対応でも発火させる。
---

# kstack-mise

[mise](https://mise.jdx.dev/) を使うときの規約。理由を理解した上で適用すること。

## mise-action は job の steps で、composite action より前に呼ぶ

`jdx/mise-action` は job の steps に書き、依存を install する composite action（`setup-bun` など）より前で呼ぶ。composite action に持たせるのは、依存のキャッシュと install（`bun ci`）だけにする。

```yaml
# Bad: composite action がツールのインストールまで抱えている
# .github/actions/setup-bun/action.yml
runs:
  using: composite
  steps:
    - uses: jdx/mise-action@v5
      with:
        install_args: "bun node"
    - shell: bash
      run: bun ci
```

```yaml
# Good: composite action は依存のキャッシュと install だけを持つ
# .github/actions/setup-bun/action.yml
runs:
  using: composite
  steps:
    - uses: actions/cache@v6
      with:
        path: ~/.bun/install/cache
        key: bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}
        restore-keys: bun-${{ runner.os }}-
    - shell: bash
      run: bun ci
```

```yaml
# Good: job の steps で、composite action の前にツールを入れる
steps:
  - uses: actions/checkout@v7
  - uses: jdx/mise-action@v5
    with:
      install_args: "bun node"
  - uses: ./.github/actions/setup-bun
```

なぜ: composite action に mise-action を入れると、入れるツール（`install_args`）が composite action に固定され、ほかのツールも要る job は mise-action をもう一度呼ぶことになる。job の steps に置けば、その job が使うツールが workflow だけで読め、依存の install が要らない job とも同じ並びで書ける。

## install_args には、その job の実行に要る最低限のツールだけを書く

`jdx/mise-action` には `install_args` を書き、その job のコマンドの実行に要るツールだけを並べる。ツールの install や実行に要るツールも含める（Node で動く CLI なら `node`、mise の設定で npm のツールを bun で入れているなら `bun`）。step に別のツールのコマンドを足したら、`install_args` にも足す。

```yaml
# Bad: install_args が無く、mise.toml などに書いた全ツールが入る
- uses: jdx/mise-action@v5
- run: lefthook validate

# Good: その job が使うツールだけを入れる
- uses: jdx/mise-action@v5
  with:
    install_args: lefthook
- run: lefthook validate

# Good: Node で動く CLI は node も入れる
- uses: jdx/mise-action@v5
  with:
    install_args: "node npm:renovate"
- run: renovate-config-validator --strict
```

なぜ: `install_args` を省略すると mise-action は設定ファイルの全ツールを入れるので、job が使わないツールのダウンロードと install に時間を取られ、そのツールの install が失敗しただけで job も落ちる。足りないほうは `command not found` で落ちるだけで原因を読み取りにくいので、step を変えたら `install_args` も合わせる。
