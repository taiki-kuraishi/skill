---
name: kstack-gdscript
description: "Godot 4 の GDScript（.gd）と GdUnit4 のテストを書く・修正する・レビューするときの規約。class・signal・const・公開 var・すべての関数に日本語の `##` doc comment を書くこと、変数・引数・戻り値・ループ変数の型アノテーションを明示し `:=` の推論を使わないこと、project.godot の GDScript warning（untyped_declaration・inferred_declaration・unsafe_*）を error にして型チェックを強制すること、複数の段を持つ関数を step 番号付きの doc と `# stepN` コメントで書くこと、GdUnit4 のテスト関数の上にテスト内容を日本語で書くことを扱う。Godot のノード script・autoload・Resource の作成、project.godot の編集、テスト追加、レビュー指摘への対応でも発火させる。"
---

# kstack-gdscript

Godot 4 の GDScript と GdUnit4 テストの規約。理由を理解した上で適用すること。

## 宣言すべてに日本語の `##` doc comment を書く

class・signal・const・公開 var・関数（private の `_` 始まりを含む）の直前に `##` で書く。関数には引数・戻り値・null を返す条件・emit する signal を含める。

```gdscript
# Bad: 名前だけでは量の単位も副作用も分からない
const GAIN_PER_CLICK: int = 1
func click() -> int:

# Good: 意味と契約を doc に書く
## 1 回のクリックで増えるスコア。
const GAIN_PER_CLICK: int = 1

## 残高と累計獲得を GAIN_PER_CLICK だけ増やす。
## emit: balance_changed（増えた後の残高）
## return: 今回獲得した量
func click() -> int:
```

なぜ: `##` はエディタのヘルプとホバーに出る Godot の doc comment で、呼び出し側が実装を開かずに契約を読める。「これは何？」とレビューで聞かれる宣言は、doc が無いことの表れ。

## 型アノテーションを明示し、`:=` で推論させない

変数・引数・戻り値・ループ変数に型を書く。右辺から明らかでも `:=` を使わない。

```gdscript
# Bad
var json := JSON.new()
for item in items:

# Good
var json: JSON = JSON.new()
for item: Item in items:
```

なぜ: 型が書かれていれば宣言だけで読め、静的型の解析で誤りがエディタ上で見つかる。`:=` は右辺を変えると黙って型が変わる。

## 型チェックは project.godot の warning を error にして強制する

`untyped_declaration`・`inferred_declaration`・`unsafe_*` を error（`2`）にする。vendoring した addon には効かせない。

```ini
[debug]
gdscript/warnings/exclude_addons=true
gdscript/warnings/untyped_declaration=2
gdscript/warnings/inferred_declaration=2
gdscript/warnings/unsafe_property_access=2
gdscript/warnings/unsafe_method_access=2
gdscript/warnings/unsafe_cast=2
gdscript/warnings/unsafe_call_argument=2
```

なぜ: 規約だけでは型の書き忘れが残る。error にすれば script が読み込めず、CI と editor の両方で止まる。addon は自分で直せないので除外する。

## 複数の段を持つ関数は step 番号付きの doc と `# stepN` コメントで書く

doc に何を処理するかの 1 行と番号付きの step を並べ、本文の各 step の先頭に同じ文言で `# stepN: ...` を書いて空行で区切る。

<!-- markdownlint-disable MD010 -- GDScript は tab でインデントする -->

```gdscript
## セーブ文字列から状態を復元する。parse に失敗したら null を返す。
## 1. 文字列を JSON として parse する
## 2. parse した Dictionary から状態を作って return する
static func from_save_string(text: String) -> ScoreState:
	# step1: 文字列を JSON として parse する
	var json: JSON = JSON.new()
	if json.parse(text) != OK:
		return null

	# step2: parse した Dictionary から状態を作って return する
	var data: Dictionary = json.data
	return ScoreState.new(data)
```

<!-- markdownlint-enable MD010 -->

なぜ: doc で手順を一覧でき、本文のどこがどの段かを番号で辿れる。doc と本文の文言を揃えると、段を足し引きしたときにずれが見つかる。

## GdUnit4 のテスト関数の上に、テスト内容を日本語で書く

```gdscript
# Bad
func test_click_increases_balance() -> void:

# Good
## click を 1 回呼ぶと、残高が GAIN_PER_CLICK だけ増える。
func test_click_increases_balance() -> void:
```

なぜ: 関数名は英語で短く切られるため、何を保証するテストかは日本語の 1 文の方が速く読め、失敗時に意図と照らせる。
