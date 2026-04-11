import { describe, it, expect } from 'vitest';
import { LeadScoringService } from '../services/leadScoring.service';
import { ConversationContext } from '../types/aiResponse';

describe('Support Filter (R1.4)', () => {
  const baseContext: ConversationContext = {
    businessName: 'TestBiz',
    conversationHistory: [],
    lastMessage: '',
    timeSinceLastMessage: 0,
    repetitionPatterns: [],
    leadHistory: [2]
  };

  const supportKeywords = [
    'tengo un problema con el producto',
    'esto no funciona bien',
    'necesito ayuda urgente',
    'quiero soporte tecnico',
    'tengo un reclamo',
    'hay un error en mi cuenta',
    'la app tiene una falla'
  ];

  it.each(supportKeywords)('skips scoring for support message: "%s"', (message) => {
    const result = LeadScoringService.calculateLeadScore(message, {
      ...baseContext,
      lastMessage: message,
      isSupport: true
    });
    expect(result.progression).toBe('maintained');
    expect(result.reasons).toContain('Support conversation — lead scoring skipped');
  });

  it('scores normally when isSupport is false even with support-like keywords', () => {
    const result = LeadScoringService.calculateLeadScore('tengo un problema', {
      ...baseContext,
      lastMessage: 'tengo un problema',
      isSupport: false
    });
    // Should still score normally (not skip)
    expect(result.reasons).not.toContain('Support conversation — lead scoring skipped');
  });

  it('scores normally when isSupport is undefined', () => {
    const result = LeadScoringService.calculateLeadScore('quiero precio', {
      ...baseContext,
      lastMessage: 'quiero precio',
      isSupport: undefined
    });
    expect(result.reasons).not.toContain('Support conversation — lead scoring skipped');
  });
});
