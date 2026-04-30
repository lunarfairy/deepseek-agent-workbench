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
- The default model list is DeepSeek-oriented, but the architecture is intended to stay provider-adaptable.
- Local commands and MCP tools should be treated as powerful capabilities. Review every approval prompt carefully.
- This is an early workbench prototype. Expect rough edges around packaging, terminal behavior, and MCP server compatibility.

## License

No license has been selected yet. Until a license is added, all rights are reserved by the repository owner.
