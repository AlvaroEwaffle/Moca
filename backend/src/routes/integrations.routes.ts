import express from 'express';
import { authenticateToken } from '../middleware/auth';
import Integration, { IIntegration, IntegrationType } from '../models/integration.model';

const router = express.Router();

const serializeIntegration = (integration: IIntegration) => integration.toSafeObject();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const integrations = await Integration.find({ userId: req.user!.userId }).sort({ createdAt: 1 });
    res.json({
      success: true,
      data: integrations.map(serializeIntegration)
    });
  } catch (error) {
    console.error('❌ Error fetching integrations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch integrations'
    });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { type, status = 'pending', metadata = {} } = req.body as {
      type: IntegrationType;
      status?: string;
      metadata?: Record<string, any>;
    };

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Integration type is required'
      });
    }

    const integration = await Integration.findOneAndUpdate(
      { userId: req.user!.userId, type },
      {
        userId: req.user!.userId,
        type,
        status,
        metadata: {
          ...metadata,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      success: true,
      data: serializeIntegration(integration)
    });
  } catch (error) {
    console.error('❌ Error creating integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create integration'
    });
  }
});

router.post('/connect', authenticateToken, async (req, res) => {
  try {
    const { type } = req.body as { type: IntegrationType };

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Integration type is required'
      });
    }

    const previousIntegration = await Integration.findOne({ userId: req.user!.userId, type });

    const integration = await Integration.findOneAndUpdate(
      { userId: req.user!.userId, type },
      {
        userId: req.user!.userId,
        type,
        status: 'pending',
        metadata: {
          ...(previousIntegration?.metadata || {}),
          requestedAt: new Date()
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      data: serializeIntegration(integration)
    });
  } catch (error) {
    console.error('❌ Error updating integration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update integration'
    });
  }
});

router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, metadata, error: errorMessage } = req.body as {
      status: string;
      metadata?: Record<string, any>;
      error?: string;
    };

    const integration = await Integration.findOne({
      _id: req.params.id,
      userId: req.user!.userId
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    if (status) {
      integration.status = status as any;
    }

    if (metadata) {
      integration.metadata = {
        ...integration.metadata,
        ...metadata,
        updatedAt: new Date()
      };
    }

    integration.error = errorMessage;

    await integration.save();

    res.json({
      success: true,
      data: serializeIntegration(integration)
    });
  } catch (error) {
    console.error('❌ Error updating integration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update integration status'
    });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const integration = await Integration.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!.userId
    });

    if (!integration) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Integration removed successfully'
      }
    });
  } catch (error) {
    console.error('❌ Error removing integration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove integration'
    });
  }
});

export default router;

