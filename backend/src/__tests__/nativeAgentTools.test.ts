import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calendarFindOne: vi.fn(),
  getAvailability: vi.fn(),
  createMeetingEvent: vi.fn(),
}));

vi.mock('../models/calendarIntegration.model', () => ({
  default: {
    findOne: mocks.calendarFindOne,
  },
}));

vi.mock('../services/googleCalendar.service', () => ({
  getAvailability: mocks.getAvailability,
  createMeetingEvent: mocks.createMeetingEvent,
}));

const { extractCalendarDateIntent, loadCalendarToolsForAccount } = await import(
  '../services/nativeAgentTools.service'
);

const connectedIntegration = {
  status: 'connected',
  enabled: true,
  timezone: 'America/Santiago',
  calendarId: 'primary',
  meetingDurationMinutes: 30,
  bufferMinutes: 15,
  ccEmails: ['owner@example.com'],
};

describe('nativeAgentTools calendar date handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.calendarFindOne.mockResolvedValue(connectedIntegration);
    mocks.getAvailability.mockResolvedValue({
      slots: [],
      timezone: 'America/Santiago',
      calendarId: 'primary',
      durationMin: 30,
    });
  });

  it('resolves "mañana" to the next local calendar day', () => {
    const intent = extractCalendarDateIntent(
      'Agenda una sesión para mañana',
      'America/Santiago',
      new Date('2026-04-22T15:05:00-04:00')
    );

    expect(intent).toMatchObject({
      date: '2026-04-23',
      source: 'manana',
      fromIso: '2026-04-23T04:00:00.000Z',
      toIso: '2026-04-24T04:00:00.000Z',
    });
  });

  it('overrides an incorrect model range with the user-requested relative date', async () => {
    const bundle = await loadCalendarToolsForAccount({
      accountId: '17841467023627361',
      currentUserMessage: 'Agenda una sesión para mañana',
      now: new Date('2026-04-22T15:05:00-04:00'),
    });

    await bundle!.execute('get_calendar_availability', {
      fromIso: '2026-04-26T04:00:00.000Z',
      toIso: '2026-04-27T04:00:00.000Z',
      durationMin: 30,
    });

    expect(mocks.getAvailability).toHaveBeenCalledWith('17841467023627361', {
      from: '2026-04-23T04:00:00.000Z',
      to: '2026-04-24T04:00:00.000Z',
      durationMin: 30,
    });
  });

  it('rejects scheduling on a different local date than the one requested by the lead', async () => {
    const bundle = await loadCalendarToolsForAccount({
      accountId: '17841467023627361',
      currentUserMessage: 'Agenda una sesión para mañana',
      now: new Date('2026-04-22T15:05:00-04:00'),
    });

    await expect(
      bundle!.execute('schedule_meeting', {
        attendeeName: 'Alvaro',
        attendeeEmail: 'alvaro@example.com',
        startIso: '2026-04-26T14:00:00.000Z',
      })
    ).rejects.toThrow(/Lead requested manana \(2026-04-23\)/);

    expect(mocks.createMeetingEvent).not.toHaveBeenCalled();
  });

  it('blocks calendar usage when a required lead business name is missing', async () => {
    const bundle = await loadCalendarToolsForAccount({
      accountId: '17841467023627361',
      currentUserMessage: 'Agenda una sesión para mañana',
      contactEmail: 'alvaro@example.com',
      requireLeadBusinessNameBeforeScheduling: true,
      requireLeadEmailBeforeScheduling: true,
      now: new Date('2026-04-22T15:05:00-04:00'),
    });

    await expect(
      bundle!.execute('get_calendar_availability', {
        fromIso: '2026-04-23T04:00:00.000Z',
        toIso: '2026-04-24T04:00:00.000Z',
      })
    ).rejects.toThrow(/Lead qualification incomplete/);

    expect(mocks.getAvailability).not.toHaveBeenCalled();
  });

  it('builds event title and description from business and conversation context', async () => {
    mocks.createMeetingEvent.mockResolvedValue({
      success: true,
      eventId: 'event-1',
      meetLink: 'https://meet.google.com/test',
      start: '2026-04-23T13:00:00.000Z',
      end: '2026-04-23T13:30:00.000Z',
    });

    const bundle = await loadCalendarToolsForAccount({
      accountId: '17841467023627361',
      currentUserMessage: 'Agenda una sesión para mañana\nEl primer horario me sirve',
      contactName: 'Alvaro',
      contactEmail: 'alvaro@example.com',
      leadBusinessName: 'Ewaffle',
      businessName: 'Fidelidapp',
      conversationSummary: 'Lead pidió una sesión para conocer Fidelidapp y confirmó el primer horario.',
      now: new Date('2026-04-22T15:05:00-04:00'),
    });

    await bundle!.execute('schedule_meeting', {
      attendeeName: 'Alvaro',
      attendeeEmail: 'alvaro@example.com',
      startIso: '2026-04-23T13:00:00.000Z',
      topic: 'Demo de fidelización',
    });

    expect(mocks.createMeetingEvent).toHaveBeenCalledWith('17841467023627361', {
      summary: 'Fidelidapp - Demo de fidelización con Alvaro',
      description: expect.stringContaining('Resumen de conversación:'),
      startIso: '2026-04-23T13:00:00.000Z',
      endIso: '2026-04-23T13:30:00.000Z',
      attendees: [{ email: 'alvaro@example.com', name: 'Alvaro' }],
    });
    expect(mocks.createMeetingEvent.mock.calls[0][1].description).toContain(
      'Lead pidió una sesión para conocer Fidelidapp'
    );
    expect(mocks.createMeetingEvent.mock.calls[0][1].description).toContain(
      'Negocio del lead: Ewaffle'
    );
    expect(mocks.createMeetingEvent.mock.calls[0][1].description).toContain(
      'CC internos: owner@example.com'
    );
  });
});
