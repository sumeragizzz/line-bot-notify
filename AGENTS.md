# LINE Bot Notify

このプロジェクトは、TypeScript で構成された Cloudflare Workers 上で動作する LINE Bot です。HTTP レイヤーには Hono を使い、LINE Messaging API には公式の SDK を利用します。

## プロジェクトの目的

- LINE Messaging API からのイベントを受け取る webhook エンドポイントを実装する。
- Node.js サーバーではなく Cloudflare Workers 上で動作させる。
- TypeScript と Hono を使って REST API ルートとリクエスト処理を実装する。
- 署名検証、イベント解析、メッセージ送信に公式の `@line/bot-sdk` を利用する。
- シークレットは Cloudflare Worker の secrets / 環境変数として管理し、ソースコードに含めない。

## 重要なルール

- HTTP フレームワークとして Hono を優先して使う。
- LINE のリクエスト解釈には独自実装ではなく `@line/bot-sdk` を優先する。
- Worker のエントリーポイントは `src/index.ts` に置き、デフォルトの `fetch` ハンドラーを export する。
- Cloudflare 固有の設定は `wrangler.jsonc` に置き、binding を変更したら型を再生成する。
- LINE の webhook リクエストはイベント処理の前に署名検証を必ず行う。
- Workers 向け API のみを使い、Node.js 専用モジュールや Express 風の実装を避ける。

## 推奨パターン

- Hono アプリを定義し、`export default { fetch: app.fetch }` などの Worker 形式で公開する。
- LINE webhook 用のルートは `/callback` や `/webhook` のような POST リクエストとして実装する。
- リクエストボディは Workers で安全に扱える形式で取得し、LINE SDK のバリデータに渡す。
- `cloudflare:test` と Vitest を使って Worker レベルのテストを作成し、実際の HTTP 振る舞いを確認する。
- 環境変数を追加する場合は `wrangler.jsonc` の `vars` や Worker secrets を使い、必要なキーをコード内で明示する。

## 実行コマンド

| Command | 目的 |
| --- | --- |
| `npm run dev` | Wrangler で Worker をローカル実行 |
| `npm run test` | Vitest のテストを実行 |
| `npm run deploy` | Worker をデプロイ |
| `npm run cf-typegen` | Cloudflare の型定義を再生成 |

## 依存関係の方針

- REST API 層には `hono` を使う。
- LINE Messaging API との通信には `@line/bot-sdk` を使う。
- 依存パッケージは Cloudflare Workers と互換性のあるものにする。

## 参照すべきドキュメント

- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Hono: https://hono.dev/
- LINE Messaging API: https://developers.line.biz/ja/docs/messaging-api/
- LINE SDK: https://github.com/line/line-bot-sdk-nodejs

## 安全性と正確性

- LINE のチャンネルシークレットやアクセストークンをログ、テスト、コミット対象に含めない。
- webhook 処理では、必ず署名検証を行ってからイベントを処理する。
- 環境変数を追加する場合は、Worker の `env` から読み取るようにする。
- Cloudflare の制限や上限に関わる作業は、記憶に依存せず公式ドキュメントで確認する。
