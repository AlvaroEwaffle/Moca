import mongoose, { Document, Schema } from 'mongoose';

// Global agent configuration schema
const GlobalAgentConfigSchema = new Schema({
  // Response limit configuration
  responseLimits: {
    maxResponsesPerConversation: { 
      type: Number, 
      default: 3, 
      min: 1, 
      max: 20 
    },
    resetCounterOnMilestone: { 
      type: Boolean, 
      default: false 
    }
  },
  
  // Lead scoring configuration
  leadScoring: {
    // Explicit 7-step scale configuration
    scale: {
      step1: { 
        name: { type: String, default: 'Contact Received' },
        description: { type: String, default: 'Initial contact from customer' },
        score: { type: Number, default: 1 }
      },
      step2: { 
        name: { type: String, default: 'Answers 1 Question' },
        description: { type: String, default: 'Customer responds to first question' },
        score: { type: Number, default: 2 }
      },
      step3: { 
        name: { type: String, default: 'Confirms Interest' },
        description: { type: String, default: 'Customer shows clear interest' },
        score: { type: Number, default: 3 }
      },
      step4: { 
        name: { type: String, default: 'Milestone Met' },
        description: { type: String, default: 'Specific milestone achieved' },
        score: { type: Number, default: 4 }
      },
      step5: { 
        name: { type: String, default: 'Reminder Sent' },
        description: { type: String, default: 'Follow-up reminder sent' },
        score: { type: Number, default: 5 }
      },
      step6: { 
        name: { type: String, default: 'Reminder Answered' },
        description: { type: String, default: 'Customer responds to reminder' },
        score: { type: Number, default: 6 }
      },
      step7: { 
        name: { type: String, default: 'Sales Done' },
        description: { type: String, default: 'Sale completed successfully' },
        score: { type: Number, default: 7 }
      }
    },
    
    // Auto-disable agent when reaching specific lead score
    autoDisableOnScore: { 
      type: Number, 
      min: 1, 
      max: 7, 
      required: false 
    },
    
    // Auto-disable agent when reaching specific milestone
    autoDisableOnMilestone: { 
      type: Boolean, 
      default: true 
    }
  },
  
  // System-wide settings
  systemSettings: {
    enableResponseLimits: { type: Boolean, default: true },
    enableLeadScoreAutoDisable: { type: Boolean, default: true },
    enableMilestoneAutoDisable: { type: Boolean, default: true },
    logAllDecisions: { type: Boolean, default: true }
  },
  
  // MCP (Model Context Protocol) tool configuration
  mcpTools: {
    enabled: { type: Boolean, default: false },
    servers: [{
      name: { type: String, required: true },
      url: { type: String, required: true }, // MCP server URL (HTTP/WebSocket)
      connectionType: { 
        type: String, 
        enum: ['http', 'websocket', 'stdio'], 
        default: 'http' 
      },
      authentication: {
        type: { 
          type: String, 
          enum: ['none', 'api_key', 'bearer', 'oauth2'], 
          default: 'none' 
        },
        apiKey: { type: String, required: false },
        bearerToken: { type: String, required: false },
        oauth2Config: {
          clientId: { type: String, required: false },
          clientSecret: { type: String, required: false },
          tokenUrl: { type: String, required: false }
        }
      },
      tools: [{
        name: { type: String, required: true },
        description: { type: String, required: true },
        enabled: { type: Boolean, default: true },
        parameters: { type: Schema.Types.Mixed, default: {} }
      }],
      enabled: { type: Boolean, default: true },
      timeout: { type: Number, default: 30000 }, // Timeout in milliseconds
      retryAttempts: { type: Number, default: 3 }
    }]
  },
  
  // Metadata
  metadata: {
    createdBy: { type: String, required: true }, // User ID who created this config
    version: { type: String, default: '1.0.0' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ensure only one global config exists
GlobalAgentConfigSchema.index({}, { unique: true });

export interface IGlobalAgentConfig extends Document {
  id: string;
  responseLimits: {
    maxResponsesPerConversation: number;
    resetCounterOnMilestone: boolean;
  };
  leadScoring: {
    scale: {
      step1: { name: string; description: string; score: number };
      step2: { name: string; description: string; score: number };
      step3: { name: string; description: string; score: number };
      step4: { name: string; description: string; score: number };
      step5: { name: string; description: string; score: number };
      step6: { name: string; description: string; score: number };
      step7: { name: string; description: string; score: number };
    };
    autoDisableOnScore?: number;
    autoDisableOnMilestone: boolean;
  };
  systemSettings: {
    enableResponseLimits: boolean;
    enableLeadScoreAutoDisable: boolean;
    enableMilestoneAutoDisable: boolean;
    logAllDecisions: boolean;
  };
  mcpTools: {
    enabled: boolean;
    servers: Array<{
      name: string;
      url: string;
      connectionType: 'http' | 'websocket' | 'stdio';
      authentication: {
        type: 'none' | 'api_key' | 'bearer' | 'oauth2';
        apiKey?: string;
        bearerToken?: string;
        oauth2Config?: {
          clientId?: string;
          clientSecret?: string;
          tokenUrl?: string;
        };
      };
      tools: Array<{
        name: string;
        description: string;
        enabled: boolean;
        parameters?: any;
      }>;
      enabled: boolean;
      timeout: number;
      retryAttempts: number;
    }>;
  };
  metadata: {
    createdBy: string;
    version: string;
  };
}

export default mongoose.model<IGlobalAgentConfig>('GlobalAgentConfig', GlobalAgentConfigSchema);
