# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

**Run locally:**
```
npx serve .
```
Open http://localhost:3000 in a browser. No build step required — plain HTML/CSS/JS.

## Architecture

Single-page app with no framework or bundler. Three files do all the work:

- `index.html` — static shell. Defines the sidebar (categories, filters, tags), the main area (task list + calendar toggle), and the task editor modal.
- `style.css` — CSS custom properties (`--bg`, `--panel`, `--accent`, `--cal-*`) drive both light and dark themes. Dark mode is applied by adding `.dark` to `#app`.
- `app.js` — all logic in one file, no modules. Key globals:
  - `state` — single object (`categories`, `tags`, `tasks`) serialized to `localStorage` under key `todo_app_v1`
  - `ui` — transient UI state (e.g. `calendarMode`)
  - `refs` — cached DOM element references populated in `init()`

**Data flow:** user action → mutate `state` → `saveState()` → `renderTasks()` / `renderCategories()` / `renderTags()`. There is no virtual DOM or reactive system; renders are full redraws of the relevant list.

**Calendar:** `showCalendar()` dispatches to `showWeekView()` based on `ui.calendarMode`. Both render into `#calendarView` and hide `#taskListArea`.

**Repeat tasks:** when a task checkbox is checked and `task.repeat !== 'none'`, `nextDue()` computes the next occurrence and a new task is inserted into `state.tasks`. This logic lives in the `change` listener inside `renderTaskItem()`.

**Theme persistence:** stored in `localStorage` as `todo_theme_dark = '1' | '0'`, separate from `state`.

## 実装済み機能

- タスクのCRUD（タイトル・メモ・期限・優先度・カテゴリ・タグ・添付ファイル・サブタスク）
- 繰り返しタスク（毎日・毎週・毎月）：完了時に次回分を自動生成
- フィルター：すべて・今日・期限超過・完了・カテゴリ別・タグ別・テキスト検索
- カレンダー表示：月表示・週表示の切り替え
- ダークモード：トグルボタン、設定を `localStorage` で永続化
- レスポンシブ：800px以下でサイドバーをハンバーガーメニュー化
- 添付ファイル：画像はインラインプレビュー、PDFは別タブ表示、その他はダウンロードリンク
- エクスポート/インポート：タスクをJSONファイルで書き出し・読み込み（`updatedAt` による上書き判定付き）

## モバイル対応の実装詳細

- ブレークポイントは `max-width: 800px`
- モバイル時、`#sidebar` は `display:none`。`☰` ボタン（`#mobileMenuBtn`）は `#main .topbar` 内に配置（サイドバー内に置くと一緒に非表示になるため）
- ボタン押下で `#app` に `.mobile-open` クラスを付与 → `#sidebar` を `position:fixed` でオーバーレイ表示
- 背景の暗幕は `<div id="sidebarOverlay">` （実DOMノード）で実装。`::after` 疑似要素はJSのクリックイベントを受け取れないため使用不可
- カテゴリ・フィルター選択時も `closeSidebar()` を呼んで自動的に閉じる

## データ同期の制限

- データは `localStorage` に保存されるため、**デバイス・ブラウザをまたいだ同期は不可**
- PCとスマホでデータは独立している（設計上の制限、バグではない）
- クラウド同期が必要な場合は Firebase / Supabase 等のバックエンド導入が必要（現状は未実装）
- エクスポート/インポート機能（JSON）により、デバイス間の手動データ移行が可能

## タスクデータ構造

各タスクは `state.tasks` に `{ [id]: taskObject }` の辞書形式で格納される（配列ではない）。

```js
{
  id:         "lf3k2abc",          // uid() で生成（タイムスタンプ36進 + ランダム4文字）
  title:      "タスクのタイトル",
  note:       "メモ",
  due:        "2026-06-15T09:00:00.000Z",  // null も可
  repeat:     "none",              // "none" | "daily" | "weekly" | "monthly"
  priority:   "medium",            // "low" | "medium" | "high"
  categoryId: "lf2xqrst",         // state.categories の id
  tags:       ["urgent", "home"],
  subtasks:   [{ id, title, done }],
  attachments:[{ name, data }],    // data は Base64 DataURL
  completed:  false,
  createdAt:  "2026-06-12T10:00:00.000Z",
  updatedAt:  "2026-06-12T10:00:00.000Z"
}
```

- `id` はアプリ内で唯一の識別子。タスクNoのような連番は存在しない
- `updatedAt` はタスク保存のたびに `nowISO()` で更新される。インポート時の上書き判定にも使用

## エクスポート/インポート機能

- **エクスポート**: サイドバー下部の「↑ エクスポート」ボタンで `state.tasks` をJSON形式でダウンロード。ファイル名は `todo-export-YYYY-MM-DD.json`
- **インポート**: 「↓ インポート」ボタンでファイル選択ダイアログを開き、JSONを読み込んで既存タスクとマージする
- **重複IDの処理**: インポートするタスクのIDが既存と一致する場合、`updatedAt` を比較してインポート側が新しければ上書き、古ければスキップ
- **新規タスク**: IDが一致しない場合は新規追加（IDなしの場合は `uid()` で発行）
- インポート後は `saveState()` と `renderTasks()` を呼んで即反映。結果は「N件追加、N件上書き、N件スキップ」形式でアラート表示

## 既知の修正済み問題

以下は過去に修正済み（再発した場合は要注意）：

- **ダークモード時のカレンダー色**: `#f3f4f6` 等のハードコード色を `--cal-head` / `--cal-border` / `--cal-border2` 変数に置き換え済み
- **タグフィルターの部分一致**: タスクに複数タグがある場合、最初の1つしか絞り込まれなかった問題を修正。タグごとに個別スパンを生成し、各クリックで対応タグでフィルタされる
- **繰り返しタスクの重複リスナー**: `document.addEventListener('change', ...)` のグローバルデリゲートと `renderTaskItem` 内のリスナーが二重登録されていた問題を解消。繰り返しロジックを `renderTaskItem` 内に統合し、グローバルリスナーを削除済み
- **モバイルメニューが閉じない**: `::after` 疑似要素ではクリックイベントが取れなかったため、実DOMの `#sidebarOverlay` に置き換えて解消済み
- **タスク編集時に `createdAt` が上書きされる**: `onSaveTask` で常に `nowISO()` を設定していたため、編集のたびに作成日時が更新されていた。編集時は既存の `createdAt` を引き継ぐよう修正済み

## デプロイ

- リポジトリ: https://github.com/kou-gin/todo-app
- GitHub Pages: Settings → Pages → Branch: main / (root) で有効化（初回のみ手動設定が必要）
- 公開URL（有効化後）: https://kou-gin.github.io/todo-app/
- `main` ブランチへの push で自動反映される
