/**
 * MCP (Model Context Protocol) Service
 * 
 * Handles connections to MCP servers and tool execution
 */

import axios, { AxiosInstance } from 'axios';
import { IGlobalAgentConfig } from '../models/globalAgentConfig.model';

export interface MCPTool {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolResult {
  success: boolean;
  result?: any;
  error?: string;
  toolName: string;
}

export interface MCPServerConnection {
  name: string;
  url: string;
  connectionType: 'http' | 'websocket' | 'stdio';
  client?: AxiosInstance;
  authenticated: boolean;
}

class MCPService {
  private connections: Map<string, MCPServerConnection> = new Map();
  private config: IGlobalAgentConfig | null = null;

  /**
   * Initialize MCP service with account-specific configuration
   * @param accountMcpConfig Account-specific MCP configuration
   * @param forceEnabled Allow initialization even when disabled (for testing)
   */
  async initializeWithAccountConfig(
    accountMcpConfig: { enabled: boolean; servers: any[] } | null | undefined,
    forceEnabled: boolean = false
  ): Promise<void> {
    // Allow initialization even when disabled if forceEnabled is true (for testing)
    if (!accountMcpConfig?.enabled && !forceEnabled) {
      console.log('🔧 [MCP] MCP tools are disabled for this account');
      return;
    }

    if (!accountMcpConfig) {
      console.log('🔧 [MCP] No MCP configuration found for account');
      return;
    }

    // Use account-specific servers
    const serversToUse = accountMcpConfig.servers || [];
    const filteredServers = serversToUse.filter(server => server.enabled);
    
    console.log(`🔧 [MCP] Using account-specific servers (${filteredServers.length} servers)`);

    // Initialize connections to account-specific MCP servers
    for (const server of filteredServers) {
      await this.connectToServer(server);
    }
  }

  /**
   * Initialize MCP service with global configuration (legacy support)
   * @param config Global MCP configuration
   * @param forceEnabled Allow initialization even when disabled (for testing)
   * @param accountServerNames Optional list of server names to use for this account (empty = use all enabled servers)
   */
  async initialize(
    config: IGlobalAgentConfig, 
    forceEnabled: boolean = false,
    accountServerNames?: string[]
  ): Promise<void> {
    this.config = config;
    
    // Allow initialization even when disabled if forceEnabled is true (for testing)
    if (!config.mcpTools?.enabled && !forceEnabled) {
      console.log('🔧 [MCP] MCP tools are disabled');
      return;
    }

    // Filter servers based on account selection
    const serversToUse = config.mcpTools?.servers || [];
    let filteredServers = serversToUse.filter(server => server.enabled);
    
    // If account has specific server selection, filter to only those servers
    if (accountServerNames && accountServerNames.length > 0) {
      filteredServers = filteredServers.filter(server => 
        accountServerNames.includes(server.name)
      );
      console.log(`🔧 [MCP] Using account-specific servers: ${accountServerNames.join(', ')}`);
    } else {
      console.log(`🔧 [MCP] Using all enabled servers (${filteredServers.length} servers)`);
    }

    // Initialize connections to filtered MCP servers
    for (const server of filteredServers) {
      await this.connectToServer(server);
    }
  }

  /**
   * Connect to an MCP server (accepts any server config with compatible structure)
   */
  private async connectToServer(server: {
    name: string;
    url: string;
    connectionType: 'http' | 'websocket' | 'stdio';
    authentication: any;
    enabled?: boolean;
    timeout?: number;
  }): Promise<void> {
    try {
      console.log(`🔌 [MCP] Connecting to server: ${server.name} (${server.url})`);

      let client: AxiosInstance | undefined;

      if (server.connectionType === 'http') {
        client = axios.create({
          baseURL: server.url,
          timeout: server.timeout || 30000,
          headers: this.buildAuthHeaders(server.authentication)
        });

        // Test connection
        try {
          await client.get('/health').catch(() => {
            // Health endpoint might not exist, try listing tools instead
            return client!.get('/tools');
          });
          console.log(`✅ [MCP] Connected to ${server.name}`);
        } catch (error: any) {
          console.warn(`⚠️ [MCP] Could not verify connection to ${server.name}:`, error.message);
        }
      }

      const connection: MCPServerConnection = {
        name: server.name,
        url: server.url,
        connectionType: server.connectionType,
        client,
        authenticated: !!client
      };

      this.connections.set(server.name, connection);
    } catch (error: any) {
      console.error(`❌ [MCP] Failed to connect to ${server.name}:`, error.message);
    }
  }

  /**
   * Build authentication headers for MCP server
   */
  private buildAuthHeaders(auth: {
    type: 'none' | 'api_key' | 'bearer' | 'oauth2';
    apiKey?: string;
    bearerToken?: string;
    oauth2Config?: any;
  }): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (auth.type === 'api_key' && auth.apiKey) {
      headers['X-API-Key'] = auth.apiKey;
    } else if (auth.type === 'bearer' && auth.bearerToken) {
      headers['Authorization'] = `Bearer ${auth.bearerToken}`;
    } else if (auth.type === 'oauth2') {
      // OAuth2 would require token refresh logic
      // For now, we'll use bearer token if available
      if (auth.bearerToken) {
        headers['Authorization'] = `Bearer ${auth.bearerToken}`;
      }
    }

    return headers;
  }

  /**
   * Get tool schema from server (helper method)
   */
  private async getToolSchema(connection: MCPServerConnection, toolName: string): Promise<any> {
    try {
      if (connection.client) {
        const response = await connection.client.get('/tools');
        const toolsList = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.tools || response.data?.data || []);
        const tool = toolsList.find((t: any) => {
          const name = t.type === 'function' && t.function ? t.function.name : t.name;
          return name === toolName;
        });
        if (tool) {
          return tool.type === 'function' && tool.function 
            ? tool.function.parameters 
            : tool.parameters;
        }
      }
    } catch (error) {
      console.warn(`⚠️ [MCP] Could not fetch tool schema for ${toolName}:`, error);
    }
    return null;
  }

  /**
   * Get available tools from all connected MCP servers
   * Works with currently established connections (from initialize or initializeWithAccountConfig)
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    const tools: MCPTool[] = [];

    // Get tools from all currently connected servers
    for (const [serverName, connection] of this.connections.entries()) {
      if (!connection.authenticated) continue;

      // Fetch tools dynamically from server /tools endpoint
      if (connection.client) {
        try {
          const response = await connection.client.get('/tools');
          if (response.data) {
            // Handle different response formats
            let toolsList: any[] = [];
            
            if (Array.isArray(response.data)) {
              toolsList = response.data;
            } else if (response.data.tools && Array.isArray(response.data.tools)) {
              toolsList = response.data.tools;
            } else if (response.data.data && Array.isArray(response.data.data)) {
              toolsList = response.data.data;
            }
            
            for (const tool of toolsList) {
              // Handle OpenAI-style format: { type: "function", function: { name, description, parameters } }
              let toolName: string;
              let toolDescription: string;
              let toolParameters: any;
              
              if (tool.type === 'function' && tool.function) {
                toolName = tool.function.name;
                toolDescription = tool.function.description || '';
                toolParameters = tool.function.parameters || {};
              } else {
                // Handle direct format: { name, description, parameters }
                toolName = tool.name;
                toolDescription = tool.description || tool.desc || '';
                toolParameters = tool.parameters || tool.schema || tool.inputSchema || {};
              }
              
              // Only add if not already in config and has valid name
              if (toolName && typeof toolName === 'string' && toolName.trim() !== '' && !tools.find(t => t.name === toolName)) {
                tools.push({
                  name: toolName.trim(),
                  description: toolDescription || `Tool: ${toolName}`,
                  parameters: toolParameters
                });
              } else if (!toolName || toolName.trim() === '') {
                console.warn(`⚠️ [MCP] Skipping tool from ${serverName} with missing or invalid name:`, tool);
              }
            }
            
            console.log(`✅ [MCP] Discovered ${toolsList.length} tools from ${serverName}`);
          }
        } catch (error: any) {
          console.log(`ℹ️ [MCP] Server ${serverName} /tools endpoint: ${error.message || 'Not available'}`);
        }
      }
    }

    return tools;
  }

  /**
   * Execute an MCP tool
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, any> = {}
  ): Promise<MCPToolResult> {
    // Find the tool in any connected server
    for (const [serverName, connection] of this.connections.entries()) {
      if (!connection || !connection.authenticated) {
        continue; // Try next server
      }

      // Check if server has the tool by fetching tools
      let toolExists = false;
      let toolSchema: any = null;
      
      if (connection.client) {
        try {
          const toolsResponse = await connection.client.get('/tools');
          const toolsList = Array.isArray(toolsResponse.data) 
            ? toolsResponse.data 
            : (toolsResponse.data?.tools || toolsResponse.data?.data || []);
          
          // Check if tool exists and get its schema
          const foundTool = toolsList.find((t: any) => {
            const name = t.type === 'function' && t.function ? t.function.name : t.name;
            return name === toolName;
          });
          
          if (foundTool) {
            toolExists = true;
            toolSchema = foundTool.type === 'function' && foundTool.function 
              ? foundTool.function.parameters 
              : foundTool.parameters;
          }
        } catch (error) {
          // If we can't fetch tools, try to execute anyway (server might have it)
          toolExists = true;
        }
      }

      if (!toolExists) continue;

      try {
        console.log(`🔧 [MCP] Executing tool: ${toolName} on server: ${serverName}`);

        // Validate required parameters
        if (toolSchema?.required) {
          const missingParams = toolSchema.required.filter(
            (param: string) => !parameters[param] || (typeof parameters[param] === 'string' && parameters[param].trim() === '')
          );
          if (missingParams.length > 0) {
            console.error(`❌ [MCP] Missing required parameters for ${toolName}:`, missingParams);
            console.error(`❌ [MCP] Provided parameters:`, Object.keys(parameters));
            return {
              success: false,
              error: `Missing required parameters: ${missingParams.join(', ')}`,
              toolName
            };
          }
        }

        let result: any;

        if (connection.connectionType === 'http' && connection.client) {
          // Execute via HTTP POST to /tools/execute with tool name in body
          // Format: POST /tools/execute { name: "toolName", arguments: {...} }
          console.log(`📤 [MCP] Sending execute request:`, {
            name: toolName,
            arguments: parameters
          });
          
          const response = await connection.client.post(
            '/tools/execute',
            { 
              name: toolName,
              arguments: parameters
            },
            { timeout: 30000 } // Default timeout
          );
          result = response.data;
          console.log(`📥 [MCP] Execute response received:`, JSON.stringify(result, null, 2).substring(0, 500));
        } else {
          return {
            success: false,
            error: `Connection type ${connection.connectionType} not yet implemented`,
            toolName
          };
        }

        console.log(`✅ [MCP] Tool ${toolName} executed successfully`);
        console.log(`📊 [MCP] Tool result:`, JSON.stringify(result, null, 2).substring(0, 500));
        return {
          success: true,
          result,
          toolName
        };
      } catch (error: any) {
        console.error(`❌ [MCP] Error executing tool ${toolName}:`, error.message);
        console.error(`❌ [MCP] Error details:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          toolName,
          parameters
        });
        
        // Retry logic
        let retries = 3; // Default retry attempts
        while (retries > 0) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (connection.client) {
              console.log(`🔄 [MCP] Retry attempt: Sending execute request:`, {
                name: toolName,
                arguments: parameters
              });
              
              const response = await connection.client.post(
                '/tools/execute',
                { 
                  name: toolName,
                  arguments: parameters
                },
                { timeout: 30000 } // Default timeout
              );
              console.log(`✅ [MCP] Tool ${toolName} executed successfully after retry`);
              return {
                success: true,
                result: response.data,
                toolName
              };
            }
          } catch (retryError) {
            retries--;
          }
        }

        return {
          success: false,
          error: error.message || 'Unknown error',
          toolName
        };
      }
    }

    return {
      success: false,
      error: `Tool ${toolName} not found in any configured MCP server`,
      toolName
    };
  }

  /**
   * Convert MCP tools to OpenAI function format
   */
  async getOpenAIFunctions(): Promise<Array<{
    name: string;
    description: string;
    parameters: any;
  }>> {
    const tools = await this.getAvailableTools();
    
    console.log(`🔧 [MCP] Converting ${tools.length} tools to OpenAI format`);
    
    const openAITools = tools
      .map((tool, index) => {
        // Ensure name and description are strings
        const name = String(tool.name || '').trim();
        const description = String(tool.description || '').trim();
        
        if (!name) {
          console.error(`❌ [MCP] Tool at index ${index} is missing name:`, JSON.stringify(tool, null, 2));
          return null;
        }
        
        if (!description) {
          console.warn(`⚠️ [MCP] Tool "${name}" is missing description, using empty string`);
        }
        
        return {
          name,
          description: description || `Tool: ${name}`,
          parameters: tool.parameters || {
            type: 'object',
            properties: {},
            required: []
          }
        };
      })
      .filter((tool): tool is { name: string; description: string; parameters: any } => {
        if (tool === null) return false;
        // Final validation
        if (!tool.name || typeof tool.name !== 'string' || tool.name.trim() === '') {
          console.error(`❌ [MCP] Invalid tool after conversion:`, tool);
          return false;
        }
        return true;
      });
    
    console.log(`✅ [MCP] Successfully converted ${openAITools.length} tools to OpenAI format`);
    if (openAITools.length !== tools.length) {
      console.warn(`⚠️ [MCP] Filtered out ${tools.length - openAITools.length} invalid tools`);
    }
    
    return openAITools;
  }

  /**
   * Update configuration and reconnect
   */
  async updateConfig(config: IGlobalAgentConfig): Promise<void> {
    // Close existing connections
    this.connections.clear();
    
    // Reinitialize with new config
    await this.initialize(config);
  }

  /**
   * Test connection to a specific server
   */
  async testConnection(serverName: string): Promise<{ success: boolean; error?: string }> {
    // If connection doesn't exist, try to create it from config
    if (!this.connections.has(serverName) && this.config?.mcpTools) {
      const server = this.config.mcpTools.servers.find(s => s.name === serverName);
      if (server) {
        await this.connectToServer(server);
      }
    }

    const connection = this.connections.get(serverName);
    
    if (!connection) {
      return {
        success: false,
        error: `Server ${serverName} not found in configuration`
      };
    }

    if (!connection.client) {
      return {
        success: false,
        error: 'Connection client not initialized'
      };
    }

    try {
      // Try health endpoint first, fallback to base URL
      try {
        await connection.client.get('/health');
        return { success: true };
      } catch (healthError) {
        // If /health fails, try the base URL
        await connection.client.get('/');
        return { success: true };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection failed'
      };
    }
  }
}

// Export singleton instance
export const mcpService = new MCPService();
export default mcpService;

