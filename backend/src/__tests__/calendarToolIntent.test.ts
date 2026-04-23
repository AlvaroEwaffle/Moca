import { describe, expect, it, vi } from 'vitest';
import type { ConversationContext } from '../types/aiResponse';

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
  }),
}));

const { __calendarToolTestHooks } = await import('../services/openai.service');

const baseConversation = (overrides: Partial<ConversationContext> = {}): ConversationContext => ({
  businessName: 'Moca',
  conversationHistory: [],
  lastMessage: '',
  timeSinceLastMessage: 0,
  repetitionPatterns: [],
  leadHistory: [],
  ...overrides,
});

describe('calendar tool intent selection', () => {
  it('forces availability for a new scheduling request', () => {
    const conversation = baseConversation({
      lastMessage: 'Agenda una sesion para manana. Mi email es lead@example.com',
    });

    expect(__calendarToolTestHooks.selectForcedCalendarTool(conversation, {
      contactEmail: 'lead@example.com',
    })).toBe('get_calendar_availability');
  });

  it('forces schedule_meeting when the lead confirms an offered slot and email is known', () => {
    const conversation = baseConversation({
      conversationHistory: [
        {
          role: 'user',
          content: 'Agenda una sesion para manana. Mi email es lead@example.com',
          timestamp: new Date('2026-04-22T15:00:00Z'),
        },
        {
          role: 'assistant',
          content: 'Tengo disponible manana a las 09:00 AM o 09:40 AM.',
          timestamp: new Date('2026-04-22T15:01:00Z'),
        },
      ],
      lastMessage: 'El primer horario me sirve, confirma la reunion.',
    });

    expect(__calendarToolTestHooks.selectForcedCalendarTool(conversation, {
      contactEmail: 'lead@example.com',
    })).toBe('schedule_meeting');
    expect(__calendarToolTestHooks.buildCalendarIntentText(conversation)).toContain('manana');
  });

  it('detects unsafe fake calendar confirmations', () => {
    expect(
      __calendarToolTestHooks.looksLikeMeetingWasConfirmed(
        'La reunion ha sido confirmada. Puedes unirte en https://meet.google.com/abc-defg-hij'
      )
    ).toBe(true);
  });
});
