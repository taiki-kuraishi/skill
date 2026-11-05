# @taiki-kuraishi/omp-skill-reread

session で読み込んだ SKILL を compaction 後に読み直させる omp extension を GitHub Packages から配布する。

## 責務

- 実装すること: compaction（成功した自動 shake を含む）の後に、現在の branch で `read` した `skill://<name>` と、`/skill:<name>` で起動した、または autoload された SKILL（`skill-prompt` の message）を集め、その再読を促す followUp を送る extension。
- 実装しないこと: SKILL の本文の再注入、SKILL ごとの復旧手順（各 SKILL に書く）、物理パスで読んだ `SKILL.md` の検出、SKILL のインストール、lint 設定の配布。名前空間付きの SKILL（`skill://<ns>/<name>`）は URL だけでは SKILL 内のファイルと区別できないため、先頭の `<ns>` を名前として扱い、正しく読み直させられない。

## セットアップ

GitHub Packages は public package の install にも認証を求める。`read:packages` を持つ classic PAT を `NODE_AUTH_TOKEN` に設定し、Bun が読むユーザーレベルの `.npmrc` に次の設定を置く。このファイルに同じ scope の oxlint 等の設定がすでにあれば共用できる。

通常は `~/.npmrc` を使う。`NPM_CONFIG_USERCONFIG` を指定している場合はそのファイル、指定がなく `$XDG_CONFIG_HOME/.npmrc` が存在する場合はそちらを使い、`~/.npmrc` は読まれない。

```ini
@taiki-kuraishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

omp は利用 repo ではなく profile の plugins ディレクトリで依存を install するため、利用 repo の `.npmrc` だけでは認証設定が反映されない。

SKILL を使う session と同じ profile で install し、omp を再起動する。

```bash
omp install @taiki-kuraishi/omp-skill-reread
```

named profile の場合は、以降の install・更新・移行コマンドにも同じ `OMP_PROFILE` を付ける。

```bash
OMP_PROFILE=your-profile omp install @taiki-kuraishi/omp-skill-reread
```

## 使い方

install すると、どの session でも有効になる。compaction の後、`/clear` より後に読み込んだ SKILL があれば、`compaction 前に読み込んだ SKILL を読み直してください: skill://<name>, …` という followUp を 1 通送る。読み直した後の復旧手順（例: [kstack-super-agent](https://github.com/taiki-kuraishi/skill/blob/main/skills/kstack/kstack-super-agent/SKILL.md#状態を失ったとき) の `list`）は各 SKILL に書く。

### 版指定と更新

版を指定する場合は npm package の version を指定する。

```bash
omp install @taiki-kuraishi/omp-skill-reread@0.1.0
```

最新の公開版へ更新する場合:

```bash
omp plugin upgrade @taiki-kuraishi/omp-skill-reread
```

更新後は omp を再起動する。

### 旧 package・既存 link からの移行

以前 `@taiki-kuraishi/omp-extensions` を install した場合、または `omp install /absolute/path/to/skill` で checkout を link した場合は、同じ profile で新 package の install が成功してから旧 plugin の登録を解除し、omp を再起動する。

```bash
omp install @taiki-kuraishi/omp-skill-reread
omp plugin uninstall @taiki-kuraishi/omp-extensions   # 旧 package の場合
omp plugin uninstall @taiki-kuraishi/skill            # 既存 link の場合
```

SKILL のインストールはそのまま維持する。extension のために checkout を link し続ける必要はない。

## テスト

このディレクトリで実行する。

```bash
bun vp run test
```

## License

[Apache License 2.0](LICENSE)。著作権の表示は [NOTICE](NOTICE) にある。
