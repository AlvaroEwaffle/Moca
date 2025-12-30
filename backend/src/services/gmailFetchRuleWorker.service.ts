// @ts-nocheck
import { getRulesDueToRun, executeFetchRule } from './gmailFetchRule.service';
import mongoose from 'mongoose';

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
      console.log('⚠️ [Gmail Fetch Rule Worker] Worker is already running');
      return;
    }

    console.log('🔄 [Gmail Fetch Rule Worker] Starting worker...');
    
    // Run immediately on start
    this.processScheduledRules();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.processScheduledRules();
    }, this.checkInterval);

    console.log(`✅ [Gmail Fetch Rule Worker] Worker started (checking every ${this.checkInterval / 1000 / 60} minutes)`);
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('🛑 [Gmail Fetch Rule Worker] Worker stopped');
    }
  }

  /**
   * Process all rules that are due to run
   */
  private async processScheduledRules() {
    if (this.isRunning) {
      console.log('⏸️  [Gmail Fetch Rule Worker] Already processing, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      const rules = await getRulesDueToRun();
      
      if (rules.length === 0) {
        this.isRunning = false;
        return;
      }

      console.log(`📋 [Gmail Fetch Rule Worker] Found ${rules.length} rule(s) due to run`);

      // Process rules in parallel (but with some rate limiting)
      const batchSize = 3; // Process 3 rules at a time
      for (let i = 0; i < rules.length; i += batchSize) {
        const batch = rules.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (rule) => {
            try {
              console.log(`🔄 [Gmail Fetch Rule Worker] Executing rule: ${rule.name} (${rule.id})`);
              
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
                    console.log(`🔧 [Gmail Fetch Rule Worker] Extracted userId from ObjectId pattern: ${userId}`);
                  } else {
                    // Pattern 2: Just look for a 24-character hex string (most reliable)
                    match = userId.match(/([0-9a-fA-F]{24})/);
                    if (match && match[1]) {
                      userId = match[1];
                      console.log(`🔧 [Gmail Fetch Rule Worker] Extracted userId from hex pattern: ${userId}`);
                    } else {
                      console.error(`❌ [Gmail Fetch Rule Worker] Could not extract ObjectId from: ${userId.substring(0, 200)}`);
                    }
                  }
                } catch (parseError: any) {
                  console.error(`❌ [Gmail Fetch Rule Worker] Failed to parse userId: ${userId.substring(0, 200)}`, parseError.message);
                }
              }
              
              // Validate userId is a valid ObjectId string (24 hex characters)
              if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                console.error(`❌ [Gmail Fetch Rule Worker] Invalid userId format for rule ${rule.id}:`, {
                  userId: userId?.substring(0, 200),
                  userIdType: typeof rawUserId,
                  rawUserIdValue: typeof rawUserId === 'string' ? rawUserId.substring(0, 200) : JSON.stringify(rawUserId).substring(0, 200)
                });
                throw new Error(`Invalid userId format in rule ${rule.id}: expected ObjectId string, got: ${userId?.substring(0, 100) || 'undefined'}`);
              }
              
              console.log(`📋 [Gmail Fetch Rule Worker] Executing rule "${rule.name}" with userId: ${userId}`);
              const result = await executeFetchRule(rule.id, userId);
              
              if (result.success) {
                console.log(`✅ [Gmail Fetch Rule Worker] Rule "${rule.name}" executed: ${result.emailsFetched} emails processed`);
              } else {
                console.error(`❌ [Gmail Fetch Rule Worker] Rule "${rule.name}" failed: ${result.error}`);
              }
            } catch (error: any) {
              console.error(`❌ [Gmail Fetch Rule Worker] Error executing rule ${rule.id}:`, error.message);
            }
          })
        );

        // Small delay between batches to avoid overwhelming the system
        if (i + batchSize < rules.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      console.log(`✅ [Gmail Fetch Rule Worker] Finished processing ${rules.length} rule(s)`);
    } catch (error: any) {
      console.error(`❌ [Gmail Fetch Rule Worker] Error processing scheduled rules:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }
}

export default new GmailFetchRuleWorker();


