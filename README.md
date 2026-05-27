# maze

公開展示用迷宮網頁（GitHub Pages）。

## 功能

- 可調整迷宮尺寸（寬/高）
- 可指定種子（可重現）
- 可選難易度
  - 簡單 / 中等 / 困難
- 列印輸出

## 演算法說明

本專案演算法直接復用研究專案的核心邏輯並移植到 JavaScript：

- 覆蓋導向的方向排序
- 轉向偏好（`turn_bias`）
- 死路保留（`deadend_keep`）
- 前/後端輪流分支擴張
- 完美迷宮（唯一解）

## 本地開啟

直接開 `index.html` 即可。

## GitHub Pages

推到 `main` 分支後，設定 Pages 來源為 `main / (root)`。

線上網址：<https://lian-wu.github.io/maze/>
