# Email Templates - How They Work

## Overview

Email templates in OpsManager are used to send consistent, branded emails for various system events and manual notifications.

---

## Current Implementation

### Automatic System Emails (Hardcoded)

These emails are **automatically sent** by the system when certain events occur:

#### 1. Welcome Email
**When:** Admin creates a new user  
**Triggered by:** `POST /api/v1/users`  
**Contains:**
- Username
- Temporary password
- Login link
- Security instructions

**Code Location:** `backend/src/modules/email/email.service.ts` → `sendWelcomeEmail()`

#### 2. Password Reset Email
**When:** User requests password reset  
**Triggered by:** `POST /api/v1/auth/password/reset/request`  
**Contains:**
- Reset link with token (1-hour expiry)
- Security warning
- Instructions

**Code Location:** `backend/src/modules/email/email.service.ts` → `sendPasswordResetEmail()`

#### 3. Password Changed Email
**When:** User changes password  
**Triggered by:** `POST /api/v1/auth/password/change`  
**Contains:**
- Confirmation message
- Security warning
- Contact info if not authorized

**Code Location:** `backend/src/modules/email/email.service.ts` → `sendPasswordChangedEmail()`

#### 4. Account Locked Email
**When:** Account locked after failed login attempts  
**Triggered by:** 5 failed login attempts  
**Contains:**
- Lockout reason
- Auto-unlock time (15 minutes)
- Contact admin instructions

**Code Location:** `backend/src/modules/email/email.service.ts` → `sendAccountLockedEmail()`

#### 5. MFA Enabled Email
**When:** User enables MFA  
**Triggered by:** `POST /api/v1/auth/mfa/verify`  
**Contains:**
- Confirmation message
- Backup code reminder
- Security tips

**Code Location:** `backend/src/modules/email/email.service.ts` → `sendMFAEnabledEmail()`

---

## Email Templates Management UI

### What It Does

The **Email Templates** UI (Settings → Templates) allows SUPER_ADMIN to:

1. **View all templates** - See system and custom templates
2. **Create custom templates** - Build new email templates
3. **Edit custom templates** - Modify templates you created
4. **Delete custom templates** - Remove templates you created
5. **Preview templates** - See how emails will look
6. **Send test emails** - Test templates with real data ← **NEW!**

### System vs Custom Templates

**System Templates:**
- Created by the system (seeded in database)
- Used for automatic emails
- **Cannot be edited or deleted** (protected)
- Examples: welcome_email, password_reset, account_locked

**Custom Templates:**
- Created by SUPER_ADMIN via UI
- Can be edited and deleted
- Used for manual emails or future features
- Examples: maintenance_notification, custom_alert

---

## How to Use Templates

### Option 1: Send Test Email (Available Now)

1. Go to **Settings → Templates**
2. Find the template you want to use
3. Click the **Send** icon (✉️)
4. Fill in:
   - Recipient email
   - Variable values (e.g., userName, actionUrl)
5. Click **Send Test Email**

**Note:** This currently shows a "Feature Not Yet Implemented" message because the backend endpoint needs to be added.

### Option 2: Automatic System Events (Already Working)

System templates are automatically used when events occur:
- User created → Welcome email sent
- Password reset requested → Reset email sent
- Password changed → Confirmation email sent
- Account locked → Lockout email sent
- MFA enabled → Confirmation email sent

### Option 3: Manual Email Sending (Future Feature)

**Planned Feature:**
- Add "Send Email" page
- Select template
- Choose recipients (users or email addresses)
- Fill in variables
- Send immediately or schedule

---

## Template Variables

Templates use variables in format `{{variableName}}` that get replaced with actual values.

### Common Variables

**User Variables:**
- `{{userName}}` - User's username
- `{{email}}` - User's email
- `{{firstName}}` - User's first name
- `{{lastName}}` - User's last name

**System Variables:**
- `{{appName}}` - Application name (OpsManager)
- `{{frontendUrl}}` - Frontend URL
- `{{supportEmail}}` - Support email

**Action Variables:**
- `{{actionUrl}}` - Link for user action
- `{{resetToken}}` - Password reset token
- `{{temporaryPassword}}` - Temporary password
- `{{expiryTime}}` - Token expiry time

### Example Template

**Subject:**
```
Welcome to {{appName}}, {{userName}}!
```

**HTML Body:**
```html
<h1>Welcome {{userName}}</h1>
<p>Your account has been created successfully.</p>
<p>Username: {{email}}</p>
<p>Temporary Password: {{temporaryPassword}}</p>
<p><a href="{{actionUrl}}">Click here to login</a></p>
```

**When Rendered:**
```
Subject: Welcome to OpsManager, john_doe!

Body:
Welcome john_doe
Your account has been created successfully.
Username: john@example.com
Temporary Password: Temp123!
[Click here to login]
```

---

## Backend Implementation

### Current Email Service

**File:** `backend/src/modules/email/email.service.ts`

**Methods:**
- `sendEmail(options)` - Generic email sender
- `sendWelcomeEmail(email, username, password)` - Welcome email
- `sendPasswordResetEmail(email, token)` - Reset email
- `sendPasswordChangedEmail(email, username)` - Changed email
- `sendAccountLockedEmail(email, username)` - Locked email
- `sendMFAEnabledEmail(email, username)` - MFA email

### Email Templates Service

**File:** `backend/src/modules/email-templates/email-templates.service.ts`

**Methods:**
- `getTemplate(key)` - Get template by key
- `getAllTemplates()` - Get all templates
- `createTemplate(data)` - Create new template
- `updateTemplate(key, data)` - Update template
- `deleteTemplate(key)` - Delete template
- `renderTemplate(template, variables)` - Replace variables

---

## What's Missing (To Be Implemented)

### 1. Send Template Email Endpoint

**Backend Endpoint Needed:**
```typescript
POST /api/v1/email-templates/:key/send
Body: {
  to: string | string[]
  variables: Record<string, string>
}
```

**Implementation:**
```typescript
// backend/src/modules/email-templates/email-templates.controller.ts
@Post(':key/send')
@RequirePermissions('settings', 'update')
async sendTemplateEmail(
  @Param('key') key: string,
  @Body() dto: SendTemplateEmailDto,
) {
  const template = await this.emailTemplatesService.getTemplate(key);
  const rendered = this.emailTemplatesService.renderTemplate(template, dto.variables);
  
  await this.emailService.sendEmail({
    to: dto.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  
  return { message: 'Email sent successfully' };
}
```

### 2. Template Selection for System Events

Allow admins to choose which template to use for each system event:

**Settings → Email Configuration:**
```
System Email Templates:
- Welcome Email: [dropdown: welcome_email, custom_welcome]
- Password Reset: [dropdown: password_reset, custom_reset]
- Account Locked: [dropdown: account_locked, custom_locked]
- MFA Enabled: [dropdown: mfa_enabled, custom_mfa]
```

### 3. Bulk Email Sending

Send emails to multiple users at once:

**New Page: Email → Send Bulk Email**
- Select template
- Choose recipients (all users, by role, by filter)
- Fill in variables
- Preview
- Send

### 4. Email Scheduling

Schedule emails to be sent later:

**Features:**
- Send at specific date/time
- Recurring emails (daily, weekly, monthly)
- Email queue management

### 5. Email History/Logs

Track all sent emails:

**New Page: Email → Email History**
- List of all sent emails
- Template used
- Recipients
- Sent date/time
- Status (sent, failed, pending)
- Resend option

---

## Quick Start Guide

### For SUPER_ADMIN

**1. View Templates:**
```
Settings → Templates tab
```

**2. Create Custom Template:**
```
Settings → Templates → Create Template button
- Enter template key (e.g., "maintenance_alert")
- Enter template name (e.g., "Maintenance Alert")
- Enter subject with variables: "Scheduled Maintenance - {{date}}"
- Enter HTML body with variables
- Enter plain text body
- Add variables: date, duration, impact
- Save
```

**3. Send Test Email:**
```
Settings → Templates → Find your template → Send icon
- Enter recipient email
- Fill in variable values
- Send
```

**4. Use in Code (Future):**
```typescript
// When backend endpoint is added
await apiClient.sendTemplateEmail('maintenance_alert', {
  to: 'user@example.com',
  variables: {
    date: '2026-02-15',
    duration: '2 hours',
    impact: 'Read-only mode'
  }
});
```

---

## Best Practices

### Template Design

1. **Keep it simple** - Clear, concise messaging
2. **Use variables** - Make templates reusable
3. **Include plain text** - For email clients that don't support HTML
4. **Test thoroughly** - Send test emails before using in production
5. **Brand consistently** - Use company colors, logo, style

### Variable Naming

1. **Use camelCase** - `userName`, not `user_name`
2. **Be descriptive** - `resetToken`, not `token`
3. **Document variables** - List all variables in template description

### Security

1. **Don't include sensitive data** - No passwords in templates (except temporary ones)
2. **Use HTTPS links** - All action URLs should be HTTPS
3. **Add expiry warnings** - For time-sensitive links
4. **Include security tips** - Remind users about security best practices

---

## Troubleshooting

### Template Not Sending

**Check:**
1. SMTP settings configured (Settings → SMTP)
2. Test SMTP connection works
3. Template exists in database
4. All required variables provided
5. Recipient email is valid

### Variables Not Replaced

**Check:**
1. Variable format is `{{variableName}}` (double curly braces)
2. Variable name matches exactly (case-sensitive)
3. Variable value provided in send request
4. No extra spaces: `{{userName}}` not `{{ userName }}`

### Email Goes to Spam

**Solutions:**
1. Configure SPF, DKIM, DMARC records
2. Use reputable SMTP provider (SendGrid, AWS SES)
3. Avoid spam trigger words
4. Include unsubscribe link (for bulk emails)
5. Warm up your sending domain

---

## Summary

**Current Status:**
- ✅ Email templates database model
- ✅ Email templates CRUD API
- ✅ Email templates management UI
- ✅ System templates (hardcoded)
- ✅ Automatic system emails
- ⚠️ Manual template sending (UI ready, backend endpoint needed)

**Next Steps:**
1. Add `POST /api/v1/email-templates/:key/send` endpoint
2. Add bulk email sending feature
3. Add email history/logs
4. Add template selection for system events

---

**Last Updated:** February 8, 2026
