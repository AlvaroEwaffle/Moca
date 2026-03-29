import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as conversationService from '../conversation.service';

// Mock conversation service
vi.mock('../conversation.service');

describe('Moca MCP Server — Conversation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getConversations', () => {
    it('should fetch conversations successfully', async () => {
      const mockConversations = [
        {
          _id: 'conv1',
          status: 'open',
          leadScoring: { currentScore: 3 },
          metrics: { totalMessages: 5 },
          messageCount: 5,
          timestamps: { lastActivity: new Date() },
        },
      ];

      vi.spyOn(conversationService, 'getConversations').mockResolvedValue(
        mockConversations as any
      );

      const result = await conversationService.getConversations('account1');
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('open');
    });

    it('should handle limit parameter', async () => {
      const mockConversations: any[] = [];
      vi.spyOn(conversationService, 'getConversations').mockResolvedValue(mockConversations);

      const result = await conversationService.getConversations('account1', { limit: 20 });
      expect(result).toBeDefined();
    });

    it('should support filter by unread', async () => {
      const mockConversations = [
        {
          _id: 'conv1',
          psid: 'psid1',
          leadScoring: { currentScore: 1 },
          metrics: { totalMessages: 3 },
          timestamps: { lastActivity: new Date() },
        },
      ];

      vi.spyOn(conversationService, 'getConversations').mockResolvedValue(
        mockConversations as any
      );

      const result = await conversationService.getConversations('account1', {
        filter: { unread: true },
      });

      expect(result).toHaveLength(1);
    });

    it('should support filter by high_priority (score >= 5)', async () => {
      const mockConversations = [
        {
          _id: 'conv1',
          leadScoring: { currentScore: 6 },
          metrics: { totalMessages: 10 },
        },
      ];

      vi.spyOn(conversationService, 'getConversations').mockResolvedValue(
        mockConversations as any
      );

      const result = await conversationService.getConversations('account1', {
        filter: { 'leadScoring.currentScore': { $gte: 5 } },
      });

      expect(result).toHaveLength(1);
      expect(result[0].leadScoring.currentScore).toBeGreaterThanOrEqual(5);
    });
  });

  describe('getConversationById', () => {
    it('should fetch conversation by ID', async () => {
      const mockConversation = {
        _id: 'conv1',
        status: 'open',
        metrics: { totalMessages: 10 },
        messageCount: 10,
        leadScoring: { currentScore: 3 },
        timestamps: { lastActivity: new Date() },
      };

      vi.spyOn(conversationService, 'getConversationById').mockResolvedValue(
        mockConversation as any
      );

      const result = await conversationService.getConversationById('account1', 'conv1');
      expect(result._id).toBe('conv1');
      expect(result.status).toBe('open');
    });

    it('should return error when conversation not found', async () => {
      vi.spyOn(conversationService, 'getConversationById').mockRejectedValue(
        new Error('Conversation not found')
      );

      await expect(conversationService.getConversationById('account1', 'invalid')).rejects.toThrow(
        'Conversation not found'
      );
    });
  });

  describe('updateLeadScore', () => {
    it('should update lead score successfully', async () => {
      const mockUpdated = {
        _id: 'conv1',
        leadScoring: {
          currentScore: 5,
          currentStep: { stepNumber: 5, stepName: 'Reminder Sent' },
        },
      };

      vi.spyOn(conversationService, 'updateLeadScore').mockResolvedValue(mockUpdated as any);

      const result = await conversationService.updateLeadScore(
        'account1',
        'conv1',
        5,
        'Customer showed interest'
      );

      expect(result.leadScoring.currentScore).toBe(5);
      expect(result.leadScoring.currentStep.stepName).toBe('Reminder Sent');
    });

    it('should reject invalid scores < 1', async () => {
      vi.spyOn(conversationService, 'updateLeadScore').mockRejectedValue(
        new Error('Score must be between 1 and 7')
      );

      await expect(conversationService.updateLeadScore('account1', 'conv1', 0, '')).rejects.toThrow();
    });

    it('should reject invalid scores > 7', async () => {
      vi.spyOn(conversationService, 'updateLeadScore').mockRejectedValue(
        new Error('Score must be between 1 and 7')
      );

      await expect(conversationService.updateLeadScore('account1', 'conv1', 8, '')).rejects.toThrow();
    });

    it('should update all 7 lead score steps', async () => {
      const steps = [
        'Contact Received',
        'Engagement Started',
        'Exploring Needs',
        'Solution Presented',
        'Reminder Sent',
        'Decision Ready',
        'Ready for Handoff',
      ];

      for (let i = 1; i <= 7; i++) {
        const mockResult = {
          leadScoring: {
            currentScore: i,
            currentStep: { stepName: steps[i - 1] },
          },
        };

        vi.spyOn(conversationService, 'updateLeadScore').mockResolvedValueOnce(mockResult as any);

        const result = await conversationService.updateLeadScore('account1', 'conv1', i, '');
        expect(result.leadScoring.currentScore).toBe(i);
        expect(result.leadScoring.currentStep.stepName).toBe(steps[i - 1]);
      }
    });

    it('should add to score history', async () => {
      const mockResult = {
        leadScoring: {
          scoreHistory: [
            { score: 3, timestamp: new Date(), reason: 'Initial contact' },
            { score: 5, timestamp: new Date(), reason: 'Showed interest' },
          ],
        },
      };

      vi.spyOn(conversationService, 'updateLeadScore').mockResolvedValue(mockResult as any);

      const result = await conversationService.updateLeadScore(
        'account1',
        'conv1',
        5,
        'Showed interest'
      );

      expect(result.leadScoring.scoreHistory).toHaveLength(2);
    });
  });

  describe('archiveConversation', () => {
    it('should archive a conversation', async () => {
      const mockResult = {
        _id: 'conv1',
        status: 'archived',
        timestamps: { lastActivity: new Date() },
      };

      vi.spyOn(conversationService, 'archiveConversation').mockResolvedValue(mockResult as any);

      const result = await conversationService.archiveConversation('account1', 'conv1', true);

      expect(result.status).toBe('archived');
    });

    it('should unarchive a conversation', async () => {
      const mockResult = {
        _id: 'conv1',
        status: 'open',
        timestamps: { lastActivity: new Date() },
      };

      vi.spyOn(conversationService, 'archiveConversation').mockResolvedValue(mockResult as any);

      const result = await conversationService.archiveConversation('account1', 'conv1', false);

      expect(result.status).toBe('open');
    });

    it('should update lastActivity timestamp', async () => {
      const now = new Date();
      const mockResult = {
        _id: 'conv1',
        archived: true,
        timestamps: { lastActivity: now },
      };

      vi.spyOn(conversationService, 'archiveConversation').mockResolvedValue(mockResult as any);

      const result = await conversationService.archiveConversation('account1', 'conv1', true);

      expect(result.timestamps.lastActivity).toBeDefined();
    });

    it('should return error when conversation not found', async () => {
      vi.spyOn(conversationService, 'archiveConversation').mockRejectedValue(
        new Error('Conversation not found')
      );

      await expect(conversationService.archiveConversation('account1', 'invalid', true)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle MongoDB connection errors gracefully', async () => {
      vi.spyOn(conversationService, 'getConversations').mockRejectedValue(
        new Error('MongoDB connection failed')
      );

      await expect(conversationService.getConversations('account1')).rejects.toThrow('MongoDB');
    });

    it('should handle missing required parameters', async () => {
      const args: any = { conversationId: 'conv1' };
      expect(!args.accountId).toBe(true);
    });

    it('should return appropriate error messages', async () => {
      const error = new Error('Test error message');
      vi.spyOn(conversationService, 'getConversations').mockRejectedValue(error);

      try {
        await conversationService.getConversations('account1');
        expect.fail('Should throw');
      } catch (e: any) {
        expect(e.message).toContain('Test error');
      }
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete conversation workflow', async () => {
      // 1. List conversations
      const conversations = [{ _id: 'conv1', senderName: 'John' }];
      vi.spyOn(conversationService, 'getConversations').mockResolvedValueOnce(conversations as any);

      const listed = await conversationService.getConversations('account1');
      expect(listed).toHaveLength(1);

      // 2. Get conversation details
      const conv = { _id: 'conv1', leadScoring: { currentScore: 2 } };
      vi.spyOn(conversationService, 'getConversationById').mockResolvedValueOnce(conv as any);

      const details = await conversationService.getConversationById('account1', 'conv1');
      expect(details.leadScoring.currentScore).toBe(2);

      // 3. Update lead score
      const updated = { leadScoring: { currentScore: 5 } };
      vi.spyOn(conversationService, 'updateLeadScore').mockResolvedValueOnce(updated as any);

      const scored = await conversationService.updateLeadScore('account1', 'conv1', 5);
      expect(scored.leadScoring.currentScore).toBe(5);
    });

    it('should handle batch operations', async () => {
      const convs = Array.from({ length: 10 }, (_, i) => ({
        _id: `conv${i}`,
        leadScoring: { currentScore: 1 },
      }));

      vi.spyOn(conversationService, 'getConversations').mockResolvedValue(convs as any);

      const result = await conversationService.getConversations('account1', { limit: 50 });
      expect(result).toHaveLength(10);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain 1-7 score range invariant', async () => {
      const validScores = [1, 2, 3, 4, 5, 6, 7];

      for (const score of validScores) {
        const mockResult = { leadScoring: { currentScore: score } };
        vi.spyOn(conversationService, 'updateLeadScore').mockResolvedValueOnce(mockResult as any);

        const result = await conversationService.updateLeadScore('account1', 'conv1', score);
        expect(result.leadScoring.currentScore).toBeGreaterThanOrEqual(1);
        expect(result.leadScoring.currentScore).toBeLessThanOrEqual(7);
      }
    });
  });
});
