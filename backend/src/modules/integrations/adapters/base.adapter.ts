/**
 * Base Adapter Interface
 * All integration adapters must implement this interface
 */
export interface BaseAdapter {
  /**
   * Test connection to the integration provider
   * @returns Promise with success status, message, and optional latency
   */
  testConnection(): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }>;
}

/**
 * SMTP Adapter Interface
 * Extends base adapter with SMTP-specific operations
 */
export interface SmtpAdapter extends BaseAdapter {
  /**
   * Send a test email to verify SMTP configuration
   * @param to - Recipient email address
   */
  sendTestEmail(to: string): Promise<{
    success: boolean;
    message: string;
  }>;
}

/**
 * Slack Adapter Interface
 * Extends base adapter with Slack-specific operations
 */
export interface SlackAdapter extends BaseAdapter {
  /**
   * Send a message to Slack channel
   */
  sendMessage(text: string, blocks?: any[]): Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * List channels (requires bot token)
   */
  listChannels(): Promise<any[]>;

  /**
   * List users (requires bot token)
   */
  listUsers(): Promise<any[]>;
}

/**
 * Discord Adapter Interface
 * Extends base adapter with Discord-specific operations
 */
export interface DiscordAdapter extends BaseAdapter {
  /**
   * Send a message to Discord channel
   */
  sendMessage(content: string, embeds?: any[]): Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Send an embed message
   */
  sendEmbed(embed: any): Promise<{
    success: boolean;
    message: string;
  }>;
}

/**
 * Ansible Adapter Interface
 * Extends base adapter with Ansible-specific operations
 */
export interface AnsibleAdapter extends BaseAdapter {
  /**
   * List all job templates
   */
  listJobTemplates(): Promise<any[]>;

  /**
   * Get job template details
   */
  getJobTemplate(templateId: number): Promise<any>;

  /**
   * Launch a job template
   */
  launchJob(templateId: number, extraVars?: Record<string, any>): Promise<{
    success: boolean;
    jobId?: number;
    message: string;
  }>;

  /**
   * Get job status
   */
  getJobStatus(jobId: number): Promise<{
    status: string;
    finished?: string;
    failed?: boolean;
  }>;

  /**
   * Cancel a running job
   */
  cancelJob(jobId: number): Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * List inventories
   */
  listInventories(): Promise<any[]>;
}

// ============================================
// SMTP Types
// ============================================

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  username: string;
  password: string;
  from?: string; // Default sender email
}
