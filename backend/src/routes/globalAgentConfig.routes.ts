import express from 'express';
import { authenticateToken } from '../middleware/auth';
import GlobalAgentConfig from '../models/globalAgentConfig.model';
import { mcpService } from '../services/mcp.service';

const router = express.Router();

// Get global agent configuration
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [Global Config] GET request received');
    
    let config = await GlobalAgentConfig.findOne();
    
    // If no config exists, create default one
    if (!config) {
      console.log('🔧 [Global Config] No config found, creating default');
      config = new GlobalAgentConfig({
        metadata: {
          createdBy: req.user?.userId || 'system'
        }
      });
      await config.save();
    }
    
    console.log('✅ Global agent configuration retrieved successfully');
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('❌ Error retrieving global agent configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve global agent configuration'
    });
  }
});

// Update global agent configuration
router.put('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [Global Config] PUT request received');
    console.log('🔧 [Global Config] Body:', req.body);
    
    const {
      responseLimits,
      leadScoring,
      systemSettings,
      mcpTools
    } = req.body;
    
    // Validate required fields
    if (!responseLimits || !leadScoring || !systemSettings) {
      return res.status(400).json({
        success: false,
        error: 'Missing required configuration fields'
      });
    }
    
    // Validate response limits
    if (responseLimits.maxResponsesPerConversation < 1 || responseLimits.maxResponsesPerConversation > 20) {
      return res.status(400).json({
        success: false,
        error: 'maxResponsesPerConversation must be between 1 and 20'
      });
    }
    
    // Validate lead scoring auto-disable score
    if (leadScoring.autoDisableOnScore && (leadScoring.autoDisableOnScore < 1 || leadScoring.autoDisableOnScore > 7)) {
      return res.status(400).json({
        success: false,
        error: 'autoDisableOnScore must be between 1 and 7'
      });
    }
    
    let config = await GlobalAgentConfig.findOne();
    
    if (!config) {
      // Create new config
      config = new GlobalAgentConfig({
        responseLimits,
        leadScoring,
        systemSettings,
        metadata: {
          createdBy: req.user?.userId || 'system'
        }
      });
    } else {
      // Update existing config
      config.responseLimits = responseLimits;
      config.leadScoring = leadScoring;
      config.systemSettings = systemSettings;
      
      // Update MCP tools if provided
      if (mcpTools !== undefined) {
        config.mcpTools = mcpTools;
        // Reinitialize MCP service with new config
        await mcpService.updateConfig(config);
      }
    }
    
    await config.save();
    console.log('✅ Global agent configuration updated successfully');
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('❌ Error updating global agent configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update global agent configuration'
    });
  }
});

// Reset global agent configuration to defaults
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [Global Config] POST reset request received');
    
    // Delete existing config
    await GlobalAgentConfig.deleteMany({});
    
    // Create new default config
    const defaultConfig = new GlobalAgentConfig({
      metadata: {
        createdBy: req.user?.userId || 'system'
      }
    });
    
    await defaultConfig.save();
    console.log('✅ Global agent configuration reset to defaults');
    
    res.json({
      success: true,
      data: defaultConfig
    });
  } catch (error) {
    console.error('❌ Error resetting global agent configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset global agent configuration'
    });
  }
});

// Get lead scoring scale information
router.get('/lead-scoring-scale', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [Global Config] GET lead scoring scale request received');
    
    const config = await GlobalAgentConfig.findOne();
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Global configuration not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        scale: config.leadScoring.scale,
        autoDisableOnScore: config.leadScoring.autoDisableOnScore,
        autoDisableOnMilestone: config.leadScoring.autoDisableOnMilestone
      }
    });
  } catch (error) {
    console.error('❌ Error retrieving lead scoring scale:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve lead scoring scale'
    });
  }
});

// MCP Tools Routes

// Get MCP tools configuration
router.get('/mcp-tools', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [MCP] GET MCP tools configuration request received');
    
    const config = await GlobalAgentConfig.findOne();
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Global configuration not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        enabled: config.mcpTools?.enabled || false,
        servers: config.mcpTools?.servers || []
      }
    });
  } catch (error) {
    console.error('❌ Error retrieving MCP tools configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve MCP tools configuration'
    });
  }
});

// Get available MCP tools
router.get('/mcp-tools/available', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [MCP] GET available tools request received');
    
    const config = await GlobalAgentConfig.findOne();
    
    if (!config || !config.mcpTools?.enabled) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    await mcpService.initialize(config);
    const tools = await mcpService.getAvailableTools();
    
    res.json({
      success: true,
      data: tools
    });
  } catch (error) {
    console.error('❌ Error retrieving available MCP tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available MCP tools'
    });
  }
});

// Update MCP tools configuration
router.put('/mcp-tools', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [MCP] PUT MCP tools configuration request received');
    
    const { enabled, servers } = req.body;
    
    let config = await GlobalAgentConfig.findOne();
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Global configuration not found'
      });
    }
    
    // Update MCP tools configuration
    if (!config.mcpTools) {
      config.mcpTools = {
        enabled: false,
        servers: []
      };
    }
    
    if (enabled !== undefined) {
      config.mcpTools.enabled = enabled;
    }
    
    if (servers !== undefined) {
      // Validate servers
      for (const server of servers) {
        if (!server.name || !server.url) {
          return res.status(400).json({
            success: false,
            error: 'Each MCP server must have a name and URL'
          });
        }
        
        if (!['http', 'websocket', 'stdio'].includes(server.connectionType)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid connection type. Must be http, websocket, or stdio'
          });
        }
      }
      
      config.mcpTools.servers = servers;
    }
    
    await config.save();
    
    // Reinitialize MCP service
    await mcpService.updateConfig(config);
    
    console.log('✅ MCP tools configuration updated successfully');
    
    res.json({
      success: true,
      data: config.mcpTools
    });
  } catch (error) {
    console.error('❌ Error updating MCP tools configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update MCP tools configuration'
    });
  }
});

// Add or update an MCP server
router.post('/mcp-tools/servers', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [MCP] POST add/update MCP server request received');
    
    const server = req.body;
    
    if (!server.name || !server.url) {
      return res.status(400).json({
        success: false,
        error: 'Server name and URL are required'
      });
    }
    
    let config = await GlobalAgentConfig.findOne();
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Global configuration not found'
      });
    }
    
    if (!config.mcpTools) {
      config.mcpTools = {
        enabled: false,
        servers: []
      };
    }
    
    // Check if server already exists
    const existingIndex = config.mcpTools.servers.findIndex(s => s.name === server.name);
    
    if (existingIndex >= 0) {
      // Update existing server
      config.mcpTools.servers[existingIndex] = {
        ...config.mcpTools.servers[existingIndex],
        ...server,
        name: server.name // Ensure name doesn't change
      };
    } else {
      // Add new server
      config.mcpTools.servers.push({
        name: server.name,
        url: server.url,
        connectionType: server.connectionType || 'http',
        authentication: server.authentication || { type: 'none' },
        tools: server.tools || [],
        enabled: server.enabled !== undefined ? server.enabled : true,
        timeout: server.timeout || 30000,
        retryAttempts: server.retryAttempts || 3
      });
    }
    
    await config.save();
    
    // Reinitialize MCP service
    await mcpService.updateConfig(config);
    
    console.log(`✅ MCP server ${server.name} ${existingIndex >= 0 ? 'updated' : 'added'} successfully`);
    
    res.json({
      success: true,
      data: config.mcpTools.servers.find(s => s.name === server.name)
    });
  } catch (error) {
    console.error('❌ Error adding/updating MCP server:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add/update MCP server'
    });
  }
});

// Delete an MCP server
router.delete('/mcp-tools/servers/:serverName', authenticateToken, async (req, res) => {
  try {
    console.log(`🔧 [MCP] DELETE MCP server request received: ${req.params.serverName}`);
    
    const serverName = req.params.serverName;
    
    let config = await GlobalAgentConfig.findOne();
    
    if (!config || !config.mcpTools) {
      return res.status(404).json({
        success: false,
        error: 'MCP tools configuration not found'
      });
    }
    
    const initialLength = config.mcpTools.servers.length;
    config.mcpTools.servers = config.mcpTools.servers.filter(s => s.name !== serverName);
    
    if (config.mcpTools.servers.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: `Server ${serverName} not found`
      });
    }
    
    await config.save();
    
    // Reinitialize MCP service
    await mcpService.updateConfig(config);
    
    console.log(`✅ MCP server ${serverName} deleted successfully`);
    
    res.json({
      success: true,
      message: `Server ${serverName} deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error deleting MCP server:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete MCP server'
    });
  }
});

// Test MCP server connection
router.post('/mcp-tools/servers/:serverName/test', authenticateToken, async (req, res) => {
  try {
    console.log(`🔧 [MCP] POST test connection request received: ${req.params.serverName}`);
    
    const serverName = req.params.serverName;
    
    const config = await GlobalAgentConfig.findOne();
    
    if (!config || !config.mcpTools) {
      return res.status(404).json({
        success: false,
        error: 'MCP tools configuration not found'
      });
    }
    
    const server = config.mcpTools.servers.find(s => s.name === serverName);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        error: `Server ${serverName} not found`
      });
    }
    
    // Initialize service with current config (force enabled for testing)
    // This allows testing connections even when MCP tools are disabled
    await mcpService.initialize(config, true);
    
    // Test connection
    const result = await mcpService.testConnection(serverName);
    
    res.json({
      success: result.success,
      error: result.error,
      message: result.success 
        ? `Connection to ${serverName} successful` 
        : `Connection to ${serverName} failed: ${result.error}`
    });
  } catch (error: any) {
    console.error('❌ Error testing MCP server connection:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test MCP server connection'
    });
  }
});

// Execute an MCP tool (for testing)
router.post('/mcp-tools/execute', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 [MCP] POST execute tool request received');
    
    const { toolName, parameters } = req.body;
    
    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required'
      });
    }
    
    const config = await GlobalAgentConfig.findOne();
    
    if (!config || !config.mcpTools?.enabled) {
      return res.status(400).json({
        success: false,
        error: 'MCP tools are not enabled'
      });
    }
    
    await mcpService.initialize(config);
    
    const result = await mcpService.executeTool(toolName, parameters || {});
    
    res.json({
      success: result.success,
      data: result.result,
      error: result.error
    });
  } catch (error: any) {
    console.error('❌ Error executing MCP tool:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to execute MCP tool'
    });
  }
});

export default router;
