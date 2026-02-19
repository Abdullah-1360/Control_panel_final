import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';
import { EmailTemplatesService } from '@/modules/email-templates/email-templates.service';
import { EmailService } from '@/modules/email/email.service';
import {
  NotificationTrigger,
  RecipientType,
  EmailStatus,
  Prisma,
} from '@prisma/client';
import {
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
  SendBulkEmailDto,
} from './dto/notification-rule.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private emailTemplates: EmailTemplatesService,
    private email: EmailService,
  ) {}

  // ==================== Notification Rules CRUD ====================

  async getAllRules() {
    const rules = await this.prisma.notification_rules.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return rules;
  }

  async getRule(id: string) {
    const rule = await this.prisma.notification_rules.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new HttpException('Notification rule not found', HttpStatus.NOT_FOUND);
    }

    return rule;
  }

  async createRule(
    dto: CreateNotificationRuleDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // Validate template exists
    const template = await this.emailTemplates.getTemplate(dto.templateKey);
    if (!template) {
      throw new HttpException(
        `Template '${dto.templateKey}' not found`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const rule = await this.prisma.notification_rules.create({
      data: {
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        templateKey: dto.templateKey,
        recipientType: dto.recipientType,
        recipientValue: dto.recipientValue as Prisma.JsonObject,
        conditions: dto.conditions as Prisma.JsonObject,
        priority: dto.priority,
        isActive: dto.isActive,
        createdBy: userId,
      },
    });

    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'notification_rule.create',
      resource: 'notification_rule',
      resourceId: rule.id,
      description: `Created notification rule: ${rule.name}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    this.logger.log(`Notification rule created: ${rule.name} (ID: ${rule.id})`);

    return rule;
  }

  async updateRule(
    id: string,
    dto: UpdateNotificationRuleDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const existing = await this.getRule(id);

    // Validate template if changed
    if (dto.templateKey) {
      const template = await this.emailTemplates.getTemplate(dto.templateKey);
      if (!template) {
        throw new HttpException(
          `Template '${dto.templateKey}' not found`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const rule = await this.prisma.notification_rules.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        templateKey: dto.templateKey,
        recipientType: dto.recipientType,
        recipientValue: dto.recipientValue as Prisma.JsonObject,
        conditions: dto.conditions as Prisma.JsonObject,
        priority: dto.priority,
        isActive: dto.isActive,
      },
    });

    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'notification_rule.update',
      resource: 'notification_rule',
      resourceId: rule.id,
      description: `Updated notification rule: ${rule.name}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    this.logger.log(`Notification rule updated: ${rule.name} (ID: ${rule.id})`);

    return rule;
  }

  async deleteRule(
    id: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    const rule = await this.getRule(id);

    await this.prisma.notification_rules.delete({
      where: { id },
    });

    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'notification_rule.delete',
      resource: 'notification_rule',
      resourceId: id,
      description: `Deleted notification rule: ${rule.name}`,
      ipAddress,
      userAgent,
      severity: 'WARNING',
    });

    this.logger.log(`Notification rule deleted: ${rule.name} (ID: ${id})`);
  }

  // ==================== Email History ====================

  async getEmailHistory(params?: {
    page?: number;
    limit?: number;
    status?: EmailStatus;
    ruleId?: string;
    triggeredBy?: string;
  }) {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.email_historyWhereInput = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.ruleId) {
      where.ruleId = params.ruleId;
    }

    if (params?.triggeredBy) {
      where.triggeredBy = params.triggeredBy;
    }

    const [emails, total] = await Promise.all([
      this.prisma.email_history.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rule: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.email_history.count({ where }),
    ]);

    return {
      data: emails,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== Event Triggering ====================

  async triggerEvent(
    trigger: NotificationTrigger,
    affectedUserId: string | null,
    variables: Record<string, string>,
    triggeredBy: string,
  ) {
    this.logger.log(`Event triggered: ${trigger} by user ${triggeredBy}`);

    // Find all active rules for this trigger, ordered by priority
    const rules = await this.prisma.notification_rules.findMany({
      where: {
        trigger,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) {
      this.logger.debug(`No active rules found for trigger: ${trigger}`);
      return;
    }

    this.logger.log(`Found ${rules.length} active rule(s) for trigger: ${trigger}`);

    // Execute each rule
    for (const rule of rules) {
      try {
        await this.executeRule(rule, affectedUserId, variables, triggeredBy, trigger);
      } catch (error) {
        this.logger.error(
          `Failed to execute rule ${rule.name} (${rule.id}):`,
          error,
        );
      }
    }
  }

  private async executeRule(
    rule: any,
    affectedUserId: string | null,
    variables: Record<string, string>,
    triggeredBy: string,
    trigger: NotificationTrigger,
  ) {
    this.logger.log(`Executing rule: ${rule.name} (Priority: ${rule.priority})`);

    // Evaluate conditions
    if (rule.conditions && !this.evaluateConditions(rule.conditions, variables)) {
      this.logger.debug(`Rule ${rule.name} conditions not met, skipping`);
      return;
    }

    // Get recipients
    const recipients = await this.getRecipients(
      rule.recipientType,
      rule.recipientValue,
      affectedUserId,
    );

    if (recipients.length === 0) {
      this.logger.warn(`No recipients found for rule: ${rule.name}`);
      return;
    }

    // Get template
    const template = await this.emailTemplates.getTemplate(rule.templateKey);
    if (!template) {
      this.logger.error(`Template ${rule.templateKey} not found for rule ${rule.name}`);
      return;
    }

    // Render template
    const rendered = this.emailTemplates.renderTemplate(template, variables);

    // Send emails
    for (const recipient of recipients) {
      try {
        const success = await this.email.sendEmail({
          to: recipient,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });

        // Log to email history
        await this.prisma.email_history.create({
          data: {
            ruleId: rule.id,
            templateKey: rule.templateKey,
            recipients: [recipient],
            subject: rendered.subject,
            htmlBody: rendered.html,
            textBody: rendered.text,
            variables: variables as Prisma.JsonObject,
            status: success ? EmailStatus.SENT : EmailStatus.FAILED,
            sentAt: success ? new Date() : null,
            failedAt: success ? null : new Date(),
            error: success ? null : 'Email sending failed',
            triggeredBy,
            triggerEvent: trigger,
          },
        });

        this.logger.log(`Email sent to ${recipient} via rule: ${rule.name}`);
      } catch (error: any) {
        this.logger.error(`Failed to send email to ${recipient}:`, error);

        // Log failure
        await this.prisma.email_history.create({
          data: {
            ruleId: rule.id,
            templateKey: rule.templateKey,
            recipients: [recipient],
            subject: rendered.subject,
            htmlBody: rendered.html,
            textBody: rendered.text,
            variables: variables as Prisma.JsonObject,
            status: EmailStatus.FAILED,
            failedAt: new Date(),
            error: error.message,
            triggeredBy,
            triggerEvent: trigger,
          },
        });
      }
    }
  }

  private evaluateConditions(
    conditions: any,
    variables: Record<string, string>,
  ): boolean {
    // Basic condition evaluation (role filter)
    if (conditions.roleFilter && Array.isArray(conditions.roleFilter)) {
      const userRole = variables.userRole;
      if (userRole && !conditions.roleFilter.includes(userRole)) {
        return false;
      }
    }

    // Add more condition types here in Phase 2
    // - Time-based conditions
    // - Frequency-based conditions
    // - Field-specific conditions

    return true;
  }

  private async getRecipients(
    recipientType: RecipientType,
    recipientValue: any,
    affectedUserId: string | null,
  ): Promise<string[]> {
    const recipients: string[] = [];

    switch (recipientType) {
      case RecipientType.AFFECTED_USER:
        if (affectedUserId) {
          const user = await this.prisma.users.findUnique({
            where: { id: affectedUserId },
            select: { email: true },
          });
          if (user) recipients.push(user.email);
        }
        break;

      case RecipientType.SPECIFIC_USER:
        if (recipientValue.userIds && Array.isArray(recipientValue.userIds)) {
          const users = await this.prisma.users.findMany({
            where: { id: { in: recipientValue.userIds } },
            select: { email: true },
          });
          recipients.push(...users.map((u) => u.email));
        }
        break;

      case RecipientType.SPECIFIC_ROLE:
        if (recipientValue.roleIds && Array.isArray(recipientValue.roleIds)) {
          const users = await this.prisma.users.findMany({
            where: { roleId: { in: recipientValue.roleIds } },
            select: { email: true },
          });
          recipients.push(...users.map((u) => u.email));
        }
        break;

      case RecipientType.ALL_USERS:
        const allUsers = await this.prisma.users.findMany({
          where: { isActive: true },
          select: { email: true },
        });
        recipients.push(...allUsers.map((u) => u.email));
        break;

      case RecipientType.CUSTOM_EMAIL:
        if (recipientValue.emails && Array.isArray(recipientValue.emails)) {
          recipients.push(...recipientValue.emails);
        }
        break;

      case RecipientType.HYBRID:
        // Combine all recipient types
        const hybridRecipients = await Promise.all([
          this.getRecipients(RecipientType.AFFECTED_USER, recipientValue, affectedUserId),
          this.getRecipients(RecipientType.SPECIFIC_USER, recipientValue, null),
          this.getRecipients(RecipientType.SPECIFIC_ROLE, recipientValue, null),
          this.getRecipients(RecipientType.CUSTOM_EMAIL, recipientValue, null),
        ]);
        recipients.push(...hybridRecipients.flat());
        break;
    }

    // Remove duplicates
    return [...new Set(recipients)];
  }

  // ==================== Bulk Email ====================

  async sendBulkEmail(
    dto: SendBulkEmailDto,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ) {
    // Get template
    const template = await this.emailTemplates.getTemplate(dto.templateKey);
    if (!template) {
      throw new HttpException(
        `Template '${dto.templateKey}' not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Render template
    const rendered = this.emailTemplates.renderTemplate(template, dto.variables);

    const results = {
      total: dto.recipients.length,
      sent: 0,
      failed: 0,
    };

    // Send to each recipient
    for (const recipient of dto.recipients) {
      try {
        const success = await this.email.sendEmail({
          to: recipient,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });

        // Log to email history
        await this.prisma.email_history.create({
          data: {
            ruleId: null, // Manual send
            templateKey: dto.templateKey,
            recipients: [recipient],
            subject: rendered.subject,
            htmlBody: rendered.html,
            textBody: rendered.text,
            variables: dto.variables as Prisma.JsonObject,
            status: success ? EmailStatus.SENT : EmailStatus.FAILED,
            sentAt: success ? new Date() : null,
            failedAt: success ? null : new Date(),
            error: success ? null : 'Email sending failed',
            triggeredBy: userId,
            triggerEvent: 'MANUAL_BULK_SEND',
          },
        });

        if (success) {
          results.sent++;
        } else {
          results.failed++;
        }
      } catch (error: any) {
        this.logger.error(`Failed to send bulk email to ${recipient}:`, error);
        results.failed++;

        // Log failure
        await this.prisma.email_history.create({
          data: {
            ruleId: null,
            templateKey: dto.templateKey,
            recipients: [recipient],
            subject: rendered.subject,
            htmlBody: rendered.html,
            textBody: rendered.text,
            variables: dto.variables as Prisma.JsonObject,
            status: EmailStatus.FAILED,
            failedAt: new Date(),
            error: error.message,
            triggeredBy: userId,
            triggerEvent: 'MANUAL_BULK_SEND',
          },
        });
      }
    }

    await this.audit.log({
      userId,
      actorType: 'USER',
      action: 'bulk_email.send',
      resource: 'email',
      description: `Sent bulk email to ${results.sent}/${results.total} recipients`,
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    this.logger.log(
      `Bulk email sent: ${results.sent}/${results.total} successful`,
    );

    return results;
  }
}
