import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { gmailAgentRunner } from '../gmailAgent/gmailAgentRunner';

const router = express.Router();

// Health endpoint
router.get('/health', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    data: gmailAgentRunner.health()
  });
});

// Manual run endpoint
router.post('/run', authenticateToken, async (req, res) => {
  try {
    const { maxEmails = 10, mode = 'dry_run' } = req.body || {};
    const result = await gmailAgentRunner.run({ maxEmails, mode });
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('❌ [GmailAgent][Route] Error executing run:', error?.message || error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to execute Gmail Agent run'
    });
  }
});

export default router;

