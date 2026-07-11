# infrastructure-as-code Specification

## Purpose
TBD - created by archiving change modern-cloud-infra. Update Purpose after archive.
## Requirements
### Requirement: 全リソースの宣言的管理
すべてのクラウドリソースは、宣言的な Infrastructure as Code としてバージョン管理リポジトリで定義されなければならない (MUST)。クラウドコンソールからの手動変更は本番環境で行ってはならない (MUST NOT)。

#### Scenario: リソースはコードから作成される
- **WHEN** 新しいクラウドリソースが必要になったとき
- **THEN** IaC 定義への変更がプルリクエストとしてレビュー・マージされ、その適用によってのみリソースが作成される

#### Scenario: 手動変更のドリフト検出
- **WHEN** IaC 定義と実際のリソース状態に差分（ドリフト）が発生したとき
- **THEN** 定期的なドリフト検出がその差分を検知し、運用者へ通知する

### Requirement: リモート状態管理
IaC の状態ファイルは、ロック機構と暗号化を備えたリモートバックエンドで管理されなければならない (MUST)。

#### Scenario: 同時実行の防止
- **WHEN** 2 つの適用処理が同時に実行されようとしたとき
- **THEN** 状態ロックにより後発の処理は待機または失敗し、状態の破損が防止される

### Requirement: 環境の分離と再現性
dev / staging / prod の各環境は、同一の IaC 定義から環境別パラメータのみを変えて構築できなければならない (MUST)。環境間で状態と権限は分離されなければならない (MUST)。

#### Scenario: 環境の再構築
- **WHEN** 任意の環境をゼロから再構築するとき
- **THEN** IaC の適用のみで、手動手順なしに同等の環境が再現される

#### Scenario: 環境間の影響遮断
- **WHEN** dev 環境への適用が失敗または誤操作されたとき
- **THEN** staging / prod 環境のリソースと状態には影響しない

### Requirement: 適用前の検証
IaC の変更は、適用前に構文検証・ポリシーチェック（セキュリティ／命名／タグ付け規約）・実行計画のレビューを通過しなければならない (MUST)。

#### Scenario: ポリシー違反のブロック
- **WHEN** 暗号化されていないストレージを作成する変更が提案されたとき
- **THEN** CI のポリシーチェックが失敗し、マージがブロックされる

