# AI販促・運営キット — MVP

院・サロン向けデジタル商品を、制作→検査→オーナー承認→手動公開へ進める管理システムです。Next.js / TypeScript、Supabase、OpenAI、Python/openpyxlで実装しています。

**現状は接続前の開発完成版です。販売開始・本番配備はしていません。** 外部サービスの契約・認証情報が必要なため、自動で契約・接続していません。GitHub Pages単体では動きません。

## プログラミングが初めての方へ

最初の接続作業は設定担当者と行ってください。一度接続すれば、iPhoneのSafariで管理画面を開いて確認できます。操作説明は[OWNER-GUIDE.md](docs/OWNER-GUIDE.md)、実装したもの・未接続部分・費用は[REPORT.md](docs/REPORT.md)にあります。

## 動く機能

- オーナーログイン、管理画面、権限判定、履歴保存、入力チェック。
- 調査・企画・制作・検査・承認依頼の工程と未接続時の停止。
- 共通素材→ライト4本／スタンダード12本／プレミアム20本へのSNS振り分け、ブログ2/4本、プロンプト5個等。
- PythonでExcel3種を生成・検査し、3プランのZIPを作成。
- ハッシュ固定の承認、差し戻し、予定日前停止、手動配信チェックリスト。
- 月次Cronエンドポイント、重複実行防止、AI費用の予約と月額上限、メールアダプターと画面内通知。
- 3プランの販売ページ、無料サンプル、note導線、価格・URL設定。
- 集計CSV・手入力による実績、解約率・費用・推定利益。未登録は未連携。

## ローカル起動（設定担当者向け）

Node.js 22以上、Python3.12を推奨します。

```sh
npm ci
python -m pip install openpyxl==3.1.5
cp .env.example .env.local
```

`.env.local`で次を設定します。値は自分で作成し、共有しないでください。

```dotenv
APP_MODE=local
APP_URL=http://127.0.0.1:3000
SESSION_SECRET=32文字以上のランダム文字列に置換
LOCAL_OWNER_PASSWORD=12文字以上の固有パスワードに置換
```

```sh
npm run dev
```

http://127.0.0.1:3000/login へアクセス。ローカルではメール欄は空でも使えます。「制作フロー」→「検証用セットを作成」で、AIなしでExcel生成・ファイル保存・プレビュー・差し戻しを確認できます。検証用素材は販売承認できません。

実データは`.data`に保存（Git管理対象外）。開発者が強制終了してstate.lockが残った場合、プロセスが停止したことを確認してロックだけ削除してください。マルチサーバー運用にはこの保存方式を使わずSupabaseを設定します。

## 本番設定

[SETUP.md](docs/SETUP.md)に手順を記載。GitHubリポジトリ内の`ai-business`フォルダーをVercelのRoot Directoryとして設定します。販売ページと管理画面は同じNext.jsアプリです。

外部サービス：Supabase／OpenAI／Brave Search／Pythonワーカーのホスト／Resend等通知サービス／Vercel等ホスト／note。APIキーはサーバー環境変数だけに置きます。

## テスト

```sh
npm test
npm run build
```

ブラウザー検証はPlaywrightとChromiumがある環境で、ビルド後に実行します。

```sh
CHROMIUM_PATH=/usr/bin/chromium node tests/browser.cjs
```

テスト専用のランダムな認証情報と一時保存先を使い、実際のAPI・決済を呼びません。Excel自体の数式再計算はExcel/Googleスプレッドシートで別途確認が必要です。
