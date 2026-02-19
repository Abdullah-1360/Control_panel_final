import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '@/modules/audit/audit.service';

export interface EmailTemplateData {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
}

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getTemplate(key: string): Promise<EmailTemplateData | null> {
    const template = await this.prisma.email_templates.findUnique({
      where: { key },
    });

    if (!template) {
      return null;
    }

    return {
      key: template.key,
      name: template.name,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      variables: template.variables,
    };
  }

  async getAllTemplates(): Promise<EmailTemplateData[]> {
    const templates = await this.prisma.email_templates.findMany({
      orderBy: { name: 'asc' },
    });

    return templates.map((t) => ({
      key: t.key,
      name: t.name,
      subject: t.subject,
      htmlBody: t.htmlBody,
      textBody: t.textBody,
      variables: t.variables,
    }));
  }

  async createTemplate(
    data: EmailTemplateData,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<EmailTemplateData> {
    const existing = await this.prisma.email_templates.findUnique({
      where: { key: data.key },
    });

    if (existing) {
      throw new HttpException(
        `Template with key '${data.key}' already exists`,
        HttpStatus.CONFLICT,
      );
    }

    const template = await this.prisma.email_templates.create({
      data: {
        key: data.key,
        name: data.name,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
        variables: data.variables,
        isSystem: false,
      },
    });

    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'email_template.create',
      resource: 'email_template',
      resourceId: template.id,
      description: `Created email template: ${template.name}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return {
      key: template.key,
      name: template.name,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      variables: template.variables,
    };
  }

  async updateTemplate(
    key: string,
    data: Partial<EmailTemplateData>,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<EmailTemplateData> {
    const template = await this.prisma.email_templates.findUnique({
      where: { key },
    });

    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }

    if (template.isSystem) {
      throw new HttpException(
        'Cannot modify system templates',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.prisma.email_templates.update({
      where: { key },
      data: {
        name: data.name,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
        variables: data.variables,
      },
    });

    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'email_template.update',
      resource: 'email_template',
      resourceId: updated.id,
      description: `Updated email template: ${updated.name}`,
      ipAddress,
      userAgent,
      severity: 'INFO',
    });

    return {
      key: updated.key,
      name: updated.name,
      subject: updated.subject,
      htmlBody: updated.htmlBody,
      textBody: updated.textBody,
      variables: updated.variables,
    };
  }

  async deleteTemplate(
    key: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<void> {
    const template = await this.prisma.email_templates.findUnique({
      where: { key },
    });

    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }

    if (template.isSystem) {
      throw new HttpException(
        'Cannot delete system templates',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.email_templates.delete({
      where: { key },
    });

    await this.auditService.log({
      userId,
      actorType: 'USER',
      action: 'email_template.delete',
      resource: 'email_template',
      resourceId: template.id,
      description: `Deleted email template: ${template.name}`,
      ipAddress,
      userAgent,
      severity: 'WARNING',
    });
  }

  renderTemplate(template: EmailTemplateData, variables: Record<string, string>): {
    subject: string;
    html: string;
    text: string;
  } {
    let subject = template.subject;
    let html = template.htmlBody;
    let text = template.textBody;

    // Replace variables in format {{variableName}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
      text = text.replace(regex, value);
    }

    return { subject, html, text };
  }
}
