# minime 🧑‍💻 你的桌面分身

一个住在你桌面上的 3D 小分身，观察你的使用状态，同步你的动作，陪伴你工作。

## 🚀 快速开始

```bash
# 构建
npm run build

# 启动
npm run start

# 开发模式 (watch 模式)
npm run dev
```

## ✨ 功能

- **3D 角色** — 低多边形 Q 版小人，浮在桌面角落
- **行为同步** — 感知键盘/鼠标活动，小人同步打字/思考/睡眠
- **智能提醒** — 喝水、久坐、熬夜、远眺提醒（情绪化交互）
- **状态机** — 自动在 Idle / Typing / Thinking / Sleeping 间切换
- **隐私安全** — 仅统计行为频率，不记录内容

## 🛠 技术栈

- **Electron** — 桌面透明窗口
- **Three.js** — 3D 渲染
- **TypeScript** — 全栈类型安全
- **Vite** — 构建工具
- **uiohook-napi** — 全局键盘/鼠标钩子
- **active-win** — 前台窗口检测

## 📁 项目结构

```
src/
├── main/           # Electron 主进程
│   ├── main.ts     # 窗口管理 + IPC
│   ├── sensors/    # 键盘/鼠标/窗口感知
│   └── stats/      # 每日数据统计
├── renderer/       # 渲染进程
│   ├── MinimeApp.ts # 应用主协调器
│   ├── character/   # 3D 角色系统
│   ├── states/      # 状态机
│   ├── reminders/   # 提醒管理器
│   └── scene/       # Three.js 场景
└── shared/         # 共享类型定义
```

## 📋 后续路线

- glTF 高模导入
- 照片拟人生成
- 参数化捏脸系统
- AI 辅助
- 换装/皮肤市场
