# @taiki-kuraishi/omp-skill-reread

kstack のワークフローを補助する omp extension を GitHub Packages から配布する。

## 責務

- 実装すること: omp のイベントを受け、`kstack-super-agent` の圧縮後の復旧を促す extension。
- 実装しないこと: SKILL のインストール、router / lead の起動と台帳管理、lint 設定の配布。

## セットアップ

GitHub Packages は public package の install にも認証を求める。`read:packages` を持つ classic PAT を `NODE_AUTH_TOKEN` に設定し、Bun が読むユーザーレベルの `.npmrc` に次の設定を置く。このファイルに同じ scope の oxlint 等の設定がすでにあれば共用できる。

通常は `~/.npmrc` を使う。`NPM_CONFIG_USERCONFIG` を指定している場合はそのファイル、指定がなく `$XDG_CONFIG_HOME/.npmrc` が存在する場合はそちらを使い、`~/.npmrc` は読まれない。

```ini
@taiki-kuraishi:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

omp は利用 repo ではなく profile の plugins ディレクトリで依存を install するため、利用 repo の `.npmrc` だけでは認証設定が反映されない。

router と同じ profile で install し、omp を再起動する。

```bash
omp install @taiki-kuraishi/omp-skill-reread
```

named profile の場合は、以降の install・更新・移行コマンドにも同じ `OMP_PROFILE` を付ける。

```bash
OMP_PROFILE=your-profile omp install @taiki-kuraishi/omp-skill-reread
```

## 使い方

SKILL は別途 `bunx skills add taiki-kuraishi/skill` でインストールする。router の session 名を `/alias superagent` で設定する。復旧の条件と操作は [kstack-super-agent](https://github.com/taiki-kuraishi/skill/blob/main/skills/kstack/kstack-super-agent/SKILL.md#状態を失ったとき) を参照。

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
