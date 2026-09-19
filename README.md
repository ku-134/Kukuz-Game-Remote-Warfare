# Remote Warfare

> 远程战争 · 战棋指挥网页小游戏（开发中）

**在线地址**：https://ku-134.github.io/Kukuz-Game-Remote-Warfare/

**当前版本**：0.1.0（开发中）

## 简介

一款强调「面对失控战局进行指挥」的战棋网页小游戏。核心流程：指挥单位（操作）→ 结算（行动判定）→ 单位完成指令（返回结果）。采用线性闯关，前几关为教学。

## 功能列表

- 横屏绿色磷光屏画面
- 军用方格网格 + 等高线地形层 + 河流湖泊渲染
- 单位系统（人数 / 物资 / Buff 三类变量）
- 可调显示效果设置
- 线性闯关（教学关卡逐步引入机制）

## 操作说明

- 触屏点击 / 拖拽指挥单位；桌面键盘方向键 + 空格。
- 显示设置面板可调节磷光屏强度、扫描线等（不影响游戏运行）。

## 技术约定

- 纯静态：HTML + CSS + JavaScript，零构建、零依赖，Canvas 2D 渲染。
- GitHub Pages 托管，push `main` 即发布。

## 目录结构

```
Remote Warfare/
├── index.html
├── css/style.css
├── js/
│   ├── main.js
│   ├── core/     # 引擎核心
│   ├── systems/  # 玩法系统
│   ├── ui/       # UI 框架
│   └── data/     # 静态数据
├── 统一开发规范.md
├── 统一UI设计规范.md
├── CHANGELOG.md
└── VERSION
```

## 运行 / 构建 / 部署

- 运行：直接双击打开 `index.html` 即可（无构建）。
- 部署：推送到 `main` 分支，GitHub Pages 自动发布。

## 命名规范

本项目遵循 Kukuz 游戏仓库规范：`Kukuz-Game-<游戏标识>`。
