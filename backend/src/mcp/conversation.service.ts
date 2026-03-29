/**
 * MCP Conversation Service
 *
 * Direct MongoDB query wrappers for Moca conversations
 * Used by MCP server to read/write conversation data
 */

import Conversation from '../models/conversation.model';

export interface GetConversationsOptions {
  limit?: number;
  offset?: number;
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
}

/**
 * Get list of conversations for an account
 */
export async function getConversations(
  accountId: string,
  options: GetConversationsOptions = {}
) {
  const { limit = 20, offset = 0, filter = {}, sort = { 'timestamps.lastActivity': -1 } } = options;

  try {
    const conversations = await Conversation.find({
      accountId,
      archived: false,
      ...filter,
    })
      .sort(sort)
      .limit(limit)
      .skip(offset)
      .lean()
      .exec();

    return conversations;
  } catch (error: any) {
    console.error(`❌ [MCP] getConversations failed:`, error.message);
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }
}

/**
 * Get a single conversation by ID
 */
export async function getConversationById(
  accountId: string,
  conversationId: string
) {
  try {
    const conversation = await Conversation.findOne({
      _id: conversationId,
      accountId,
    }).exec();

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    return conversation;
  } catch (error: any) {
    console.error(`❌ [MCP] getConversationById failed:`, error.message);
    throw error;
  }
}

/**
 * Update lead score for a conversation
 */
export async function updateLeadScore(
  accountId: string,
  conversationId: string,
  score: number,
  reason: string = ''
) {
  try {
    if (score < 1 || score > 7) {
      throw new Error('Score must be between 1 and 7');
    }

    // Define the 7-step scale
    const steps = [
      { stepNumber: 1, stepName: 'Contact Received', stepDescription: 'Initial contact from customer' },
      { stepNumber: 2, stepName: 'Engagement Started', stepDescription: 'Customer showed initial interest' },
      { stepNumber: 3, stepName: 'Exploring Needs', stepDescription: 'Understanding customer requirements' },
      { stepNumber: 4, stepName: 'Solution Presented', stepDescription: 'Presented relevant solution' },
      { stepNumber: 5, stepName: 'Reminder Sent', stepDescription: 'Sent follow-up reminder' },
      { stepNumber: 6, stepName: 'Decision Ready', stepDescription: 'Customer ready to decide' },
      { stepNumber: 7, stepName: 'Ready for Handoff', stepDescription: 'Hand off to sales' },
    ];

    const currentStep = steps[score - 1] || steps[0];

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        accountId,
      },
      {
        $set: {
          'leadScoring.currentScore': score,
          'leadScoring.currentStep': {
            stepNumber: currentStep.stepNumber,
            stepName: currentStep.stepName,
            stepDescription: currentStep.stepDescription,
          },
        },
        $push: {
          'leadScoring.scoreHistory': {
            score,
            timestamp: new Date(),
            reason,
            stepName: currentStep.stepName,
          },
        },
      },
      { new: true }
    ).exec();

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    return conversation;
  } catch (error: any) {
    console.error(`❌ [MCP] updateLeadScore failed:`, error.message);
    throw error;
  }
}

/**
 * Archive or unarchive a conversation
 */
export async function archiveConversation(
  accountId: string,
  conversationId: string,
  archived: boolean = true
) {
  try {
    // Map archived boolean to conversation status
    const newStatus = archived ? 'archived' : 'open';

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        accountId,
      },
      {
        $set: {
          status: newStatus,
          'timestamps.lastActivity': new Date(),
        },
      },
      { new: true }
    ).exec();

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    return conversation;
  } catch (error: any) {
    console.error(`❌ [MCP] archiveConversation failed:`, error.message);
    throw error;
  }
}

/**
 * Get conversation count for an account
 */
export async function getConversationCount(accountId: string) {
  try {
    const count = await Conversation.countDocuments({
      accountId,
      archived: false,
    }).exec();

    return count;
  } catch (error: any) {
    console.error(`❌ [MCP] getConversationCount failed:`, error.message);
    throw error;
  }
}
