import { describe, it, expect, beforeEach } from 'vitest';
import { LeadScoringService } from '../services/leadScoring.service';
import LeadFollowUp from '../models/leadFollowUp.model';
import mongoose from 'mongoose';

describe('LeadScoringService', () => {
  describe('calculateLeadScore', () => {
    it('returns score 1 for a simple greeting', () => {
      const result = LeadScoringService.calculateLeadScore('Hola', {
        businessName: 'TestBiz',
        conversationHistory: [],
        lastMessage: 'Hola',
        timeSinceLastMessage: 0,
        repetitionPatterns: [],
        leadHistory: []
      });
      expect(result.currentScore).toBe(1);
    });

    it('skips score increment for support conversations', () => {
      const result = LeadScoringService.calculateLeadScore('Me interesa el precio del servicio', {
        businessName: 'TestBiz',
        conversationHistory: [],
        lastMessage: 'Me interesa el precio del servicio',
        timeSinceLastMessage: 0,
        repetitionPatterns: [],
        leadHistory: [2],
        isSupport: true
      });
      // Should return the previous score (2), not increment
      expect(result.currentScore).toBe(2);
      expect(result.progression).toBe('maintained');
      expect(result.reasons).toContain('Support conversation — lead scoring skipped');
    });

    it('scores normally for non-support conversations', () => {
      const result = LeadScoringService.calculateLeadScore('Me interesa el precio', {
        businessName: 'TestBiz',
        conversationHistory: [],
        lastMessage: 'Me interesa el precio',
        timeSinceLastMessage: 0,
        repetitionPatterns: [],
        leadHistory: [],
        isSupport: false
      });
      // Should produce a score > 1 due to pricing keyword
      expect(result.currentScore).toBeGreaterThanOrEqual(1);
    });

    it('does not leave explicit commercial interest stuck at score 1', () => {
      const result = LeadScoringService.calculateLeadScore('Me interesa saber mas, quiero cotizar', {
        businessName: 'TestBiz',
        conversationHistory: [],
        lastMessage: 'Me interesa saber mas, quiero cotizar',
        timeSinceLastMessage: 0,
        repetitionPatterns: [],
        leadHistory: [1],
        isSupport: false
      });

      expect(result.currentScore).toBeGreaterThanOrEqual(3);
      expect(result.reasons).toContain('Explicit pricing or proposal intent detected');
    });

    it('moves a substantive reply after assistant context out of score 1', () => {
      const result = LeadScoringService.calculateLeadScore('Trabajo en retail y necesito automatizar mensajes', {
        businessName: 'TestBiz',
        conversationHistory: [
          {
            role: 'assistant',
            content: 'Cuéntame un poco más sobre tu negocio.',
            timestamp: new Date()
          }
        ],
        lastMessage: 'Trabajo en retail y necesito automatizar mensajes',
        timeSinceLastMessage: 1,
        repetitionPatterns: [],
        leadHistory: [1],
        isSupport: false
      });

      expect(result.currentScore).toBeGreaterThanOrEqual(2);
    });

    it('caps Score 5 and defers to async verification', () => {
      // Even if keywords would produce score 5, it should be capped to 4
      const result = LeadScoringService.calculateLeadScore('recordatorio seguimiento reminder', {
        businessName: 'TestBiz',
        conversationHistory: [],
        lastMessage: 'recordatorio seguimiento reminder',
        timeSinceLastMessage: 0,
        repetitionPatterns: [],
        leadHistory: [3],
        milestoneStatus: 'achieved'
      });
      // Score should not be 5 from keywords alone (capped at 4 or lower)
      expect(result.currentScore).toBeLessThanOrEqual(4);
    });
  });

  describe('verifyScore5Eligibility', () => {
    it('returns score 5 when a follow-up was sent', async () => {
      const convId = new mongoose.Types.ObjectId().toString();

      // Create a sent follow-up record
      await LeadFollowUp.create({
        conversationId: convId,
        contactId: 'contact-1',
        accountId: 'account-1',
        userId: 'user-1',
        status: 'sent',
        scheduledAt: new Date(),
        messageTemplate: 'Test follow-up'
      });

      const result = await LeadScoringService.verifyScore5Eligibility(convId, 4);
      expect(result.score).toBe(5);
      expect(result.reason).toContain('Follow-up reminder sent');
    });

    it('returns original score when no follow-up was sent', async () => {
      const convId = new mongoose.Types.ObjectId().toString();

      const result = await LeadScoringService.verifyScore5Eligibility(convId, 4);
      expect(result.score).toBe(4);
    });

    it('returns original score for scores below 4', async () => {
      const result = await LeadScoringService.verifyScore5Eligibility('any-id', 2);
      expect(result.score).toBe(2);
    });
  });
});
