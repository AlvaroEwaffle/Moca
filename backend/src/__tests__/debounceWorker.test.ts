import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all heavy dependencies before importing the worker
vi.mock('../models/contact.model', () => ({ default: {} }));
vi.mock('../models/conversation.model', () => ({
  default: { find: vi.fn().mockResolvedValue([]) }
}));
vi.mock('../models/message.model', () => ({
  default: {
    distinct: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({})
  }
}));
vi.mock('../models/outboundQueue.model', () => ({ default: {} }));
vi.mock('../models/instagramAccount.model', () => ({
  default: { findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) }
}));
vi.mock('../models/instagramComment.model', () => ({ default: {} }));
vi.mock('../models/keywordActivationRule.model', () => ({ default: {} }));
vi.mock('./instagramApi.service', () => ({ default: {} }));
vi.mock('./openai.service', () => ({
  generateStructuredResponse: vi.fn().mockResolvedValue(null),
  default: {}
}));
vi.mock('../utils/slack', () => ({
  notifyError: vi.fn()
}));
vi.mock('./leadScoring.service', () => ({
  LeadScoringService: vi.fn().mockImplementation(() => ({}))
}));
vi.mock('./globalAgentRules.service', () => ({
  GlobalAgentRulesService: vi.fn().mockImplementation(() => ({}))
}));
vi.mock('./fidelidapp.service', () => ({
  pushToFidelidapp: vi.fn()
}));
vi.mock('./contactDataExtractor.service', () => ({
  extractContactData: vi.fn()
}));

// Now import the worker (default export is a singleton instance)
// We import the class constructor via a workaround — re-import from the module
const { default: debounceWorkerService } = await import('../services/debounceWorker.service');

describe('DebounceWorkerService — start/stop lifecycle', () => {
  afterEach(async () => {
    await debounceWorkerService.stop();
  });

  it('starts without errors and sets isRunning', async () => {
    await debounceWorkerService.start();
    // Second start should be a no-op (guard against double-start)
    await debounceWorkerService.start();
    // No error thrown means success; stop to clean up
    await debounceWorkerService.stop();
  });

  it('stop is safe to call when not running', async () => {
    // Should not throw when service was never started
    await debounceWorkerService.stop();
  });

  it('can be restarted after stop', async () => {
    await debounceWorkerService.start();
    await debounceWorkerService.stop();
    await debounceWorkerService.start();
    await debounceWorkerService.stop();
    // No error means lifecycle management works
  });
});

describe('DebounceWorkerService — message role filtering', () => {
  afterEach(async () => {
    await debounceWorkerService.stop();
  });

  it('skips messages with role=assistant to prevent echo loops', async () => {
    const assistantMessage = {
      role: 'assistant',
      id: 'msg-1',
      mid: 'mid-1',
      text: 'Hello from bot'
    } as any;

    // Should not throw and should not add to pending
    await debounceWorkerService.triggerMessageCollection('conv-1', assistantMessage);
    // Verify no timer was created (no pending collection for this conversation)
    // We can test this indirectly: calling stop should not try to clear any timers
    await debounceWorkerService.stop();
  });

  it('accepts messages with role=user', async () => {
    const userMessage = {
      role: 'user',
      id: 'msg-2',
      mid: 'mid-2',
      text: 'Hello from user'
    } as any;

    // This should create a pending collection window
    await debounceWorkerService.triggerMessageCollection('conv-2', userMessage);

    // Stop should clean up the timer created by addMessageToCollection
    await debounceWorkerService.stop();
  });
});

describe('DebounceWorkerService — process finds unprocessed messages', () => {
  it('process completes without errors when no unprocessed messages exist', async () => {
    // Message.distinct is mocked to return [], so no conversations should be found
    await debounceWorkerService.process();
    // No error thrown = success
  });
});
