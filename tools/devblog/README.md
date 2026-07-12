# devblog — 開発ログのブログ自動下書き・公開パイプライン

[openspec/changes/dev-blog-auto-publish](../../openspec/changes/dev-blog-auto-publish) の実装。
「収集 → 下書き生成 → 安全性検査 → 人間承認(PR レビュー) → 公開」を自動化する。
アカウント作成など人手が必要なセットアップは [docs/devblog-setup.md](../../docs/devblog-setup.md) を参照。

## 構成

```
src/
  collect/    Git コミット・OpenSpec チェンジ・devlog の収集(devblog collect)
  generate/   3段生成(構成案→本文→自己批評)・記事リンター(devblog generate)
    providers/  LLM プロバイダ実装(anthropic.ts / openaiCompatible.ts / factory.ts)。
                devblog.config.json の llm.provider を変えるだけでモデルを切り替えられる
  scan/       決定的パターンによる機密情報検査(devblog scan)
  publish/    Zenn アダプタ・PR 作成・重複防止(devblog publish)
  ledger.ts   公開履歴台帳(published.jsonl)の読み書き
  cli.ts      CLI エントリポイント
templates/    記事テンプレート・スタイルガイド・品質ルーブリック(版管理)
templates/publish-repo-workflows/  公開用リポジトリ側に配置するワークフロー
```

## コマンド

```bash
npm ci

# 1. 収集(過去7日分。--since/--until/--force で調整可能)
npx tsx src/cli.ts collect

# 2. 生成(DEVBLOG_LLM_API_KEY が必要)
npx tsx src/cli.ts generate --digest .devblog/digests/digest-xxxx.json

# 3. 検査
npx tsx src/cli.ts scan --article .devblog/drafts/digest-xxxx.md

# 4. 公開(DEVBLOG_PUBLISH_REPO / DEVBLOG_PUBLISH_REPO_TOKEN が必要)
npx tsx src/cli.ts publish --article .devblog/drafts/digest-xxxx.md \
  --digest .devblog/digests/digest-xxxx.json \
  --scan .devblog/drafts/digest-xxxx.scan.json

# まとめて実行(CI が使うコマンド)
npx tsx src/cli.ts run
```

## LLM プロバイダとコストの試算

LLM は `devblog.config.json` の `llm` セクションで切り替え可能(コード変更不要):

```json
"llm": {
  "provider": "openai-compatible",  // "anthropic" | "openai-compatible"
  "model": "glm-5.2",
  "baseUrl": "https://api.z.ai/api/paas/v4",
  "apiKeyEnvVar": "DEVBLOG_LLM_API_KEY"
}
```

新しいプロバイダを追加する場合は `src/generate/providers/` に `LlmClient` 実装を1つ追加し、
`factory.ts` の `switch` に1ケース足すだけでよい(生成パイプライン側は一切変更不要)。

**既定は GLM-5.2(Z.ai)** — 調査時点(2026-07-12)の公式価格比較:

| モデル | 入力($/100万tok) | 出力($/100万tok) | 備考 |
|---|---|---|---|
| **GLM-5.2(既定)** | $1.40 | $4.40 | [Z.ai 公式](https://docs.z.ai/guides/overview/pricing) |
| Claude Haiku 4.5 | $1.00 | $5.00 | [Anthropic 公式](https://platform.claude.com/docs/en/about-claude/pricing) |
| Gemini 2.5/3.1 Flash-Lite | $0.10〜$0.25 | $0.40〜$1.50 | [Google 公式](https://ai.google.dev/gemini-api/docs/pricing)。さらに安いが未実装(OpenAI互換ではないため別クライアントが必要) |
| Grok 4.5 / GLM 5.2 系フラッグシップ | $2.00〜 | $6.00〜 | フラッグシップ級で今回の用途には過剰 |

週次実行1回あたりの生成は 3 段(構成案・本文・自己批評)の LLM 呼び出しで構成される。各段の出力上限
トークン数は `src/generate/stages.ts` で以下の通り設定している:

| 段 | 出力上限トークン |
|---|---|
| 構成案(outline) | 1,500 |
| 本文(draft) | 4,000 |
| 自己批評(critique) | 4,000 |

入力側は開発ダイジェスト(コミットメタデータ + OpenSpec 抜粋 + devlog)とテンプレート/スタイルガイド/
ルーブリックの合計で、通常の週次差分であれば数千トークン程度に収まる見込み。上限フルで消費しても
GLM-5.2 では 1 回あたり数十円程度に収まる計算になるが、**初回の実運用実行後に実測値をこのセクションに
追記すること**([docs/devblog-setup.md](../../docs/devblog-setup.md) の完了確認チェックリストの一項目)。
実測値は `src/generate/index.ts` が出力する `.devblog/drafts/<slug>.generation.json` の
`metadata.stages[stage].inputTokens/outputTokens` から確認できる。

<!-- 実測値記入欄(初回実行後に更新)
- 実行日:
- 使用モデル:
- 合計トークン数(入力/出力):
- 概算コスト:
-->

## 運用手順

### 誤って機密情報が公開された場合

1. 該当する PR を即座にクローズ(マージ済みの場合は revert コミットを作成)する
2. 漏洩したキー・トークンを **即座にローテーション**する(該当サービスのダッシュボードから再発行し、旧キーを失効させる)
3. `devblog.config.json` の `excludePathPatterns` または `src/scan/patterns.ts` に該当パターンが
   欠けていた場合は追加し、テストケースを追加する

### 許可リスト(誤検出)の運用

`devblog scan` が誤検出した場合、`scan-allowlist.json`(`devblog.config.json` の `allowlistPath`)に
`src/scan/allowlist.ts` の `addToAllowlist()` でエントリを追加する。追加時は必ず `reason`(なぜ安全か)
と `addedBy` を明記し、レビューで確認できるようにする。許可リストはパターン全体ではなく特定の検出
(fingerprint)のみを免除する。

### 再収集手順

対象期間を再収集したい場合(例: 生成に失敗して digest を作り直したい)は
`devblog collect --since <ISO> --until <ISO> --force` を実行する。`--force` を付けない場合、
公開履歴台帳に記録済みの期間は自動的にスキップされる。

### 記事リンター不合格時の自動リトライ

`.github/workflows/devblog.yml` は `devblog run` が記事リンター不合格(終了コード 3)で失敗した場合、
最大 3 回まで自動的に再実行する(LLM の生成は毎回内容が変わるため、再試行で通ることが多い)。
それ以外の終了コード(Secrets 未設定・認証失敗等)は設定・実装側の問題であり再試行しても解決しないため、
即座に失敗として扱う。3 回連続で不合格の場合は、アップロードされた artifact(`.devblog/drafts/`)の
下書きとリンター結果を確認し、繰り返し発生するパターンであればスタイルガイドへの追記または
`src/generate/postprocess.ts` への決定的な後処理の追加を検討する。
