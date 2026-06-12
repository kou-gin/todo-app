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

## 既知の修正済み問題

以下は過去に修正済み（再発した場合は要注意）：

- **ダークモード時のカレンダー色**: `#f3f4f6` 等のハードコード色を `--cal-head` / `--cal-border` / `--cal-border2` 変数に置き換え済み
- **タグフィルターの部分一致**: タスクに複数タグがある場合、最初の1つしか絞り込まれなかった問題を修正。タグごとに個別スパンを生成し、各クリックで対応タグでフィルタされる
- **繰り返しタスクの重複リスナー**: `document.addEventListener('change', ...)` のグローバルデリゲートと `renderTaskItem` 内のリスナーが二重登録されていた問題を解消。繰り返しロジックを `renderTaskItem` 内に統合し、グローバルリスナーを削除済み

## デプロイ

- リポジトリ: https://github.com/kou-gin/todo-app
- GitHub Pages: Settings → Pages → Branch: main / (root) で有効化（初回のみ手動設定が必要）
- 公開URL（有効化後）: https://kou-gin.github.io/todo-app/
- `main` ブランチへの push で自動反映される
