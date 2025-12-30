// @ts-nocheck
import GmailFetchRule, { IGmailFetchRule } from '../models/gmailFetchRule.model';
import { processEmails } from './gmailProcessor.service';
import { fetchEmails } from './gmail.service';

export interface CreateFetchRuleInput {
  userId: string;
  agentId?: string;
  name: string;
  dateRange: {
    type: '1d' | '7d' | '30d' | '90d' | 'custom';
    days?: number;
    customStartDate?: Date;
    customEndDate?: Date;
  };
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  includeSpam?: boolean;
  enabled?: boolean;
  scheduleInterval?: number; // Minutes
  scheduleTime?: {
    hour: number; // 0-23
    minute: number; // 0-59
    timezone?: string; // Optional timezone
  };
  systemPrompt?: string; // Custom system prompt for AI processing
  draftSettings?: {
    enabled?: boolean;
    onlyIfUserNoResponse?: boolean;
    userNoResponseDays?: number;
    onlyIfOtherNoResponse?: boolean;
    otherNoResponseDays?: number;
  };
  tags?: string[];
}

export interface UpdateFetchRuleInput extends Partial<CreateFetchRuleInput> {
  status?: 'active' | 'paused' | 'archived';
}

/**
 * Create a new Gmail fetch rule
 */
export const createFetchRule = async (input: CreateFetchRuleInput): Promise<IGmailFetchRule> => {
  try {
    const rule = new GmailFetchRule({
      userId: input.userId,
      agentId: input.agentId,
      name: input.name,
      dateRange: input.dateRange,
      maxResults: input.maxResults || 50,
      query: input.query || '',
      labelIds: input.labelIds || ['INBOX'],
      includeSpam: input.includeSpam || false,
      systemPrompt: input.systemPrompt || undefined,
      draftSettings: input.draftSettings || {
        enabled: true,
        onlyIfUserNoResponse: false,
        userNoResponseDays: undefined,
        onlyIfOtherNoResponse: false,
        otherNoResponseDays: undefined
      },
      enabled: input.enabled !== undefined ? input.enabled : true,
      scheduleInterval: input.scheduleInterval,
      scheduleTime: input.scheduleTime,
      metadata: {
        totalRuns: 0,
        totalEmailsFetched: 0,
        tags: input.tags || []
      }
    });

    // Calculate next run time if enabled and has schedule (either interval or time)
    if (rule.enabled && (rule.scheduleInterval || rule.scheduleTime)) {
      rule.nextRunAt = rule.calculateNextRun();
    }

    await rule.save();
    console.log(`✅ [Gmail Fetch Rule] Created rule: ${rule.name} (${rule.id})`);
    return rule;
  } catch (error: any) {
    console.error(`❌ [Gmail Fetch Rule] Error creating rule:`, error.message);
    throw error;
  }
};

/**
 * Update an existing fetch rule
 */
export const updateFetchRule = async (
  ruleId: string,
  userId: string,
  updates: UpdateFetchRuleInput
): Promise<IGmailFetchRule | null> => {
  try {
    const rule = await GmailFetchRule.findOne({ _id: ruleId, userId });
    if (!rule) {
      return null;
    }

    // Update fields
    if (updates.name !== undefined) rule.name = updates.name;
    if (updates.status !== undefined) rule.status = updates.status;
    if (updates.agentId !== undefined) rule.agentId = updates.agentId;
    if (updates.dateRange !== undefined) rule.dateRange = updates.dateRange;
    if (updates.maxResults !== undefined) rule.maxResults = updates.maxResults;
    if (updates.query !== undefined) rule.query = updates.query;
    if (updates.labelIds !== undefined) rule.labelIds = updates.labelIds;
    if (updates.includeSpam !== undefined) rule.includeSpam = updates.includeSpam;
    if (updates.systemPrompt !== undefined) rule.systemPrompt = updates.systemPrompt;
    if (updates.draftSettings !== undefined) rule.draftSettings = updates.draftSettings;
    if (updates.enabled !== undefined) rule.enabled = updates.enabled;
    if (updates.scheduleInterval !== undefined) rule.scheduleInterval = updates.scheduleInterval;
    if (updates.scheduleTime !== undefined) rule.scheduleTime = updates.scheduleTime;
    if (updates.tags !== undefined) rule.metadata.tags = updates.tags;

    // Recalculate next run time if schedule changed
    if (updates.scheduleInterval !== undefined || updates.scheduleTime !== undefined || updates.enabled !== undefined) {
      if (rule.enabled && (rule.scheduleInterval || rule.scheduleTime)) {
        rule.nextRunAt = rule.calculateNextRun();
      } else {
        rule.nextRunAt = undefined;
      }
    }

    await rule.save();
    console.log(`✅ [Gmail Fetch Rule] Updated rule: ${rule.name} (${rule.id})`);
    return rule;
  } catch (error: any) {
    console.error(`❌ [Gmail Fetch Rule] Error updating rule:`, error.message);
    throw error;
  }
};

/**
 * Delete a fetch rule
 */
export const deleteFetchRule = async (ruleId: string, userId: string): Promise<boolean> => {
  try {
    const result = await GmailFetchRule.findOneAndDelete({ _id: ruleId, userId });
    return !!result;
  } catch (error: any) {
    console.error(`❌ [Gmail Fetch Rule] Error deleting rule:`, error.message);
    throw error;
  }
};

/**
 * Get all fetch rules for a user
 */
export const getUserFetchRules = async (
  userId: string,
  filters?: { agentId?: string; status?: string; enabled?: boolean }
): Promise<IGmailFetchRule[]> => {
  try {
    const query: any = { userId };
    
    if (filters?.agentId) {
      query.agentId = filters.agentId;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.enabled !== undefined) {
      query.enabled = filters.enabled;
    }

    const rules = await GmailFetchRule.find(query).sort({ createdAt: -1 });
    return rules;
  } catch (error: any) {
    console.error(`❌ [Gmail Fetch Rule] Error fetching rules:`, error.message);
    throw error;
  }
};

/**
 * Get a single fetch rule by ID
 */
export const getFetchRule = async (ruleId: string, userId: string): Promise<IGmailFetchRule | null> => {
  try {
    const rule = await GmailFetchRule.findOne({ _id: ruleId, userId });
    return rule;
  } catch (error: any) {
    console.error(`❌ [Gmail Fetch Rule] Error fetching rule:`, error.message);
    throw error;
  }
};

/**
 * Execute a fetch rule (run the email fetch and processing)
 */
export const executeFetchRule = async (ruleId: string, userId: string): Promise<{
  success: boolean;
  emailsFetched: number;
  contacts: number;
  conversations: number;
  messages: number;
  error?: string;
}> => {
  try {
    // Ensure userId is a valid ObjectId string
    // If it contains object data, extract just the ID
    let cleanUserId = userId;
    
    if (userId.includes('_id') || userId.includes('ObjectId') || userId.includes('email') || userId.includes('displayName')) {
      // Extract the ObjectId from stringified object
      const idMatch = userId.match(/([0-9a-fA-F]{24})/);
      if (idMatch && idMatch[1]) {
        cleanUserId = idMatch[1];
        console.log(`🔧 [Gmail Fetch Rule] Cleaned userId: extracted ${cleanUserId} from stringified object`);
      }
    }
    
    // Validate it's a valid ObjectId format
    if (!cleanUserId || cleanUserId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(cleanUserId)) {
      throw new Error(`Invalid userId format: ${cleanUserId.substring(0, 100)}`);
    }
    
    const rule = await GmailFetchRule.findOne({ _id: ruleId, userId: cleanUserId });
    if (!rule) {
      throw new Error('Fetch rule not found');
    }

    if (!rule.enabled || rule.status !== 'active') {
      throw new Error('Fetch rule is not active');
    }

    console.log(`🔄 [Gmail Fetch Rule] Executing rule: ${rule.name} (${rule.id})`);

    // Build query from rule
    const query = rule.buildQuery();

    // Execute fetch and process
    const result = await processEmails({
      userId: userId,
      agentId: rule.agentId?.toString(),
      maxResults: rule.maxResults,
      query,
      labelIds: rule.labelIds,
      includeSpam: rule.includeSpam,
      draftSettings: rule.draftSettings
    });

    // Update rule metadata
    rule.metadata.totalRuns += 1;
    rule.metadata.totalEmailsFetched += result.processed;
    rule.lastRunAt = new Date();
    rule.metadata.lastError = undefined;
    rule.metadata.lastErrorAt = undefined;

    // Calculate next run if scheduled (either interval or time)
    if (rule.scheduleInterval || rule.scheduleTime) {
      rule.nextRunAt = rule.calculateNextRun();
    }

    await rule.save();

    console.log(`✅ [Gmail Fetch Rule] Rule executed successfully: ${rule.name}`);
    console.log(`   - Emails processed: ${result.processed}`);
    console.log(`   - Contacts created: ${result.contacts}`);
    console.log(`   - Conversations: ${result.conversations}`);
    console.log(`   - Messages: ${result.messages}`);

    return {
      success: true,
      emailsFetched: result.processed,
      contacts: result.contacts,
      conversations: result.conversations,
      messages: result.messages
    };
  } catch (error: any) {
    console.error(`❌ [Gmail Fetch Rule] Error executing rule:`, error.message);

    // Update rule with error
    try {
      const rule = await GmailFetchRule.findById(ruleId);
      if (rule) {
        rule.metadata.lastError = error.message;
        rule.metadata.lastErrorAt = new Date();
        await rule.save();
      }
    } catch (updateError) {
      console.error(`❌ [Gmail Fetch Rule] Failed to update error metadata:`, updateError);
    }

    return {
      success: false,
      emailsFetched: 0,
      contacts: 0,
      conversations: 0,
      messages: 0,
      error: error.message
    };
  }
};

/**
 * Get rules that are due to run (for scheduled execution)
 */
export const getRulesDueToRun = async (): Promise<IGmailFetchRule[]> => {
  try {
    const now = new Date();
    // IMPORTANT: Don't populate userId - we need the raw ObjectId, not the user object
    const rules = await GmailFetchRule.find({
      enabled: true,
      status: 'active',
      $or: [
        { nextRunAt: { $lte: now } },
        { nextRunAt: { $exists: false } },
        { lastRunAt: { $exists: false } }
      ]
    })
      .select('userId') // Explicitly select userId (not populated)
      .populate('agentId', 'name') // Only populate agentId, NOT userId

    return rules;
  } catch (error: any) {
    console.error(`❌ [Gmail Fetch Rule] Error fetching rules due to run:`, error.message);
    throw error;
  }
};

