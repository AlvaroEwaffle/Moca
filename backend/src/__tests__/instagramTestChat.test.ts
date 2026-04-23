import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import supertest from 'supertest';

process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';

const mocks = vi.hoisted(() => ({
  accountFindOne: vi.fn(),
  calendarFindOne: vi.fn(),
  generateStructuredResponse: vi.fn(),
}));

vi.mock('../models/instagramAccount.model', () => ({
  default: {
    findOne: mocks.accountFindOne,
  },
}));

vi.mock('../models/calendarIntegration.model', () => ({
  default: {
    findOne: mocks.calendarFindOne,
  },
}));

vi.mock('../services/openai.service', () => ({
  generateStructuredResponse: mocks.generateStructuredResponse,
}));

vi.mock('../services/instagramWebhook.service', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      handleVerification: vi.fn(),
      validateSignature: vi.fn(),
      handleWebhook: vi.fn(),
    };
  }),
}));

vi.mock('../services/instagramApi.service', () => ({
  default: {},
}));

vi.mock('../services/fidelidapp.service', () => ({
  pushToFidelidapp: vi.fn(),
}));

const { default: instagramRoutes } = await import('../routes/instagram.routes');

const app = express();
app.use(express.json());
app.use('/api/instagram', instagramRoutes);

const request = supertest(app);

describe('POST /api/instagram/test-chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.accountFindOne.mockResolvedValue({
      accountId: '17841467023627361',
      accountName: 'Moca',
      settings: {
        systemPrompt: 'Actua como agente de ventas.',
        toneOfVoice: 'friendly',
        keyInformation: '',
        fallbackRules: [],
        defaultMilestone: {
          target: 'meeting_scheduled',
          customTarget: undefined,
        },
      },
      mcpTools: {
        enabled: true,
        servers: [],
      },
    });

    mocks.calendarFindOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        status: 'connected',
        enabled: true,
        timezone: 'America/Santiago',
        calendarId: 'primary',
        meetingDurationMinutes: 30,
        bufferMinutes: 15,
      }),
    });

    mocks.generateStructuredResponse.mockResolvedValue({
      responseText: 'Tengo disponibilidad manana a las 10:30. Te sirve?',
      leadScore: 1,
      aiAssessedScore: 1,
      intent: 'schedule_meeting',
      nextAction: 'schedule_meeting',
      confidence: 0.9,
      metadata: {
        greetingUsed: false,
        previousContextReferenced: false,
        businessNameUsed: 'Moca',
      },
    });
  });

  it('uses the structured production response flow and returns calendar diagnostics', async () => {
    const token = jwt.sign(
      { userId: '695e6eace752cbffaf74fc5d6', email: 'test@example.com' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const response = await request
      .post('/api/instagram/test-chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: '17841467023627361',
        message: 'Agenda una sesion para manana. Mi email es alvaro@test.com',
        conversationHistory: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.mode).toBe('structured');
    expect(response.body.data.response).toBe('Tengo disponibilidad manana a las 10:30. Te sirve?');
    expect(response.body.data.accountContext.calendarToolsEligible).toBe(true);
    expect(response.body.data.accountContext.calendar.timezone).toBe('America/Santiago');

    expect(mocks.generateStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        lastMessage: 'Agenda una sesion para manana. Mi email es alvaro@test.com',
        milestoneTarget: 'meeting_scheduled',
        milestoneStatus: 'pending',
      }),
      expect.objectContaining({
        useStructuredResponse: true,
        customInstructions: 'Actua como agente de ventas.',
      }),
      expect.objectContaining({
        enabled: true,
      }),
      expect.objectContaining({
        accountId: '17841467023627361',
        contactEmail: 'alvaro@test.com',
      })
    );
  });
});
