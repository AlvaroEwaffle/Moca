# MCP (Model Context Protocol) Integration Guide

This document explains how to configure and use MCP tools with your agent.

## Overview

MCP (Model Context Protocol) allows your agent to connect to external tools and data sources, extending its capabilities beyond basic conversation. When MCP tools are enabled, the agent can automatically use these tools during conversations to provide more accurate and contextual responses.

## Configuration

### 1. Enable MCP Tools

MCP tools are configured through the Global Agent Configuration. You can enable/disable MCP tools and configure MCP servers.

### 2. Add an MCP Server

To add an MCP server, you need to provide:

- **Name**: A unique identifier for the server (e.g., "Fidelidapp Localhost")
- **URL**: The base URL of the MCP server (e.g., `http://localhost:4001` or `https://api.example.com`)
  - The system will automatically append `/health` for health checks
  - Tools will be discovered from `/tools` endpoint
- **Connection Type**: Currently supports `http` (WebSocket and stdio coming soon)
- **Authentication**: Configure authentication if required:
  - `none`: No authentication
  - `api_key`: API key authentication (sends as `X-API-Key` header)
  - `bearer`: Bearer token authentication (sends as `Authorization: Bearer <token>`)
  - `oauth2`: OAuth2 authentication (requires additional config)

### 3. Configure Tools (Optional)

**Note**: Tools can be automatically discovered from your server's `/tools` endpoint, so manual configuration is optional.

If you want to manually configure tools, for each tool specify:

- **Name**: The tool name (must match the tool name on the MCP server)
- **Description**: A description of what the tool does (used by the AI to decide when to use it)
- **Enabled**: Whether the tool is available for use
- **Parameters**: Optional parameter schema (JSON Schema format)

**Auto-Discovery**: If you don't configure tools manually, the system will automatically fetch them from `GET /tools` when the server is enabled.

## API Endpoints

### Get MCP Tools Configuration
```
GET /api/global-agent-config/mcp-tools
```

### Get Available Tools
```
GET /api/global-agent-config/mcp-tools/available
```
Returns all available tools from all connected MCP servers.

### Update MCP Tools Configuration
```
PUT /api/global-agent-config/mcp-tools
Body: {
  enabled: boolean,
  servers: [...]
}
```

### Add/Update MCP Server
```
POST /api/global-agent-config/mcp-tools/servers
Body: {
  name: string,
  url: string,
  connectionType: 'http' | 'websocket' | 'stdio',
  authentication: {...},
  tools: [...],
  enabled: boolean,
  timeout: number,
  retryAttempts: number
}
```

### Delete MCP Server
```
DELETE /api/global-agent-config/mcp-tools/servers/:serverName
```

### Test Server Connection
```
POST /api/global-agent-config/mcp-tools/servers/:serverName/test
```

### Execute Tool (for testing)
```
POST /api/global-agent-config/mcp-tools/execute
Body: {
  toolName: string,
  parameters: {...}
}
```

## Example Configuration

```json
{
  "enabled": true,
  "servers": [
    {
      "name": "weather-service",
      "url": "https://api.weather.com/mcp",
      "connectionType": "http",
      "authentication": {
        "type": "api_key",
        "apiKey": "your-api-key-here"
      },
      "tools": [
        {
          "name": "get_weather",
          "description": "Get current weather for a location",
          "enabled": true,
          "parameters": {
            "type": "object",
            "properties": {
              "location": {
                "type": "string",
                "description": "City name or location"
              }
            },
            "required": ["location"]
          }
        }
      ],
      "enabled": true,
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

## How It Works

1. **Initialization**: When the agent generates a response, it checks if MCP tools are enabled.

2. **Tool Discovery**: The agent retrieves all available tools from configured MCP servers.

3. **Function Calling**: The agent uses OpenAI's function calling feature to make tools available to the AI model.

4. **Automatic Tool Use**: During conversation, if the AI determines that a tool would be helpful, it will automatically call the tool.

5. **Tool Execution**: The MCP service executes the tool call on the appropriate MCP server.

6. **Response Generation**: The tool results are passed back to the AI, which incorporates them into the final response.

## MCP Server Requirements

Your MCP server should implement the following endpoints:

- `GET /health` (optional): Health check endpoint
- `GET /tools`: List available tools (returns array of tools or object with tools array)
- `POST /tools/execute`: Execute a tool (with tool name in request body)

### Tool Discovery Endpoint

**GET /tools**

Should return either:
- An array of tools: `[{ name, description, parameters }, ...]`
- An object with tools array: `{ tools: [{ name, description, parameters }, ...] }`
- An object with data array: `{ data: [{ name, description, parameters }, ...] }`

Each tool object should have:
- `name`: Tool identifier
- `description`: What the tool does
- `parameters` or `schema` or `inputSchema`: JSON Schema for tool parameters

### Tool Execution Endpoint

**POST /tools/execute**

Request body format:
```json
{
  "tool": "tool_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

Response format:
```json
{
  "result": {
    // Tool-specific result data
  }
}
```

### Example Server Endpoints

Based on your server structure:
- `GET /` - Service information
- `GET /health` - Health check ✅
- `GET /tools` - Tools catalog ✅
- `POST /tools/execute` - Execute tool ✅
- `POST /chat` - Chat endpoint (not used by MCP integration)
- `GET /chat/history/:sessionId` - Chat history (not used by MCP integration)
- `DELETE /chat/session/:sessionId` - Delete session (not used by MCP integration)

## Security Considerations

- Store API keys and tokens securely (consider using environment variables)
- Use HTTPS for MCP server connections
- Implement proper authentication for your MCP servers
- Validate tool parameters before execution
- Set appropriate timeouts to prevent hanging requests

## Troubleshooting

### Tools Not Available
- Check that MCP tools are enabled in the configuration
- Verify that the MCP server is reachable
- Check server connection status using the test endpoint
- Review server logs for connection errors

### Tool Execution Fails
- Verify tool parameters match the expected schema
- Check authentication credentials
- Review MCP server logs
- Test tool execution manually using the execute endpoint

### Agent Not Using Tools
- Ensure tool descriptions are clear and descriptive
- Check that tools are enabled
- Verify the AI model supports function calling (gpt-3.5-turbo or gpt-4)
- Review conversation context - tools are only used when relevant

## Future Enhancements

- WebSocket connection support
- stdio connection support for local MCP servers
- OAuth2 token refresh automation
- Tool usage analytics
- Rate limiting per tool
- Tool result caching

