import Agent, { IAgent } from '../models/agent.model';
import { Integration, User } from '../models';
import { IntegrationType } from '../models/integration.model';

class AgentService {
  public async listByUser(userId: string) {
    return Agent.find({ userId, 'status.archivedAt': { $exists: false } }).sort({
      isPrimary: -1,
      createdAt: 1
    });
  }

  public async getAgentById(agentId: string, userId: string) {
    return Agent.findOne({ _id: agentId, userId });
  }

  public async ensureDefaultAgent(userId: string): Promise<IAgent> {
    let agent = await Agent.findOne({ userId, isPrimary: true, 'status.active': true });
    if (agent) return agent;

    const fallback = await Agent.findOne({ userId, 'status.active': true });
    if (fallback) {
      fallback.isPrimary = true;
      await fallback.save();
      return fallback;
    }

    return this.createFromUserSettings(userId);
  }

  public async resolveAgentForChannel(
    userId: string,
    channel: IntegrationType | 'gmail'
  ): Promise<IAgent | null> {
    const channelMatch = await Agent.findOne({
      userId,
      'status.active': true,
      [`metadata.channelAssignments.${channel}`]: true
    })
      .sort({ isPrimary: -1 })
      .exec();

    if (channelMatch) return channelMatch;
    return this.ensureDefaultAgent(userId);
  }

  public async createFromUserSettings(userId: string): Promise<IAgent> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found while creating default agent`);
    }

    const integrations = await Integration.find({ userId, status: 'connected' });
    const enabledTools = integrations.map((integration) => integration.type);

    const agent = new Agent({
      userId,
      tenantId: (user as any).tenantId,
      name: `${user.name || 'Primary'} Agent`,
      description: 'Auto-generated agent from onboarding settings',
      systemPrompt:
        user.agentSettings?.systemPrompt ||
        'You are a helpful assistant for this business. Reply with empathy and clarity.',
      enabledTools,
      isPrimary: true,
      metadata: {
        channelAssignments: {
          instagram: true,
          whatsapp: enabledTools.includes('whatsapp'),
          gmail: enabledTools.includes('gmail'),
          google_calendar: enabledTools.includes('google_calendar')
        }
      }
    });

    await agent.save();
    return agent;
  }
}

export default new AgentService();

