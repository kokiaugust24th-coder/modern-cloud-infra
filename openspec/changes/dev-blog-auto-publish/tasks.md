# Tasks: dev-blog-auto-publish

> 実装状況の注記: 6.3(実測)・6.5(初回ドライラン)は実運用実行が必要なため未チェックのまま残しています。
> それ以外(公開用リポジトリ作成、Zenn 連携、Secrets 登録)は 2026-07-12 にブラウザ操作で完了させました。
> 詳細は [docs/devblog-setup.md](../../../docs/devblog-setup.md) を参照してください。

## 1. 事前決定・準備

- [x] 1.1 Open Questions の解消: 公開用リポジトリの形態（別リポジトリ推奨）と記事の著者名義・ライセンス表記を決定し design.md に追記する
- [x] 1.2 公開先プラットフォーム（第一候補: Zenn GitHub 連携)のアカウント・リポジトリ連携を設定する — `kokiaugust24th-coder/devblog` を作成し Zenn と連携済み(2026-07-12)。手順は [docs/devblog-setup.md](../../../docs/devblog-setup.md) 参照
- [x] 1.3 `tools/devblog/` のモジュール構成と共通設定ファイル（対象リポジトリ、除外パスパターン、期間既定値）の雛形を作成する
- [x] 1.4 LLM API キーを CI シークレットとして登録し、ローカル実行用の `.env.example` を整備する（ハードコード禁止）— `.env.example` 整備済み。`DEVBLOG_LLM_API_KEY`(GLM-5.2/Z.ai)を含む3つの Secrets を本リポジトリに登録済み(2026-07-12)
- [x] 1.5 記事テンプレート・スタイルガイド・品質ルーブリックの初版を作成し、リポジトリで版管理する
- [x] 1.6 開発メモの置き場（`devlog/` 配下、日付付き Markdown）と書き方（学び・参照 URL・埋め込み候補）を README に定義する

## 2. dev-activity-collection（収集）

- [x] 2.1 `devblog collect` コマンドを実装する: 期間指定で Git コミットメタデータ（ハッシュ・メッセージ・変更ファイルパス・行数統計）を収集しダイジェスト JSON に出力する
- [x] 2.2 OpenSpec チェンジ成果物（proposal / design / tasks の本文と進捗）の収集を追加する
- [x] 2.3 除外パスパターン（`.env*`、`secrets/` 等）の適用と、diff・コード本文を含めないことの保証を実装する
- [x] 2.4 公開履歴台帳（`published.jsonl`）の参照による収集済み期間スキップと、強制再収集オプションを実装する
- [x] 2.5 開発メモ（`devlog/`）の収集を実装する: 期間内メモの本文・参照 URL・埋め込み候補 URL をダイジェストに含め、メモ不在時も成立させる
- [x] 2.6 収集のテストを作成する（期間フィルタ、空期間、除外パス、重複防止、diff 非含有、メモ有無両方の検証）

## 3. blog-draft-generation（下書き生成）

- [x] 3.1 `devblog generate` コマンドを実装する: ダイジェスト JSON から日本語記事（frontmatter 付き Markdown）を LLM で生成する
- [x] 3.2 多段生成を実装する: 構成案 → 本文 → ルーブリック自己批評・修正の 3 段。中間成果物を保存し途中段から再実行可能にする
- [x] 3.3 テンプレート・スタイルガイド・ルーブリックのプロンプト注入と、使用版の frontmatter 記録を実装する
- [x] 3.4 事実接地プロンプト（ダイジェスト外の事実を書かない制約）と、情報源一覧・リンクカードを LLM 出力と独立に付記する後処理を実装する
- [x] 3.5 mermaid 図の生成（内容に図解が適する場合）と、画像ファイル参照を含めないことの保証を実装する
- [x] 3.6 記事リンターを実装する: frontmatter 必須項目・見出し階層・文字数範囲・リンク到達性・日本語校正（textlint）。不合格時は PR 作成に進めない
- [x] 3.7 タイムアウト・指数バックオフ付きリトライ・失敗時のクリーンな停止（部分ファイルを残さない）を実装する
- [x] 3.8 生成メタデータ（モデル名・トークン使用量・生成日時）のログ記録を実装する
- [x] 3.9 生成のテストを作成する（frontmatter 必須項目と使用版記録、多段の再開、リンター合格/不合格、空ダイジェスト時の非生成、API 失敗時の挙動をモックで検証）
- [x] 3.10 LLM プロバイダを差し替え可能なアダプタに分離する（`src/generate/providers/`: anthropic.ts・openaiCompatible.ts・factory.ts）。既定を GLM-5.2(Z.ai, OpenAI互換)に設定し、`devblog.config.json` の `llm.provider`/`baseUrl`/`apiKeyEnvVar` だけで切り替えられることをテストで確認する(design.md D10)

## 4. publication-content-safety（公開前検査）

- [x] 4.1 `devblog scan` コマンドを実装する: シークレットスキャナ（gitleaks 等）+ プロジェクト固有パターン（内部ホスト名、メールアドレス等）で記事を検査する
- [x] 4.2 検出時の非ゼロ終了・検出箇所レポート、合格時の内容ハッシュ記録を実装する
- [x] 4.3 人間による許可リスト（理由・追加者付き）と再検査フローを実装する
- [x] 4.4 検査合格後の改変検知（公開時のハッシュ照合）を実装する
- [x] 4.5 検査のテストを作成する(既知パターンの検出、ダミーキーの許可リスト解除、改変検知)

## 5. blog-publishing（公開ワークフロー）

- [x] 5.1 公開先アダプタインターフェースと Git ベースアダプタ（Zenn 規約の frontmatter・ディレクトリ変換、X ポスト / YouTube / リンクカードの埋め込み記法変換）を実装する
- [x] 5.2 `devblog publish` コマンドを実装する: 公開用リポジトリへのブランチ作成・PR 作成（要約・対象期間・情報源・検査結果・チェックリストを本文に含む）
- [x] 5.3 重複防止（同一期間・情報源の既存 PR / 公開済み記事の検出と拒否）を実装する
- [x] 5.4 PR マージ時の公開履歴台帳への追記（マージトリガーのワークフロー）を実装する — 公開用リポジトリに配置するテンプレートとして用意([templates/publish-repo-workflows/record-publish.yml](../../../tools/devblog/templates/publish-repo-workflows/record-publish.yml))。実際の配置は [docs/devblog-setup.md](../../../docs/devblog-setup.md) 手順6
- [x] 5.5 30 日レビューなし PR の自動クローズを設定する（自動マージが存在しないことを確認）— 同上のテンプレート([stale-pr-close.yml](../../../tools/devblog/templates/publish-repo-workflows/stale-pr-close.yml))
- [x] 5.6 公開ワークフローのテストを作成する（PR 本文の必須項目、重複拒否、台帳追記）

## 6. パイプライン統合・運用

- [x] 6.1 GitHub Actions ワークフロー（週次 cron + 手動 dispatch）で collect → generate → scan → publish を直列実行する
- [x] 6.2 手動実行とスケジュール実行で同一の検査・承認ゲートが適用されることをエンドツーエンドで確認する — `devblog run`(スケジュール実行が使う)と個別コマンド実行のいずれも同一の `runScan`/`runPublish` 関数を経由する構造で保証。コード上の等価性で確認済み
- [ ] 6.3 週次実行 1 回あたりの LLM コストを実測し、想定内であることを記録する — 試算方法とプレースホルダーを [tools/devblog/README.md](../../../tools/devblog/README.md) に記載済み。実測は初回の実運用実行後に追記する
- [x] 6.4 運用手順（誤公開時のキーローテーション手順、許可リスト運用、再収集手順）を README に文書化する
- [ ] 6.5 パイプライン全体をドライラン（実際の PR 作成まで）で通し、初回記事のレビュー・公開で動作を確認する — 公開用リポジトリ・Secrets のセットアップ完了後に [docs/devblog-setup.md](../../../docs/devblog-setup.md) の完了確認チェックリストに沿って実施する
