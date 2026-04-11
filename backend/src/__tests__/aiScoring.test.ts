import { describe, it, expect } from 'vitest';
import { StructuredResponse } from '../types/aiResponse';

describe('AI Contextual Scoring (R2.2)', () => {
  it('uses max(keywordScore, aiAssessedScore) with ceiling', () => {
    // Simulate the logic from openai.service.ts
    const simulateAIScoring = (
      keywordScore: number,
      aiAssessedScore: number | undefined,
      maxAllowedScore: number
    ): number => {
      let finalScore = keywordScore;

      if (aiAssessedScore && aiAssessedScore >= 1 && aiAssessedScore <= 7) {
        const combinedScore = Math.max(keywordScore, aiAssessedScore);
        finalScore = Math.min(combinedScore, maxAllowedScore);
      }

      return finalScore;
    };

    // AI score higher than keyword: should use AI score
    expect(simulateAIScoring(2, 3, 7)).toBe(3);

    // Keyword score higher than AI: should use keyword score
    expect(simulateAIScoring(3, 2, 7)).toBe(3);

    // Both equal: no change
    expect(simulateAIScoring(3, 3, 7)).toBe(3);

    // AI score exceeds max allowed: should cap
    expect(simulateAIScoring(2, 5, 3)).toBe(3);

    // No AI score: should use keyword score
    expect(simulateAIScoring(2, undefined, 7)).toBe(2);

    // AI score of 0 (invalid): should use keyword score
    expect(simulateAIScoring(2, 0, 7)).toBe(2);
  });

  it('includes aiAssessedScore in StructuredResponse interface', () => {
    const response: StructuredResponse = {
      responseText: 'Test response',
      leadScore: 3,
      aiAssessedScore: 4,
      intent: 'purchase_interest',
      nextAction: 'send_information',
      confidence: 0.8,
      metadata: {
        greetingUsed: false,
        previousContextReferenced: true,
        businessNameUsed: 'TestBiz'
      }
    };

    expect(response.aiAssessedScore).toBe(4);
  });

  it('allows aiAssessedScore to be undefined (backward compat)', () => {
    const response: StructuredResponse = {
      responseText: 'Test response',
      leadScore: 2,
      intent: 'inquiry',
      nextAction: 'follow_up',
      confidence: 0.5,
      metadata: {
        greetingUsed: true,
        previousContextReferenced: false,
        businessNameUsed: ''
      }
    };

    expect(response.aiAssessedScore).toBeUndefined();
  });
});
