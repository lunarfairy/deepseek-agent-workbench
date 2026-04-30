# Lunar Agent Workbench

Lunar Agent Workbench is a local Electron coding assistant built around plan-first workflows, explicit tool approval, specialist agent profiles, and MCP-style tool extension.

It is a clean-room project inspired by modern agentic coding workbenches. It is not an official DeepSeek, Anthropic, or OpenAI product.

## Features

- Plan-first chat workflow with structured Plan, Todo, Agents, and Approvals panels.
- Default agent profiles for Coordinator, Explorer, Implementer, Reviewer, Integrator, and MCP Tool Agent.
- Native tools for reading, writing, searching, patching files, and running commands.
- All tool calls require user approval by default.
- Streamed command output with manual confirmation and cancellation.
- Local stdio MCP server configuration, discovery, and tool-call routing through the same approval flow.
- Prompt profiles can be viewed, edited, and reset in Settings.

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

Run type checks:

```bash
npx tsc -p tsconfig.node.json --noEmit
npx tsc -p tsconfig.web.json --noEmit
```

Start the app in development:

```bash
npm run dev
```

Build the app:

```bash
npm run build
```

## Notes

- Configure your API key and working directory inside the app.
- The default model list is DeepSeek-oriented, but the architecture is intended to stay provider-adaptable.
- Local commands and MCP tools should be treated as powerful capabilities. Review every approval prompt carefully.

## License

No license has been selected yet. Until a license is added, all rights are reserved by the repository owner.
