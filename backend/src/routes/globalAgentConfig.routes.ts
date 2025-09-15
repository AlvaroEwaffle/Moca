import express from 'express';
import { authenticateToken } from '../middleware/auth';
import GlobalAgentConfig from '../models/globalAgentConfig.model';

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
      systemSettings
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
      config.metadata.updatedAt = new Date();
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

export default router;
