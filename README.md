# Video Automation Studio

AI駆動の解説動画自動生成プラットフォーム

## 概要

Video Automation Studioは、台本（Markdown）から動画までの制作プロセスを半自動〜自動化するためのツールキットです。LLMを活用して、スクリプトの整形、セクション分割、スライド設計、動画オーケストレーションを行います。

### 主な機能

- **台本整形**: LLMによる文体統一、誤字修正、表記揺れの解消
- **セクション分割**: 意味段落ごとの自動分割と意図タグ付け
- **スライド設計**: テンプレートベースの制約付きスライド生成
- **バリデーション**: 文字密度、表示時間、音声同期の自動チェック
- **マルチインターフェース**: CLI、REST API、プログラマティック利用

## アーキテクチャ

```
[台本 Markdown]
    ↓
[Script Service] → LLM整形・分割
    ↓
[Slide Planner AI] → テンプレート選択
    ↓
[Slide Renderer] → Marp/HTML生成
    ↓
[Video Orchestrator] → Remotion統合（予定）
    ↓
[動画ファイル]
```

## インストール

```bash
# リポジトリのクローン
git clone <repository-url>
cd video-automation-studio

# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

## 設定

### 環境変数の設定

プロジェクトルートに`.env`ファイルを作成し、以下の環境変数を設定してください：

```env
# LLM設定（OpenAIまたはAnthropicのいずれか）
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview

# または

ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# TTS設定（ElevenLabsまたはOpenAI TTS）
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# ストレージ設定（オプション）
STORAGE_BASE_DIR=./data

# ログレベル（オプション）
LOG_LEVEL=INFO
```

### ストレージの初期化

初回実行時にストレージディレクトリが自動作成されます。手動で初期化する場合は：

```bash
npm run cli -- info
```

これにより、必要なディレクトリが作成されます。

## 使い方

### CLI使用例

#### 1. 台本の取り込み

```bash
npm run cli -- studio:ingest ./examples/sample-script.md --title "サンプル動画" --author "Your Name"
```

実行後、スクリプトIDが表示されます。このIDを以降のコマンドで使用します。

#### 2. 台本の整形

ストレージを使用する場合（推奨）：
```bash
npm run cli -- studio:normalize dummy --script-id <script-id>
```

ファイルを使用する場合：
```bash
npm run cli -- studio:normalize ./data/scripts/<script-id>.json
```

#### 3. セクション分割

ストレージを使用する場合（推奨）：
```bash
npm run cli -- studio:segment dummy --script-id <script-id>
```

ファイルを使用する場合：
```bash
npm run cli -- studio:segment ./data/scripts/<script-id>.json
```

#### 4. スライド設計

ストレージを使用する場合（推奨）：
```bash
npm run cli -- slides:plan dummy --script-id <script-id>
```

ファイルを使用する場合：
```bash
npm run cli -- slides:plan ./data/sections/<script-id>.json
```

#### 5. スライドのレンダリング（Marp Markdown生成）

```bash
npm run cli -- slides:render ./data/slides/<script-id>.json -o ./output/slides.md
```

#### 6. Marp CLIでPDF/PNG変換

```bash
npx @marp-team/marp-cli ./output/slides.md -o ./output/slides.pdf
```

### API Server使用例

#### サーバーの起動

```bash
npm run server:start
# または
npm run cli -- server:start --port 3000
```

#### API エンドポイント

**台本の取り込み**
```bash
curl -X POST http://localhost:3000/script/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "title": "サンプル動画",
    "markdown": "# イントロ\n\nこれはサンプルです。",
    "author": "Your Name"
  }'
```

**台本の整形**
```bash
curl -X POST http://localhost:3000/script/normalize \
  -H "Content-Type: application/json" \
  -d '{"scriptId": "<script-id>"}'
```

**セクション分割**
```bash
curl -X POST http://localhost:3000/script/segment \
  -H "Content-Type: application/json" \
  -d '{"scriptId": "<script-id>"}'
```

**スライド設計**
```bash
curl -X POST http://localhost:3000/slides/plan \
  -H "Content-Type: application/json" \
  -d '{"scriptId": "<script-id>"}'
```

**ヘルスチェック**
```bash
curl http://localhost:3000/health
```

## プロジェクト構造

```
video-automation-studio/
├── src/
│   ├── types/           # TypeScript型定義
│   ├── services/        # ビジネスロジック
│   │   ├── scriptService.ts    # 台本処理サービス
│   │   ├── slideService.ts     # スライド生成サービス
│   │   ├── llmService.ts       # LLMクライアントサービス
│   │   ├── storageService.ts   # ストレージサービス
│   │   ├── audioService.ts     # 音声生成サービス
│   │   ├── remotionService.ts  # Remotionコード生成サービス
│   │   └── renderJobService.ts # レンダリングジョブ管理
│   ├── prompts/         # LLMプロンプト管理
│   ├── validators/      # バリデーション機能
│   ├── api/            # Express APIサーバー
│   ├── cli/            # CLIツール
│   └── utils/          # ユーティリティ
├── templates/          # スライドテンプレート定義
├── data/              # データストレージ（自動生成）
│   ├── scripts/       # 台本データ
│   ├── sections/      # セクションデータ
│   ├── slides/        # スライド仕様
│   ├── render-jobs/   # レンダリングジョブ
│   └── output/        # 出力ファイル
├── examples/          # サンプルファイル
└── package.json
```

## テンプレート

デフォルトで以下のスライドテンプレートが利用可能：

- **bullet-hero**: 大見出し＋最大3行の要点
- **quote+visual**: 印象的な一言＋背景イメージ
- **diagram**: 関係/流れの可視化（Mermaid対応）
- **title-slide**: タイトルスライド
- **section-header**: セクション見出し
- **two-column**: 左右2カラムレイアウト
- **fullscreen-image**: 全画面イメージ＋キャプション
- **code-snippet**: コードスニペット表示

カスタムテンプレートは`templates/`ディレクトリに追加できます。

## バリデーション

以下の自動チェックが実装されています：

- **テンプレート制約**: 文字数、行数、箇条書き数の制限
- **音声密度**: 12〜28文字/秒の範囲チェック
- **タイミング同期**: 字幕の重複や大きなギャップの検出
- **アセット検証**: 画像/音声ファイルのパス確認

## 開発

### TypeScriptのウォッチモード

```bash
npm run dev
```

### 型チェック

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

### テスト

```bash
npm test
```

## ロードマップ

### M1 (POC) ✅
- テンプレ3種、Marp→Remotionまで最短経路
- VOICEPEAK連携（予定）

### M2 (Beta)
- illustration/diagram拡張
- ポーズGUI
- Canva自動アップロード

### M3 (1.0)
- Lint/自動評価パス
- テンプレ自動チューニング
- 小尺(Shorts)自動再構成

## 技術スタック

- **TypeScript**: 型安全な開発
- **Express**: REST APIサーバー
- **Commander**: CLIフレームワーク
- **Marp**: スライド生成
- **LLM**: OpenAI GPT-4 / Anthropic Claude
- **TTS**: ElevenLabs / OpenAI TTS
- **Remotion**: 動画合成（予定）

## 実装済み機能

### ✅ コア機能
- ✅ 台本の取り込みとストレージ管理
- ✅ LLMによる台本の整形（正規化）
- ✅ LLMによるセクション分割
- ✅ LLMによるスライド設計
- ✅ ストレージサービス（ファイルシステムベース）
- ✅ LLMクライアント（OpenAI/Anthropic対応）
- ✅ 音声生成サービス（ElevenLabs/OpenAI TTS対応）
- ✅ Remotionコード生成サービス
- ✅ レンダリングジョブ管理サービス
- ✅ バリデーション機能
- ✅ ログ機能

### 🚧 実装予定
- ⏳ スライドレンダリング（Marp PNG/PDF出力）
- ⏳ Remotionプロジェクトの自動生成とレンダリング
- ⏳ 音声と動画の統合
- ⏳ Instagram投稿機能

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずIssueを開いて変更内容を議論してください。

## サポート

問題や質問がある場合は、GitHubのIssueを作成してください。
