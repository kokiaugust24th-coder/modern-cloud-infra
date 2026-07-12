# 開発ブログ自動投稿 セットアップガイド(要手動対応)

このリポジトリは [openspec/changes/dev-blog-auto-publish](../openspec/changes/dev-blog-auto-publish)
の仕様に基づく、開発ログのブログ自動下書き・PR 公開パイプラインです。コード・CI は
`tools/devblog/` と `.github/workflows/devblog.yml` に揃っていますが、以下はアカウント作成や
外部サービス連携を伴うため、あなた自身の操作が必要です。

## 1. 公開用リポジトリの作成 ✅ 完了(2026-07-12)

1. GitHub 上に新しい**別リポジトリ**を作成する(例: `kochan-um/devblog`)。本リポジトリとは
   権限・シークレットを分離するため、必ず別リポジトリにする([design.md](../openspec/changes/dev-blog-auto-publish/design.md) D1)
   → `kokiaugust24th-coder/devblog` を作成済み
2. 作成したリポジトリに `articles/` ディレクトリと `published.jsonl`(空ファイルで可)を作成する
   → 追加済み。`.github/workflows/record-publish.yml`・`stale-pr-close.yml`・`scripts/record-publish.mjs` も配置済み
3. リポジトリの Settings > Actions > General で「Allow GitHub Actions to create and approve pull requests」を有効にする
   (本リポジトリの CI から Personal Access Token 経由で PR を作成するため)→ 未確認。必要なら有効化する

## 2. Zenn の GitHub 連携 ✅ 完了(2026-07-12)

1. https://zenn.dev でアカウントを作成し、GitHub でサインインする
2. Zenn のダッシュボード > デプロイ設定 で、手順1で作成した公開用リポジトリを連携する
   → `kokiaugust24th-coder/devblog`(対象ブランチ `main`)のみを連携済み。誤って連携していた
   本リポジトリと無関係なリポジトリの連携は解除済み
3. 連携後、公開用リポジトリの `articles/*.md` を `main` にマージすると Zenn に自動反映される
   (`published: true` の記事のみ公開される)

## 3. PR 作成用の GitHub Personal Access Token

本リポジトリの CI から公開用リポジトリへ PR を作成するため、fine-grained PAT が必要:

1. GitHub > Settings > Developer settings > Fine-grained tokens で新規発行
2. 対象リポジトリ: 手順1の公開用リポジトリのみ
3. 権限: `Contents: Read and write`、`Pull requests: Read and write`
4. 本リポジトリ(このリポジトリ)の Settings > Secrets and variables > Actions に
   `DEVBLOG_PUBLISH_REPO_TOKEN` として登録する

## 4. LLM API キー

記事生成の LLM は `tools/devblog/devblog.config.json` の `llm` セクションで切り替え可能(コード変更不要)。
現在の既定は **GLM-5.2(Z.ai)**(コスパ重視: 入力 $1.4/出力 $4.4 per 1M トークン。詳細は
[tools/devblog/README.md](../tools/devblog/README.md) のコスト比較を参照)。

1. https://z.ai で API キーを発行する
2. 本リポジトリの Secrets に `DEVBLOG_LLM_API_KEY` として登録する
3. ローカル実行する場合は `tools/devblog/.env.example` を `.env` にコピーして値を設定する

**別プロバイダに切り替える場合**: `devblog.config.json` の `llm.provider`
(`"anthropic"` | `"openai-compatible"`)・`llm.model`・`llm.baseUrl`・`llm.apiKeyEnvVar` を書き換えるだけでよい。
`apiKeyEnvVar` を変えた場合は対応する Secret 名も合わせて登録すること。

## 5. GitHub リポジトリの Secrets 一覧(本リポジトリ側)

| Secret | 用途 |
|---|---|
| `DEVBLOG_LLM_API_KEY` | 記事下書き生成(構成案・本文・自己批評の LLM 呼び出し。既定は GLM-5.2/Z.ai) |
| `DEVBLOG_PUBLISH_REPO_TOKEN` | 公開用リポジトリへの PR 作成(fine-grained PAT) |
| `DEVBLOG_PUBLISH_REPO` | 公開用リポジトリの `owner/repo`(例: `kokiaugust24th-coder/devblog`) |

## 6. 公開用リポジトリ側のワークフロー(台帳追記・自動クローズ)

公開用リポジトリに以下 2 つのワークフローを追加する(テンプレートは
[tools/devblog/templates/publish-repo-workflows/](../tools/devblog/templates/publish-repo-workflows/) を参照してコピーする):

- `record-publish.yml`: PR が `main` にマージされた際に `published.jsonl` へ追記する
- `stale-pr-close.yml`: 30 日間レビューされていない devblog PR を自動クローズする

## 7. 開発メモ(任意)

`devlog/` 配下に日付付き Markdown を置くと記事の素材になる。書式は
[devlog/README.md](../devlog/README.md) を参照。書かなくてもコミットと OpenSpec 情報だけで
記事は生成される。

## 完了確認チェックリスト

- [x] 公開用リポジトリを作成し、`articles/` ディレクトリと空の `published.jsonl` を用意した
- [x] Zenn の GitHub 連携を設定した
- [x] 公開用リポジトリに `record-publish.yml` と `stale-pr-close.yml` を追加した
- [x] `DEVBLOG_PUBLISH_REPO_TOKEN` / `DEVBLOG_PUBLISH_REPO` / `DEVBLOG_LLM_API_KEY` を本リポジトリの
      Secrets に登録した(2026-07-12)
- [ ] `.github/workflows/devblog.yml` を `workflow_dispatch` で手動実行し、公開用リポジトリに
      PR が作成されることを確認した(初回ドライラン)
