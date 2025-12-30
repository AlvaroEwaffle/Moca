import express from 'express';
import Agent from '../models/agent.model';
import agentService from '../services/agent.service';
import { authenticateToken } from '../middleware/auth';
import Integration, { IntegrationType } from '../models/integration.model';

const router = express.Router();

const CHANNEL_KEYS: IntegrationType[] = ['instagram', 'whatsapp', 'gmail', 'google_calendar'];
const TONE_OPTIONS = new Set(['professional', 'friendly', 'casual']);
const TOOL_SET = new Set<IntegrationType>(['instagram', 'google_calendar', 'gmail', 'whatsapp']);

const serializeAgent = (agent: any) => ({
  id: agent.id,
  name: agent.name,
  description: agent.description,
  systemPrompt: agent.systemPrompt,
  enabledTools: agent.enabledTools,
  isPrimary: agent.isPrimary,
  status: agent.status,
  metadata: agent.metadata,
  createdAt: agent.createdAt,
  updatedAt: agent.updatedAt
});

const toPlainMetadata = (metadata: any = {}) =>
  typeof metadata?.toObject === 'function' ? metadata.toObject() : metadata || {};

const mergeMetadata = (current: any, updates: any) => {
  const base = toPlainMetadata(current);
  const next = { ...base };

  Object.entries(updates || {}).forEach(([key, value]) => {
    if (['channelAssignments', 'channelPrompts', 'channelVoices'].includes(key) && typeof value === 'object') {
      next[key] = { ...(base?.[key] || {}), ...(value as object) };
    } else {
      next[key] = value;
    }
  });

  return next;
};

const getConnectedTools = async (userId: string) => {
  const integrations = await Integration.find({ userId, status: 'connected' }).select('type').lean();
  return new Set(integrations.map((integration) => integration.type as IntegrationType));
};

const sanitizeEnabledTools = (tools: string[] | undefined, connectedTools: Set<string>) => {
  const requested = Array.isArray(tools) ? tools : [];
  const deduped = Array.from(new Set(requested.filter((tool) => TOOL_SET.has(tool as IntegrationType)))) as IntegrationType[];

  const invalid = deduped.filter((tool) => !connectedTools.has(tool));
  return { deduped, invalid };
};

const sanitizeMetadataPayload = (
  metadata: any,
  connectedTools: Set<string>,
  allowedTools: Set<string>
) => {
  if (!metadata || typeof metadata !== 'object') {
    return { sanitized: {}, invalidChannels: [] as string[] };
  }

  const sanitized: Record<string, any> = {};
  const invalidChannels: string[] = [];

  if (metadata.channelAssignments && typeof metadata.channelAssignments === 'object') {
    sanitized.channelAssignments = {};
    CHANNEL_KEYS.forEach((channel) => {
      const value = metadata.channelAssignments?.[channel];
      if (typeof value === 'boolean') {
        if (value && !allowedTools.has(channel)) {
          invalidChannels.push(`El agente no tiene habilitada la herramienta ${channel}`);
          return;
        }
        if (value && !connectedTools.has(channel)) {
          invalidChannels.push(`No hay una integración conectada para ${channel}`);
          return;
        }
        sanitized.channelAssignments[channel] = value;
      }
    });
  }

  if (metadata.channelPrompts && typeof metadata.channelPrompts === 'object') {
    sanitized.channelPrompts = {};
    CHANNEL_KEYS.forEach((channel) => {
      const value = metadata.channelPrompts?.[channel];
      if (typeof value === 'string') {
        sanitized.channelPrompts[channel] = value.slice(0, 1200);
      }
    });
  }

  if (metadata.channelVoices && typeof metadata.channelVoices === 'object') {
    sanitized.channelVoices = {};
    CHANNEL_KEYS.forEach((channel) => {
      const value = metadata.channelVoices?.[channel];
      if (typeof value === 'string' && TONE_OPTIONS.has(value)) {
        sanitized.channelVoices[channel] = value;
      }
    });
  }

  if (Array.isArray(metadata.tags)) {
    sanitized.tags = metadata.tags.slice(0, 20);
  }

  if (typeof metadata.color === 'string') {
    sanitized.color = metadata.color;
  }

  return { sanitized, invalidChannels };
};

const buildDefaultAssignments = (tools: IntegrationType[]) => {
  const set = new Set(tools);
  return CHANNEL_KEYS.reduce<Record<string, boolean>>((acc, channel) => {
    acc[channel] = set.has(channel);
    return acc;
  }, {});
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const agents = await Agent.find({
      userId: req.user!.userId,
      'status.archivedAt': { $exists: false }
    }).sort({ isPrimary: -1, createdAt: 1 });

    res.json({
      success: true,
      data: agents.map(serializeAgent)
    });
  } catch (error) {
    console.error('❌ Error fetching agents:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, systemPrompt, enabledTools = [], isPrimary, metadata } = req.body;

    if (!name || !systemPrompt) {
      return res.status(400).json({
        success: false,
        error: 'Name and system prompt are required'
      });
    }

    const connectedTools = await getConnectedTools(req.user!.userId);
    const { deduped, invalid } = sanitizeEnabledTools(enabledTools, connectedTools);
    if (invalid.length) {
      return res.status(400).json({
        success: false,
        error: `No puedes habilitar estas herramientas sin conectar su integración: ${invalid.join(', ')}`
      });
    }

    const allowedTools = new Set(deduped);
    const { sanitized: metadataPayload, invalidChannels } = sanitizeMetadataPayload(metadata, connectedTools, allowedTools);
    if (invalidChannels.length) {
      return res.status(400).json({
        success: false,
        error: invalidChannels.join('. ')
      });
    }

    if (isPrimary) {
      await Agent.updateMany(
        { userId: req.user!.userId, isPrimary: true },
        { $set: { isPrimary: false } }
      );
    }

    if (!metadataPayload.channelAssignments) {
      metadataPayload.channelAssignments = buildDefaultAssignments(deduped);
    }

    const agent = new Agent({
      userId: req.user!.userId,
      tenantId: (req.user as any)?.tenantId,
      name,
      description,
      systemPrompt,
      enabledTools: deduped,
      isPrimary: Boolean(isPrimary),
      metadata: Object.keys(metadataPayload).length ? metadataPayload : undefined
    });

    await agent.save();

    res.status(201).json({
      success: true,
      data: serializeAgent(agent)
    });
  } catch (error) {
    console.error('❌ Error creating agent:', error);
    res.status(500).json({ success: false, error: 'Failed to create agent' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const agent = await Agent.findOne({ _id: id, userId: req.user!.userId });

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const { name, description, systemPrompt, enabledTools, isPrimary, metadata } = req.body;

    const connectedTools = await getConnectedTools(req.user!.userId);
    let finalTools = agent.enabledTools;

    if (enabledTools) {
      const { deduped, invalid } = sanitizeEnabledTools(enabledTools, connectedTools);
      if (invalid.length) {
        return res.status(400).json({
          success: false,
          error: `No puedes habilitar estas herramientas sin conectar su integración: ${invalid.join(', ')}`
        });
      }
      agent.enabledTools = deduped;
      finalTools = deduped;
    }

    if (metadata) {
      const { sanitized: metadataPayload, invalidChannels } = sanitizeMetadataPayload(
        metadata,
        connectedTools,
        new Set<IntegrationType>(finalTools)
      );
      if (invalidChannels.length) {
        return res.status(400).json({
          success: false,
          error: invalidChannels.join('. ')
        });
      }
      agent.metadata = mergeMetadata(agent.metadata, metadataPayload);
    }

    if (name) agent.name = name;
    if (description !== undefined) agent.description = description;
    if (systemPrompt) agent.systemPrompt = systemPrompt;

    if (typeof isPrimary === 'boolean' && isPrimary) {
      await Agent.updateMany(
        { userId: req.user!.userId, _id: { $ne: agent.id } },
        { $set: { isPrimary: false } }
      );
      agent.isPrimary = true;
    } else if (typeof isPrimary === 'boolean') {
      agent.isPrimary = isPrimary;
    }

    await agent.save();

    res.json({
      success: true,
      data: serializeAgent(agent)
    });
  } catch (error) {
    console.error('❌ Error updating agent:', error);
    res.status(500).json({ success: false, error: 'Failed to update agent' });
  }
});

router.patch('/:id/toggle', authenticateToken, async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    agent.status.active = !agent.status.active;
    await agent.save();

    if (!agent.status.active && agent.isPrimary) {
      await agentService.ensureDefaultAgent(req.user!.userId);
    }

    res.json({
      success: true,
      data: serializeAgent(agent)
    });
  } catch (error) {
    console.error('❌ Error toggling agent:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle agent' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    agent.status.active = false;
    agent.status.archivedAt = new Date();
    await agent.save();

    if (agent.isPrimary) {
      await agentService.ensureDefaultAgent(req.user!.userId);
    }

    res.json({
      success: true,
      data: { message: 'Agent archived successfully' }
    });
  } catch (error) {
    console.error('❌ Error deleting agent:', error);
    res.status(500).json({ success: false, error: 'Failed to archive agent' });
  }
});

router.post('/ensure-default', authenticateToken, async (req, res) => {
  try {
    const agent = await agentService.ensureDefaultAgent(req.user!.userId);
    res.json({
      success: true,
      data: serializeAgent(agent)
    });
  } catch (error) {
    console.error('❌ Error ensuring default agent:', error);
    res.status(500).json({ success: false, error: 'Failed to create default agent' });
  }
});

export default router;

