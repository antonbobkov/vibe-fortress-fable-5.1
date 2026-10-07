# Claude Code Quota & Usage

## Current Quota Status

**Last checked: 2026-10-06**

- **5-hour limit**: 21% used, resets in 4h 54m
- **Weekly limit**: 12% used (all models), resets in 6d 12h
- **Session context**: 44% used (88.7K of 200K tokens)
- **Plan**: Pro

## How to Check Quota Programmatically

### Via Claude Code Session Tool

Use the `mcp__ccd_session_mgmt__get_usage` tool to retrieve current quota and usage information:

```typescript
// Load the tool first
import { ToolSearch } from "@anthropic-ai/sdk";
const tools = await ToolSearch({
  query: "select:mcp__ccd_session_mgmt__get_usage"
});

// Call it with no parameters (defaults to "self" session)
const usage = await client.mcp.ccd_session_mgmt.getUsage({
  session_id: "self" // optional, defaults to current session
});
```

### Response Structure

The response includes two main sections:

#### 1. Plan Limits
```typescript
{
  plan: {
    status: "ok" | "unavailable",
    plan: "Pro",
    windows: [
      {
        label: "5-hour limit",
        percentUsed: number,
        resetsAt: ISO8601 timestamp,
        resetsIn: "Xh Ym" (human-readable)
      },
      {
        label: "Weekly · all models",
        percentUsed: number,
        resetsAt: ISO8601 timestamp,
        resetsIn: "Xd Yh" (human-readable)
      }
    ],
    extraUsage: {
      enabled: boolean,
      currency: "USD"
    }
  }
}
```

#### 2. Session Context Window
```typescript
{
  context: {
    session: "self",
    status: "ok" | "unavailable",
    tokensUsed: number,
    contextWindow: number,
    percentUsed: number,
    autoCompactsAtPercent: number,
    categories: [
      {
        name: string,
        tokens: number,
        percent: number
      }
    ]
  }
}
```

### Quota Windows Explained

**5-hour limit**: Rolling window for rapid prototyping and testing. Useful for short bursts of development work.

**Weekly limit**: Cumulative usage across all models within one week. This is the primary constraint for ongoing work.

### Context Categories

The token usage is broken down by:
- **System tools** - infrastructure overhead (Glob, Grep, Read, etc.)
- **MCP tools** - integrated tool ecosystem tokens
- **Messages** - your conversation exchanges
- **System prompt** - Claude Code's system instructions
- **Skills** - loaded skill documentation
- **Memory files** - persistent memory system

## For Agents

When spawning agents or planning multi-turn work:

1. **Check quota before large tasks** - call `getUsage()` to see headroom
2. **Watch the 5-hour window** - useful for detecting if you're in a rapid burst
3. **Track weekly usage** - plan major work around reset times
4. **Monitor context growth** - auto-compact triggers at 84% (200K token window)

## Status Codes

- `"ok"` - Information is current and accurate
- `"unavailable"` - System could not read the data; try again
- `"not_applicable"` - Quota limits do not apply (e.g., using API key directly)
