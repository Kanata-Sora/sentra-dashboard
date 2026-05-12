# SENTRA Dashboard で学ぶ Web アプリ開発の主要技術

> 対象：大学 2・3 年生  
> 目的：このアプリに使われている技術を「なぜ使うのか」「どう連携しているのか」の視点で理解する

---

## はじめに：このアプリは何でできているか

SENTRA Dashboard は、以下の 6 つの技術を組み合わせて動いています。

```
┌─────────────────────────────────────────────────────┐
│                   ブラウザ（ユーザー）                 │
└────────────────────────┬────────────────────────────┘
                         │ HTTP通信
┌────────────────────────▼────────────────────────────┐
│              Next.js（フロントエンド）                 │
│   画面の表示・ページ遷移・ユーザー操作の処理             │
│   ┌──────────────┐   ┌──────────────────────────┐   │
│   │  TypeScript  │   │      Tailwind CSS         │   │
│   │  （型の管理） │   │      （デザイン）          │   │
│   └──────────────┘   └──────────────────────────┘   │
└──────────┬───────────────────────┬──────────────────┘
           │ データの読み書き        │ AI処理の依頼
┌──────────▼──────────┐  ┌─────────▼────────────────┐
│  Supabase           │  │  Claude API（Anthropic）  │
│  （データベース）    │  │  （AI・議事録解析）         │
│  ・タスク           │  │                           │
│  ・議事録           │  │                           │
│  ・ナレッジ         │  │                           │
│  ・メンバー         │  │                           │
└─────────────────────┘  └───────────────────────────┘

        ↑ アプリ全体を公開しているのが Vercel（デプロイ）
```

---

## 第 1 章：Next.js ─ アプリの「骨格」

### Next.js とは

Next.js は **React をベースにした Web アプリケーションフレームワーク**です。  
「フレームワーク」とは、アプリ開発に必要な仕組みをあらかじめ用意してくれたツールセットです。

> **React との違い**  
> React は「UI を作るためのライブラリ」です。  
> Next.js は React に加えて「ページ遷移」「サーバー処理」「パフォーマンス最適化」などを自動でやってくれます。

### このアプリでの役割

| 機能 | 説明 |
|------|------|
| ページルーティング | `/` `/upload` `/knowledge` などの URL とファイルを自動で対応させる |
| サーバーサイド処理 | `app/api/` フォルダの中で、Claude API への通信などのサーバー処理を行う |
| UI の描画 | TypeScript + Tailwind CSS でブラウザに画面を表示する |

### App Router という仕組み

このアプリは Next.js 14 の **App Router** を使っています。  
ファイルの場所がそのまま URL になります。

```
app/
├── (main)/
│   ├── page.tsx          → /        （ダッシュボード）
│   ├── upload/page.tsx   → /upload  （アップロード）
│   ├── knowledge/page.tsx→ /knowledge
│   ├── minutes/page.tsx  → /minutes
│   └── settings/page.tsx → /settings
└── api/
    ├── analyze/route.ts  → /api/analyze  （議事録解析API）
    └── knowledge-chat/route.ts → /api/knowledge-chat
```

`app/api/` の中にあるファイルは**ブラウザから見えない「裏側の処理」**を担当します。  
Claude API のキー（秘密情報）を扱うのも、ここで行います。

### "use client" と "use server" の違い

Next.js のファイルの先頭に書いてある `"use client"` に注目してください。

```
"use client"  → ブラウザ上で動く（ボタンのクリックやデータ表示）
"use server"  → サーバー上で動く（外部APIとの通信など）
```

ユーザーの操作を処理する画面は `"use client"`、  
秘密情報を使う処理は `"use server"` または `app/api/` に書く、というルールです。

---

## 第 2 章：TypeScript ─ コードの「安全網」

### TypeScript とは

TypeScript は **JavaScript に「型」を追加した言語**です。  
コードを実行する前に「この変数に変なデータが入っていないか」をチェックしてくれます。

> **なぜ型が必要か**  
> JavaScript では、数字を入れるはずの変数に文字列が入っても実行時まで気づけません。  
> TypeScript を使うと、コードを書いた時点でエラーを検出できます。

### このアプリでの使われ方

`types/database.ts` にアプリ全体で使う型が定義されています。

```typescript
// タスクの型定義
interface Task {
  id: string;
  title: string;          // タスク名（必ず文字列）
  status: TaskStatus;     // "open" | "in_progress" | "done" のどれか
  assigned_to: string | null;  // 担当者（未設定の場合は null）
  is_long_term: boolean;  // 長期タスクかどうか（true/false のみ）
  due_date: string | null;
}
```

この型定義があることで、たとえば `task.stauts`（タイポ）と書いてしまったとき、  
実行前に「そんなプロパティはない」とエラーを出してくれます。

### 型の主なメリット

| メリット | 説明 |
|----------|------|
| バグの早期発見 | 実行前にミスを検出できる |
| コード補完 | エディタが「次に何が書けるか」を提案してくれる |
| チーム開発 | 「このデータの形」を明示できるため、他の人が読みやすい |

---

## 第 3 章：Tailwind CSS ─ アプリの「見た目」

### Tailwind CSS とは

Tailwind CSS は **「ユーティリティファースト」な CSS フレームワーク**です。  
CSS のスタイルを、クラス名として HTML に直接書いていく方法です。

> **従来の CSS との違い**  
> 従来：`.button { color: white; background: blue; padding: 8px; }` を別ファイルに書く  
> Tailwind：`className="text-white bg-blue-600 px-3 py-2"` と直接書く

### クラス名の読み方

このアプリのコードに出てくる典型的なクラス名：

```
text-sm        → フォントサイズを小さく（small）
font-bold      → 太字
text-gray-900  → 濃いグレーの文字色（900 = 最も濃い）
bg-white       → 背景色を白に
rounded-lg     → 角を丸く（large）
border         → 枠線をつける
p-4            → 内側の余白を 4 単位分
px-3 py-2      → 左右に 3、上下に 2 単位分の余白
flex           → Flexbox レイアウトを使う
gap-2          → Flex アイテム間の隙間を 2 単位分
hover:bg-gray-100  → マウスを乗せたとき背景をグレーに
```

### shadcn/ui との関係

このアプリでは Tailwind CSS に加えて **shadcn/ui** というコンポーネントライブラリも使っています。  
shadcn/ui は「ボタン」「カード」「ダイアログ」などの UI 部品を Tailwind CSS で実装したものです。

---

## 第 4 章：Supabase ─ データの「保管場所」

### Supabase とは

Supabase は **「Backend as a Service（BaaS）」** と呼ばれるサービスです。  
通常、データベースの管理には専用サーバーの構築が必要ですが、  
Supabase を使うとそれを省略して、すぐにデータベースを使い始められます。

中身は **PostgreSQL**（オープンソースの本格的なリレーショナルデータベース）です。

### このアプリのテーブル構成

データベースは「テーブル（表）」でデータを管理します。

```
projects（プロジェクト）
├── id
├── name     （CTF開催、SNS監視システム、成果可視化）
└── color

members（メンバー）
├── id
├── name
├── email
└── project_id → projects.id を参照

tasks（タスク）
├── id
├── title
├── status   （open / in_progress / done）
├── assigned_to
├── project_id → projects.id を参照
└── minute_id  → minutes.id を参照

minutes（議事録）
├── id
├── title
├── raw_text （議事録の本文）
└── project_id

knowledge（ナレッジ）
├── id
├── title
├── content
└── minute_id → minutes.id を参照
```

テーブル間を `→` で結んでいる部分を **外部キー（Foreign Key）** と言います。  
「このタスクはどの議事録から来たか」などの関係性を表現します。

### アプリからどうやってアクセスするか

Supabase はアプリから簡単に使えるライブラリを提供しています。

```typescript
// データを取得する例（ダッシュボードでタスク一覧を読み込む）
const { data } = await supabase
  .from("tasks")        // tasks テーブルから
  .select("*")          // すべての列を取得
  .order("created_at"); // 作成日順に並べる

// データを追加する例（タスクを新規作成）
await supabase.from("tasks").insert({
  title: "新しいタスク",
  status: "open",
  project_id: "xxx"
});
```

### RLS（Row Level Security）

Supabase には **RLS** というセキュリティ機能があります。  
「誰がどのデータにアクセスできるか」をデータベース側でコントロールします。  
このアプリではプロトタイプ段階のため全公開にしていますが、  
本番環境では「ログインしたユーザーだけが自分のデータを見られる」ようにするのが一般的です。

---

## 第 5 章：Claude API ─ アプリの「知性」

### Claude API とは

Anthropic 社が提供する **大規模言語モデル（LLM）の API** です。  
API（Application Programming Interface）とは、外部サービスの機能を自分のアプリから呼び出すための「窓口」です。

### このアプリでの使われ方

2 箇所で Claude API を呼び出しています。

**① 議事録の解析（`/api/analyze`）**

```
ユーザーが議事録テキストを入力
       ↓
Next.js のサーバー（app/api/analyze/route.ts）が受け取る
       ↓
Claude API に「このテキストからタスクとナレッジを JSON 形式で抽出して」と依頼
       ↓
Claude が JSON を返す
       ↓
アプリがその JSON を画面に表示し、ユーザーが確認して Supabase に保存
```

**② ナレッジの解説生成（`/api/knowledge-chat`）**

```
ユーザーが「○○についてまとめて」と入力
       ↓
Supabase からナレッジ一覧を取得
       ↓
Claude API に「このナレッジ一覧を参考に質問に答えて」と依頼
       ↓
Claude が回答を返す → 画面に表示
```

### なぜサーバー側で呼び出すのか

Claude API を使うには **API キー（秘密のパスワード）** が必要です。  
このキーをブラウザ側のコードに書いてしまうと、誰でも見られてしまいます。  
そのため、`app/api/` というサーバー側のコードの中だけで使い、  
環境変数（`.env.local`）に安全に保管しています。

---

## 第 6 章：Vercel ─ アプリの「公開場所」

### Vercel とは

Vercel は **Web アプリをインターネット上に公開（デプロイ）するためのサービス**です。  
Next.js の開発元が作っているため、Next.js との相性が非常によいです。

### デプロイの仕組み

```
開発者がコードを修正
       ↓
git push で GitHub にアップロード
       ↓
Vercel が GitHub の変更を自動検知
       ↓
Vercel がアプリをビルド（TypeScript → JavaScript に変換など）
       ↓
世界中のサーバーにアプリを配置
       ↓
ユーザーがURLにアクセスすると表示される
```

### 環境変数の管理

Supabase の接続情報や Claude の API キーなどの秘密情報は、  
コードの中に直接書かずに Vercel の **環境変数** として設定します。  
ローカル開発では `.env.local` ファイルに書き、  
本番環境では Vercel のダッシュボードから設定します。

---

## 第 7 章：技術の連携 ─ 全体のデータフロー

### 例①：ダッシュボードを開いたときの流れ

```
1. ユーザーが URL にアクセス
         ↓
2. Vercel がリクエストを受け取り Next.js を起動
         ↓
3. Next.js の page.tsx が実行される
         ↓
4. Supabase に「projects テーブルと tasks テーブルのデータをください」と問い合わせ
         ↓
5. Supabase が PostgreSQL からデータを取得して返す
         ↓
6. Next.js が受け取ったデータを Tailwind CSS でスタイリングして画面に表示
         ↓
7. ユーザーの目にダッシュボードが表示される
```

### 例②：議事録をアップロードしてタスクを抽出する流れ

```
1. ユーザーが議事録テキストを入力して「解析する」をクリック
         ↓
2. Next.js（ブラウザ側）が /api/analyze に POST リクエストを送信
         ↓
3. Next.js（サーバー側 = app/api/analyze/route.ts）がリクエストを受け取る
         ↓
4. 環境変数から ANTHROPIC_API_KEY を取得
         ↓
5. Claude API に「この議事録からタスクを JSON で抽出して」と依頼
         ↓
6. Claude が JSON 形式でタスク一覧を返す
         ↓
7. Next.js がその JSON をブラウザに返す
         ↓
8. ユーザーが内容を確認・編集して「保存」をクリック
         ↓
9. Supabase の tasks テーブルと knowledge テーブルにデータを INSERT
         ↓
10. ダッシュボードに新しいタスクが表示される
```

---

## 第 8 章：技術選定の理由

なぜこれらの技術を選んだのか、を理解することも重要です。

| 技術 | 選んだ理由 |
|------|-----------|
| Next.js | React ベースで学習コストが低い。サーバー処理もフロントエンドも 1 つのプロジェクトで書ける |
| TypeScript | チーム開発でのバグを減らせる。大学の授業でも学べる言語 |
| Tailwind CSS | CSS ファイルを別管理しなくてよい。デザインの一貫性を保ちやすい |
| Supabase | サーバー構築不要。PostgreSQL なので本格的な SQL が学べる |
| Claude API | 議事録解析という高度な NLP タスクを数行のコードで実現できる |
| Vercel | GitHub と連携するだけで自動デプロイ。無料プランで十分 |

---

## まとめ：技術の関係図（再掲）

```
【ユーザー（ブラウザ）】
        ↕ 画面の表示・操作
【Next.js + TypeScript + Tailwind CSS】  ← Vercel が公開
        ↕ データの読み書き          ↕ AI 処理
【Supabase（PostgreSQL）】    【Claude API（Anthropic）】
```

- **Vercel** はこのシステム全体をインターネット上に公開する
- **Next.js** がすべての中心で、画面表示・データ取得・AI呼び出しを調整する
- **TypeScript** は Next.js のコード全体に型の安全性を加える
- **Tailwind CSS** は Next.js のコンポーネントに見た目を与える
- **Supabase** はデータの永続的な保存・取得を担当する
- **Claude API** はテキスト解析・生成という知的な処理を担当する

---

## さらに深く学ぶには

| 技術 | 推奨する学習ステップ |
|------|---------------------|
| Next.js | 公式チュートリアル（無料）→ App Router の基本を手を動かして学ぶ |
| TypeScript | サバイバル TypeScript（無料の日本語教材）|
| Tailwind CSS | 公式 Playground でクラスを試す |
| SQL / Supabase | 基本的な SELECT / INSERT / JOIN を Supabase の SQL Editor で練習 |
| Claude API | Anthropic の API ドキュメントを読み、簡単なチャットアプリを作る |

---

*このガイドは SENTRA Dashboard（高知工科大学）の学習用資料として作成しました。*
