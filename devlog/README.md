# devlog(開発メモ)

このディレクトリは devblog パイプラインの任意の素材源です。書かなくても
コミット履歴と OpenSpec チェンジ情報だけで記事は生成されます([design.md](../openspec/changes/dev-blog-auto-publish/design.md) D9)。

## 書き方

ファイル名: `YYYY-MM-DD.md`(1 日 1 ファイル。同日に複数追記する場合は追記でよい)

```markdown
## 学び
- ハマったこと・わかったことを 1〜2 行で

## 参照
- https://example.com/参考にした記事

## 埋め込み候補
- https://twitter.com/xxx/status/xxx
- https://youtube.com/watch?v=xxx
```

すべてのセクションは任意。書いた分だけ `devblog collect` が拾い、記事のダイジェストに含める。

## 注意

- 機密情報(APIキー・内部URL・個人情報)は書かない。`devblog scan` で検査されるが、
  収集対象そのものに含めないことが一番安全
