// @ts-nocheck
import { getRulesDueToRun, executeFetchRule } from './gmailFetchRule.service';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Worker service to automatically execute scheduled Gmail fetch rules
 */
class GmailFetchRuleWorker {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 5 * 60 * 1000; // Check every 5 minutes

  /**
   * Start the worker
   */
  start() {
    if (this.intervalId) {
      logger.warn('gmail-fetch-rule-worker', 'Worker is already running');
      return;
    }

    logger.info('gmail-fetch-rule-worker', 'Starting worker', { checkIntervalMinutes: this.checkInterval / 1000 / 60 });
    
    // Run immediately on start
    this.processScheduledRules();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processScheduledRules();
    }, this.checkInterval);

    logger.info('gmail-fetch-rule-worker', 'Worker started successfully', { checkIntervalMinutes: this.checkInterval / 1000 / 60 });
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('gmail-fetch-rule-worker', 'Worker stopped');
    }
  }

  /**
   * Process all rules that are due to run
   */
  private async processScheduledRules() {
    if (this.isRunning) {
      logger.debug('gmail-fetch-rule-worker', 'Already processing, skipping cycle');
      return;
    }

    this.isRunning = true;
    const startTime = new Date();

    try {
      const rules = await getRulesDueToRun();
      
      if (rules.length === 0) {
        this.isRunning = false;
        return;
      }

      logger.info('gmail-fetch-rule-worker', `Found ${rules.length} rule(s) due to run`, { ruleCount: rules.length, ruleIds: rules.map(r => r.id) });

      // Process rules in parallel (but with some rate limiting)
      const batchSize = 3; // Process 3 rules at a time
      for (let i = 0; i < rules.length; i += batchSize) {
        const batch = rules.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (rule) => {
            try {
              logger.info('gmail-fetch-rule-worker', `Executing rule: ${rule.name}`, { ruleId: rule.id, ruleName: rule.name });
              
              // Extract userId safely - handle all possible formats
              let userId: string;
              
              // First, try to get the raw value
              const rawUserId = rule.userId;
              
              // Check if userId is already a string (ObjectId string)
              if (typeof rawUserId === 'string') {
                userId = rawUserId;
              } 
              // Check if userId is a Mongoose ObjectId
              else if (rawUserId && typeof rawUserId === 'object') {
                // Check if it's a Mongoose ObjectId instance
                if (rawUserId.constructor && rawUserId.constructor.name === 'ObjectId') {
                  userId = rawUserId.toString();
                }
                // Handle populated user object (shouldn't happen, but handle it)
                else if (rawUserId._id) {
                  userId = typeof rawUserId._id === 'string' 
                    ? rawUserId._id 
                    : rawUserId._id.toString();
                } else if (rawUserId.id) {
                  userId = typeof rawUserId.id === 'string'
                    ? rawUserId.id
                    : rawUserId.id.toString();
                } else {
                  // Last resort: try toString
                  userId = String(rawUserId);
                }
              } 
              // Fallback: convert to string
              else {
                userId = String(rawUserId);
              }
              
              // CRITICAL: Clean up if userId contains the full object stringified
              // This handles cases where userId was incorrectly stored as a stringified object
              if (userId && (userId.includes('_id') || userId.includes('ObjectId') || userId.includes('email') || userId.includes('displayName') || userId.includes('new ObjectId'))) {
                try {
                  // Try multiple patterns to extract the ObjectId
                  // Pattern 1: ObjectId('692da611d3ae736f263d745d')
                  let match = userId.match(/ObjectId\(['"]([0-9a-fA-F]{24})['"]\)/);
                  if (match && match[1]) {
                    userId = match[1];
                    logger.debug('gmail-fetch-rule-worker', 'Extracted userId from ObjectId pattern', { ruleId: rule.id, userId });
                  } else {
                    // Pattern 2: Just look for a 24-character hex string (most reliable)
                    match = userId.match(/([0-9a-fA-F]{24})/);
                    if (match && match[1]) {
                      userId = match[1];
                      logger.debug('gmail-fetch-rule-worker', 'Extracted userId from hex pattern', { ruleId: rule.id, userId });
                    } else {
                      logger.error('gmail-fetch-rule-worker', 'Could not extract ObjectId from userId', { ruleId: rule.id, userIdPreview: userId.substring(0, 200) });
                    }
                  }
                } catch (parseError: any) {
                  logger.error('gmail-fetch-rule-worker', 'Failed to parse userId', { ruleId: rule.id, userIdPreview: userId.substring(0, 200), error: parseError.message });
                }
              }
              
              // Validate userId is a valid ObjectId string (24 hex characters)
              if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                logger.error('gmail-fetch-rule-worker', 'Invalid userId format for rule', {
                  ruleId: rule.id,
                  ruleName: rule.name,
                  userId: userId?.substring(0, 200),
                  userIdType: typeof rawUserId,
                  rawUserIdValue: typeof rawUserId === 'string' ? rawUserId.substring(0, 200) : JSON.stringify(rawUserId).substring(0, 200)
                });
                throw new Error(`Invalid userId format in rule ${rule.id}: expected ObjectId string, got: ${userId?.substring(0, 100) || 'undefined'}`);
              }
              
              logger.info('gmail-fetch-rule-worker', `Executing rule "${rule.name}"`, { ruleId: rule.id, ruleName: rule.name, userId });
              const result = await executeFetchRule(rule.id, userId);
              
              if (result.success) {
                logger.info('gmail-fetch-rule-worker', `Rule "${rule.name}" executed successfully`, {
                  ruleId: rule.id,
                  ruleName: rule.name,
                  emailsFetched: result.emailsFetched,
                  contacts: result.contacts,
                  conversations: result.conversations,
                  messages: result.messages
                });
              } else {
                logger.error('gmail-fetch-rule-worker', `Rule "${rule.name}" failed`, {
                  ruleId: rule.id,
                  ruleName: rule.name,
                  error: result.error
                });
              }
            } catch (error: any) {
              logger.error('gmail-fetch-rule-worker', `Error executing rule`, {
                ruleId: rule.id,
                ruleName: rule.name,
                error: error.message,
                stack: error.stack
              });
            }
          })
        );

        // Small delay between batches to avoid overwhelming the system
        if (i + batchSize < rules.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      logger.info('gmail-fetch-rule-worker', `Finished processing ${rules.length} rule(s)`, {
        ruleCount: rules.length,
        durationMs: duration,
        durationSeconds: Math.round(duration / 1000)
      });
    } catch (error: any) {
      logger.error('gmail-fetch-rule-worker', 'Error processing scheduled rules', {
        error: error.message,
        stack: error.stack
      });
    } finally {
      this.isRunning = false;
    }
  }
}

export default new GmailFetchRuleWorker();


