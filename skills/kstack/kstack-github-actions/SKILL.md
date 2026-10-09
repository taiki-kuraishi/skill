---
name: kstack-github-actions
description: GitHub Actions の workflow（.github/workflows/*.yml）を書く・修正する・レビューするときの規約。job の runs-on は ubuntu-slim を既定にし、Docker を使う job や slim で 15 分以内に終わらない job だけを ubuntu-latest にすることを扱う。CI の job の追加、lint・テスト・build の job の新設、runner の見直し、レビュー指摘への対応でも発火させる。
---

# kstack-github-actions

[GitHub Actions](https://docs.github.com/actions) を書くときの規約。理由を理解した上で適用すること。

## job は ubuntu-slim で動かし、slim で動かない job だけ ubuntu-latest にする

`runs-on` は `ubuntu-slim` を既定にする。依存の install や lint・build を含む job も、slim で動くなら slim にする。`ubuntu-latest` に置くのは、次のどれかに当たる job だけにする。

- Docker を使う job（`docker build`・`docker run`、job の `container:`・`services:`、`action.yml` の `runs.using` が `docker` の action）
- slim で走らせると 15 分以内に終わらない job（1 vCPU なので、標準の runner での所要時間では判断しない）
- 5 GB の RAM に収まらない job

```yaml
# Bad: slim で動く job に、標準の runner を割り当てている
lint:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v7
    - uses: jdx/mise-action@v5
      with:
        install_args: "bun node"
    - run: bun ci
    - run: bun run lint

# Good: steps はそのままで、runner だけを替える
lint:
  runs-on: ubuntu-slim
  timeout-minutes: 10
```

```yaml
# Good: Docker を使う job は slim で動かないので、標準の runner に置く
build-image:
  runs-on: ubuntu-latest
  timeout-minutes: 15
  steps:
    - uses: actions/checkout@v7
    - run: docker build -t app .
```

なぜ: ubuntu-slim は標準の runner より分単価が安い。slim で動かない原因は、1 vCPU・5 GB RAM の unprivileged な container で動くこと（Docker の daemon が無く、特権の要る操作もできない）と、job が `timeout-minutes` に関係なく 15 分で打ち切られることに限られるので、それに当たらない job は slim に載せる。
