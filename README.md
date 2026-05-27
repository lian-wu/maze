# maze

公開展示用迷宮網頁（GitHub Pages）。

## 功能

- 可調整迷宮尺寸（寬/高）
- 可指定種子（可重現）
- 可選難易度
  - 簡單：轉向偏好 `1`、死路保留 `3`
  - 中等：轉向偏好 `3`、死路保留 `3`
  - 困難：轉向偏好 `5`、死路保留 `5`
- 列印輸出

## 演算法說明

本專案演算法直接復用研究專案 `/Users/NN/nn_code/test/maze_gen.c` 的核心邏輯並移植到 JavaScript：

- 覆蓋導向的方向排序
- 轉向偏好（`turn_bias`）
- 死路保留（`deadend_keep`）
- 前/後端輪流分支擴張
- 完美迷宮（唯一解）

## 本地開啟

直接開 `index.html` 即可。

## GitHub Pages

推到 `main` 分支後，設定 Pages 來源為 `main / (root)`。
