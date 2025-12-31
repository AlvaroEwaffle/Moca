import fs from 'fs';
import path from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

class Logger {
  private logDir: string;
  private currentLogFile: string;
  private logRotationEnabled: boolean = true;

  constructor() {
    // Create logs directory if it doesn't exist
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Set current log file based on date
    this.updateLogFile();
  }

  private updateLogFile(): void {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.currentLogFile = path.join(this.logDir, `gmail-agent-${today}.log`);
  }

  private ensureLogFile(): void {
    // Check if we need to rotate (new day)
    const today = new Date().toISOString().split('T')[0];
    const currentFileDate = this.currentLogFile.split('-').pop()?.replace('.log', '');
    
    if (currentFileDate !== today) {
      this.updateLogFile();
    }

    // Ensure file exists
    if (!fs.existsSync(this.currentLogFile)) {
      fs.writeFileSync(this.currentLogFile, '', 'utf-8');
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const metadataStr = entry.metadata 
      ? ` | ${JSON.stringify(entry.metadata)}`
      : '';
    
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.service}] ${entry.message}${metadataStr}\n`;
  }

  private writeToFile(entry: LogEntry): void {
    try {
      this.ensureLogFile();
      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(this.currentLogFile, logLine, 'utf-8');
    } catch (error) {
      // Fallback to console if file write fails
      console.error('Failed to write to log file:', error);
      console.log(this.formatLogEntry(entry).trim());
    }
  }

  private log(level: LogLevel, service: string, message: string, metadata?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message,
      metadata
    };

    // Always write to file
    this.writeToFile(entry);

    // Also log to console with appropriate method
    const consoleMessage = `[${entry.timestamp}] [${level.toUpperCase()}] [${service}] ${message}`;
    const metadataStr = metadata ? ` | ${JSON.stringify(metadata)}` : '';

    switch (level) {
      case 'error':
        console.error(consoleMessage + metadataStr);
        break;
      case 'warn':
        console.warn(consoleMessage + metadataStr);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(consoleMessage + metadataStr);
        }
        break;
      default:
        console.log(consoleMessage + metadataStr);
    }
  }

  info(service: string, message: string, metadata?: Record<string, any>): void {
    this.log('info', service, message, metadata);
  }

  warn(service: string, message: string, metadata?: Record<string, any>): void {
    this.log('warn', service, message, metadata);
  }

  error(service: string, message: string, metadata?: Record<string, any>): void {
    this.log('error', service, message, metadata);
  }

  debug(service: string, message: string, metadata?: Record<string, any>): void {
    this.log('debug', service, message, metadata);
  }

  /**
   * Get log file path for a specific date (or today if not specified)
   */
  getLogFilePath(date?: string): string {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `gmail-agent-${targetDate}.log`);
  }

  /**
   * Read logs from a specific date
   */
  readLogs(date?: string): string {
    const logFile = this.getLogFilePath(date);
    if (fs.existsSync(logFile)) {
      return fs.readFileSync(logFile, 'utf-8');
    }
    return '';
  }

  /**
   * Parse log entries from log file content
   */
  parseLogs(logContent: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = logContent.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        // Parse format: [timestamp] [LEVEL] [service] message | metadata
        const timestampMatch = line.match(/\[([^\]]+)\]/);
        if (!timestampMatch) continue;

        const levelMatch = line.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/);
        if (!levelMatch) continue;

        const timestamp = timestampMatch[1];
        const level = levelMatch[2].toLowerCase() as LogLevel;
        const service = levelMatch[3];

        // Extract message and metadata
        const messageAndMetadata = line.substring(levelMatch[0].length).trim();
        const metadataMatch = messageAndMetadata.match(/\|\s*({.+})$/);
        
        let message = messageAndMetadata;
        let metadata: Record<string, any> | undefined;

        if (metadataMatch) {
          message = messageAndMetadata.substring(0, metadataMatch.index).trim();
          try {
            metadata = JSON.parse(metadataMatch[1]);
          } catch {
            // If metadata is not valid JSON, ignore it
          }
        }

        entries.push({
          timestamp,
          level,
          service,
          message,
          metadata
        });
      } catch (error) {
        // Skip malformed log lines
        continue;
      }
    }

    return entries;
  }

  /**
   * Get logs filtered by criteria
   */
  getLogs(options: {
    date?: string;
    service?: string;
    level?: LogLevel;
    limit?: number;
    startTime?: string;
    endTime?: string;
    search?: string;
  }): LogEntry[] {
    const logContent = this.readLogs(options.date);
    let entries = this.parseLogs(logContent);

    // Filter by service
    if (options.service) {
      entries = entries.filter(e => e.service === options.service);
    }

    // Filter by level
    if (options.level) {
      entries = entries.filter(e => e.level === options.level);
    }

    // Filter by time range
    if (options.startTime) {
      entries = entries.filter(e => e.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      entries = entries.filter(e => e.timestamp <= options.endTime!);
    }

    // Search in message
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      entries = entries.filter(e => 
        e.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(e.metadata || {}).toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit results
    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions for common services
export const gmailProcessorLogger = {
  info: (message: string, metadata?: Record<string, any>) => logger.info('gmail-processor', message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => logger.warn('gmail-processor', message, metadata),
  error: (message: string, metadata?: Record<string, any>) => logger.error('gmail-processor', message, metadata),
  debug: (message: string, metadata?: Record<string, any>) => logger.debug('gmail-processor', message, metadata)
};

export const emailDraftQueueLogger = {
  info: (message: string, metadata?: Record<string, any>) => logger.info('email-draft-queue', message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => logger.warn('email-draft-queue', message, metadata),
  error: (message: string, metadata?: Record<string, any>) => logger.error('email-draft-queue', message, metadata),
  debug: (message: string, metadata?: Record<string, any>) => logger.debug('email-draft-queue', message, metadata)
};

export const gmailDraftLogger = {
  info: (message: string, metadata?: Record<string, any>) => logger.info('gmail-draft', message, metadata),
  warn: (message: string, metadata?: Record<string, any>) => logger.warn('gmail-draft', message, metadata),
  error: (message: string, metadata?: Record<string, any>) => logger.error('gmail-draft', message, metadata),
  debug: (message: string, metadata?: Record<string, any>) => logger.debug('gmail-draft', message, metadata)
};

