# DeepSeek Agent Workbench

DeepSeek Agent Workbench is an unofficial desktop agent app for DeepSeek API users. It aims to provide a Codex-app-like coding experience: chat with an agent, approve tool calls, inspect plans and todos, run local commands, and connect MCP tools from one Electron workbench.

This is a clean-room community project. It is not an official DeepSeek, Anthropic, or OpenAI product.

## Why This Exists

DeepSeek provides strong API models, but it does not currently ship an official local coding-agent desktop app. This project explores that missing layer: a user-controlled agent workbench where you bring your own DeepSeek API key, keep local tool actions visible, and approve every filesystem, command, or MCP capability before it runs.

The goal is not to clone any vendor app. The goal is to build an open, DeepSeek-oriented agent shell with familiar coding-assistant ergonomics and a safety-first local workflow.

## Features

- Plan-first chat workflow with structured Plan, Todo, Agents, and Approvals panels.
- DeepSeek API setup flow with model selection.
- Default agent profiles for Coordinator, Explorer, Implementer, Reviewer, Integrator, and MCP Tool Agent.
- Native tools for reading, writing, searching, patching files, and running commands.
- All tool calls require user approval by default.
- Streamed command output with manual confirmation and cancellation.
- Local stdio MCP server configuration, discovery, and tool-call routing through the same approval flow.
- Prompt profiles can be viewed, edited, and reset in Settings.

## Safety Model

- Tool calls are approval-first by default.
- Read, write, command, and MCP actions are surfaced with separate risk labels.
- Local commands run through a streamed command panel with confirmation and cancellation.
- MCP servers are treated as external capabilities and routed through the same approval flow as native tools.
- Agent profiles are editable so you can inspect and tune each role's default behavior.

## Tech Stack

- Electron
- React
- TypeScript
- Zustand
- OpenAI-compatible SDK configuration targeting DeepSeek by default

## Development

Install dependencies:

```bash
npm install
```

Run the desktop app locally:

```bash
npm run dev
```

Run type checks:

```bash
npx tsc -p tsconfig.node.json --noEmit
npx tsc -p tsconfig.web.json --noEmit
```

Build the app:

```bash
npm run build
```

Build a Windows `.exe` installer:

```powershell
.\build-exe.cmd
```

You can also run the same flow through npm:

```powershell
npm run build:exe
```

The generated files are written to:

- Installer: `dist\DeepSeek-Agent-Workbench-Setup-1.0.0.exe`
- Unpacked app: `dist\win-unpacked\DeepSeek Agent Workbench.exe`

The installer is unsigned, so Windows may show a security warning.

## Notes

- Configure your API key and working directory inside the app.
- Use the title-bar Update button or Settings -> Updates to open the latest GitHub release page.
- The default model list is DeepSeek-oriented, but the architecture is intended to stay provider-adaptable.
- Local commands and MCP tools should be treated as powerful capabilities. Review every approval prompt carefully.
- This is an early workbench prototype. Expect rough edges around packaging, terminal behavior, and MCP server compatibility.

## License

No license has been selected yet. Until a license is added, all rights are reserved by the repository owner.

---

# 中文说明

DeepSeek Agent Workbench 是一个面向 DeepSeek API 用户的非官方桌面 Agent 应用。它希望提供类似 Codex App 的本地编程助手体验：你可以和 Agent 对话，查看计划与 Todo，审批工具调用，运行本地命令，并在同一个 Electron 工作台里接入 MCP 工具。

这是一个 clean-room 的社区项目，不是 DeepSeek、Anthropic 或 OpenAI 的官方产品。

## 为什么做这个项目

DeepSeek 提供了很强的 API 模型，但目前还没有官方的本地编程 Agent 桌面应用。这个项目想补上中间这一层：让用户可以填入自己的 DeepSeek API Key，在本地拥有一个可控、可审计、默认需要审批工具调用的 Agent Workbench。

项目目标不是复制任何厂商应用，而是做一个面向 DeepSeek API 的开放式 Agent 外壳，让 DeepSeek 用户也能拥有更接近现代 coding-agent 的使用体验。

## 功能特性

- Plan-first 工作流：复杂任务先生成 Plan、Todo、Agents 和 Approvals。
- DeepSeek API 设置流程，支持配置 API Key 和模型。
- 内置 Coordinator、Explorer、Implementer、Reviewer、Integrator、MCP Tool Agent 等默认 Agent Prompt。
- 原生工具支持读取文件、写入文件、搜索文件、应用补丁、运行命令。
- 默认所有工具调用都需要用户审批。
- 命令输出支持流式显示、手动确认和取消。
- 支持配置本地 stdio MCP server，发现工具后统一走审批流程。
- Prompt Profiles 可以在设置里查看、编辑和重置。

## 安全模型

- 工具调用默认 approval-first。
- 读文件、写文件、执行命令、MCP 调用会显示不同风险标签。
- 本地命令通过命令面板运行，支持流式输出和取消。
- MCP server 被视为外部能力，不会绕过审批系统。
- 各 Agent 的 Prompt 可查看、可修改，方便用户理解每个角色的默认行为。

## 技术栈

- Electron
- React
- TypeScript
- Zustand
- OpenAI-compatible SDK，默认面向 DeepSeek API 配置

## 开发与使用

安装依赖：

```bash
npm install
```

启动开发版桌面应用：

```bash
npm run dev
```

运行类型检查：

```bash
npx tsc -p tsconfig.node.json --noEmit
npx tsc -p tsconfig.web.json --noEmit
```

普通构建：

```bash
npm run build
```

生成 Windows `.exe` 安装包：

```powershell
.\build-exe.cmd
```

也可以使用 npm 脚本：

```powershell
npm run build:exe
```

构建完成后，生成文件通常在：

- 安装包：`dist\DeepSeek-Agent-Workbench-Setup-1.0.0.exe`
- 免安装应用：`dist\win-unpacked\DeepSeek Agent Workbench.exe`

当前安装包没有代码签名，因此 Windows 可能会显示安全提示。

## 使用提示

- 首次启动后，在应用内配置 DeepSeek API Key、模型和工作目录。
- 可以通过标题栏的 Update 按钮，或 Settings -> Updates 打开最新 GitHub Release 页面。
- 默认模型列表偏向 DeepSeek，但架构会尽量保持可扩展。
- 本地命令和 MCP 工具都属于高权限能力，审批前请确认每次调用内容。
- 当前项目还处于早期原型阶段，打包、终端行为和 MCP 兼容性可能仍有粗糙之处。

## 许可证

项目暂未选择开源许可证。在正式添加许可证之前，所有权利由仓库所有者保留。
