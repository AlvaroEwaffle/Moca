import { describe, it, expect } from 'vitest';
import { GlobalAgentRulesService } from '../services/globalAgentRules.service';
import GlobalAgentConfig from '../models/globalAgentConfig.model';
import Conversation from '../models/conversation.model';
import Contact from '../models/contact.model';

describe('GlobalAgentRulesService', () => {
  describe('milestone reset logic', () => {
    it('resets response counter when milestone is achieved and resetCounterOnMilestone is true', async () => {
      // Create a config with resetCounterOnMilestone enabled
      const config = await GlobalAgentConfig.create({
        responseLimits: {
          maxResponsesPerConversation: 10,
          resetCounterOnMilestone: true
        },
        leadScoring: {
          autoDisableOnMilestone: false // disable auto-disable so we can test reset
        },
        systemSettings: {
          enableResponseLimits: true,
          enableLeadScoreAutoDisable: false,
          enableMilestoneAutoDisable: false, // disable milestone auto-disable
          logAllDecisions: false
        },
        metadata: { createdBy: 'test' }
      });

      // Create a contact for the conversation
      const contact = await Contact.create({
        name: 'Test Contact',
        psid: 'psid-test',
        accountId: 'account-test'
      });

      // Create conversation with achieved milestone and counter below limit (so response limit doesn't trigger first)
      const conversation = await Conversation.create({
        contactId: contact._id,
        accountId: 'account-test',
        settings: {
          aiEnabled: false,
          responseCounter: {
            totalResponses: 8, // Below the limit of 10, so response limit won't trigger
            lastResetAt: new Date(),
            disabledByResponseLimit: true, // Was previously disabled, should be re-enabled
            disabledByLeadScore: false,
            disabledByMilestone: false
          }
        },
        milestone: {
          target: 'demo_booked',
          status: 'achieved',
          autoDisableAgent: false
        }
      });

      const result = await GlobalAgentRulesService.shouldDisableAgent(conversation, config);

      // Should NOT disable (autoDisableAgent is false and milestone-based disable is off)
      expect(result.shouldDisable).toBe(false);

      // The conversation response counter should have been reset
      const updated = await Conversation.findById(conversation._id);
      expect(updated!.settings.responseCounter.totalResponses).toBe(0);
      expect(updated!.settings.responseCounter.disabledByResponseLimit).toBe(false);
      expect(updated!.settings.aiEnabled).toBe(true);
    });

    it('does NOT reset counter when resetCounterOnMilestone is false', async () => {
      const config = await GlobalAgentConfig.create({
        responseLimits: {
          maxResponsesPerConversation: 10,
          resetCounterOnMilestone: false
        },
        leadScoring: {
          autoDisableOnMilestone: false
        },
        systemSettings: {
          enableResponseLimits: false,
          enableLeadScoreAutoDisable: false,
          enableMilestoneAutoDisable: false,
          logAllDecisions: false
        },
        metadata: { createdBy: 'test' }
      });

      const contact = await Contact.create({
        name: 'Test Contact 2',
        psid: 'psid-test-2',
        accountId: 'account-test'
      });

      const conversation = await Conversation.create({
        contactId: contact._id,
        accountId: 'account-test',
        settings: {
          aiEnabled: true,
          responseCounter: {
            totalResponses: 8,
            lastResetAt: new Date(),
            disabledByResponseLimit: false,
            disabledByLeadScore: false,
            disabledByMilestone: false
          }
        },
        milestone: {
          target: 'meeting_scheduled',
          status: 'achieved',
          autoDisableAgent: false
        }
      });

      await GlobalAgentRulesService.shouldDisableAgent(conversation, config);

      // Counter should remain unchanged
      const updated = await Conversation.findById(conversation._id);
      expect(updated!.settings.responseCounter.totalResponses).toBe(8);
    });
  });

  describe('response limit with new default', () => {
    it('allows up to 10 responses with new default config', async () => {
      const config = await GlobalAgentConfig.create({
        responseLimits: {
          maxResponsesPerConversation: 10,
          resetCounterOnMilestone: false
        },
        systemSettings: {
          enableResponseLimits: true,
          enableLeadScoreAutoDisable: false,
          enableMilestoneAutoDisable: false,
          logAllDecisions: false
        },
        metadata: { createdBy: 'test' }
      });

      const contact = await Contact.create({
        name: 'Test Contact 3',
        psid: 'psid-test-3',
        accountId: 'account-test'
      });

      // 9 responses should still be allowed
      const conversation = await Conversation.create({
        contactId: contact._id,
        accountId: 'account-test',
        settings: {
          aiEnabled: true,
          responseCounter: {
            totalResponses: 9,
            lastResetAt: new Date(),
            disabledByResponseLimit: false,
            disabledByLeadScore: false,
            disabledByMilestone: false
          }
        }
      });

      const result = await GlobalAgentRulesService.shouldDisableAgent(conversation, config);
      expect(result.shouldDisable).toBe(false);

      // 10 responses should disable
      conversation.settings.responseCounter.totalResponses = 10;
      const result2 = await GlobalAgentRulesService.shouldDisableAgent(conversation, config);
      expect(result2.shouldDisable).toBe(true);
      expect(result2.ruleType).toBe('response_limit');
    });
  });
});
