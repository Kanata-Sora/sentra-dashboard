# SENTRA Dashboard 利用ガイド

---

## 起動方法

PowerShellを開いて以下を**1行ずつ**実行：

```
cd $HOME\sentra-dashboard
npm run dev
```

以下の表示が出たら起動成功：
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
```

ブラウザで `http://localhost:3000` を開く。

### 終了方法
PowerShellで `Ctrl + C`

### 2回目以降
毎回 `npm install` は不要。`npm run dev` だけでOK。

---

## プロジェクトの場所

```
C:\Users\kanat\sentra-dashboard\
```

> ⚠️ OneDriveの外に移動済みです。デスクトップではなく上記パスが正しい場所です。

---

## VSCodeで開く場合

1. VSCodeを起動
2. `ファイル` → `フォルダーを開く`
3. `C:\Users\kanat\sentra-dashboard` を選択

---

## 画面一覧

| URL | 画面名 | 説明 |
|-----|--------|------|
| `/` | ダッシュボード | 3プロジェクトの進捗・タスク一覧 |
| `/upload` | 議事録アップロード | 議事録をAIで解析→タスク・ナレッジを自動抽出 |
| `/knowledge` | ナレッジベース | 知見・決定事項の検索・閲覧 |
| `/snapshot` | スナップショット | 成果サマリーの生成と履歴 |
| `/snapshot/[id]` | 展示用フルスクリーン | 大型ディスプレイ・ポスター向け成果表示 |

---

## Vercelへのデプロイ（チームに共有する場合）

デプロイすると `https://sentra-dashboard-xxx.vercel.app` のURLが発行され、
チームメンバーがブラウザだけでアクセスできるようになります。

### STEP 1: GitHubにアップロード

PowerShellで実行（`your-username` は自分のGitHubユーザー名）：

```
cd $HOME\sentra-dashboard
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/your-username/sentra-dashboard.git
git push -u origin main
```

> `.env.local`（APIキー）は `.gitignore` で除外済みのため、GitHubには上がりません。

### STEP 2: Vercelにデプロイ

1. [https://vercel.com](https://vercel.com) → GitHubでログイン
2. `Add New Project` → `sentra-dashboard` を選択 → `Import`
3. `Environment Variables` に以下を入力：

| キー | 値 |
|------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` の値をコピー |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` の値をコピー |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` の値をコピー |
| `ANTHROPIC_API_KEY` | `.env.local` の値をコピー |

4. `Deploy` ボタンを押す → 数分でURLが発行される

### コード更新時の再デプロイ

```
git add .
git commit -m "変更内容のメモ"
git push
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `npm run dev` でエラー | `cd $HOME\sentra-dashboard` で正しいフォルダか確認 |
| ブラウザが真っ白 | PowerShellのエラーメッセージを確認 |
| データが表示されない | `.env.local` のSupabase設定を確認 |
| AI解析エラーが出る | `.env.local` の `ANTHROPIC_API_KEY` を確認 |
