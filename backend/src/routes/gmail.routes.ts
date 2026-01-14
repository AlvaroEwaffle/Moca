import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { processEmails } from '../services/gmailProcessor.service';
import { fetchEmails } from '../services/gmail.service';
import { extractContactsFromEmails } from '../services/gmailContactExtractor.service';

const router = express.Router();

/**
 * POST /api/gmail/fetch
 * Manually trigger email fetching and processing
 */
router.post('/fetch', authenticateToken, async (req, res) => {
  try {
    const {
      maxResults = 50,
      query = '',
      labelIds,
      includeSpam = false,
      agentId
    } = req.body;

    console.log(`📧 [Gmail API] Fetch request from user ${req.user!.userId}`);

    // Fetch emails first (to return them in response)
    const emails = await fetchEmails(req.user!.userId, {
      maxResults,
      query,
      labelIds,
      includeSpam
    });

    // Process the emails
    const result = await processEmails({
      userId: req.user!.userId,
      agentId,
      maxResults,
      query,
      labelIds,
      includeSpam
    });

    // Return simplified email data along with processing results
    const emailList = emails.map((email) => ({
      id: email.id,
      threadId: email.threadId,
      subject: email.subject || '(Sin asunto)',
      from: email.from || 'Desconocido',
      to: email.to || [],
      date: email.date,
      snippet: email.snippet || '',
      labels: email.labels || []
    }));

    res.json({
      success: true,
      data: {
        ...result,
        emails: emailList
      }
    });
  } catch (error: any) {
    console.error('❌ [Gmail API] Error fetching emails:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch emails'
    });
  }
});

/**
 * GET /api/gmail/list
 * List emails without processing them (for testing/debugging)
 */
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const {
      maxResults = 10,
      query = '',
      labelIds,
      includeSpam = false
    } = req.query;

    console.log(`📧 [Gmail API] List request from user ${req.user!.userId}`);

    const emails = await fetchEmails(req.user!.userId, {
      maxResults: Number(maxResults),
      query: query as string,
      labelIds: labelIds ? (Array.isArray(labelIds) ? labelIds : [labelIds]) as string[] : undefined,
      includeSpam: includeSpam === 'true'
    });

    // Return simplified email data (without full body for security)
    const simplified = emails.map((email) => ({
      id: email.id,
      threadId: email.threadId,
      subject: email.subject,
      from: email.from,
      to: email.to,
      date: email.date,
      snippet: email.snippet,
      labels: email.labels
    }));

    res.json({
      success: true,
      data: simplified,
      count: simplified.length
    });
  } catch (error: any) {
    console.error('❌ [Gmail API] Error listing emails:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list emails'
    });
  }
});

/**
 * POST /api/gmail/contacts/extract
 * Extract contacts from Gmail emails for a specific time period
 */
router.post('/contacts/extract', authenticateToken, async (req, res) => {
  try {
    const { days } = req.body;

    // Validate days parameter
    if (!days || typeof days !== 'number' || days < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid days parameter. Must be a positive number.'
      });
    }

    console.log(`📧 [Gmail API] Contact extraction request from user ${req.user!.userId}, ${days} days`);

    const result = await extractContactsFromEmails(req.user!.userId, days);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('❌ [Gmail API] Error extracting contacts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to extract contacts'
    });
  }
});

export default router;

