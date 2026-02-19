import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const emailTemplates = [
  {
    key: 'welcome',
    name: 'Welcome Email',
    subject: 'Welcome to OpsManager',
    htmlBody: `
      <h2>Welcome to OpsManager!</h2>
      <p>Hello {{userName}},</p>
      <p>Your account has been created successfully.</p>
      <p><strong>Temporary Password:</strong> {{temporaryPassword}}</p>
      <p>Please log in and change your password immediately.</p>
      <p><a href="{{loginUrl}}">Login to OpsManager</a></p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Welcome to OpsManager!

Hello {{userName}},

Your account has been created successfully.

Temporary Password: {{temporaryPassword}}

Please log in and change your password immediately.

Login URL: {{loginUrl}}

This is an automated message from OpsManager.`,
    variables: ['userName', 'temporaryPassword', 'loginUrl'],
    isSystem: true,
  },
  {
    key: 'password_reset_request',
    name: 'Password Reset Request',
    subject: 'Password Reset Request',
    htmlBody: `
      <h2>Password Reset Request</h2>
      <p>Hello {{userName}},</p>
      <p>We received a request to reset your password.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="{{resetLink}}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Password Reset Request

Hello {{userName}},

We received a request to reset your password.

Reset your password using this link: {{resetLink}}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

This is an automated message from OpsManager.`,
    variables: ['userName', 'resetLink'],
    isSystem: true,
  },
  {
    key: 'password_reset_confirmation',
    name: 'Password Reset Confirmation',
    subject: 'Password Reset Successful',
    htmlBody: `
      <h2>Password Reset Successful</h2>
      <p>Hello {{userName}},</p>
      <p>Your password has been reset successfully.</p>
      <p>If you didn't make this change, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Password Reset Successful

Hello {{userName}},

Your password has been reset successfully.

If you didn't make this change, please contact your administrator immediately.

This is an automated message from OpsManager.`,
    variables: ['userName'],
    isSystem: true,
  },
  {
    key: 'password_changed',
    name: 'Password Changed Notification',
    subject: 'Your Password Has Been Changed',
    htmlBody: `
      <h2>Password Changed</h2>
      <p>Hello {{userName}},</p>
      <p>Your password was changed successfully.</p>
      <p>If you didn't make this change, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Password Changed

Hello {{userName}},

Your password was changed successfully.

If you didn't make this change, please contact your administrator immediately.

This is an automated message from OpsManager.`,
    variables: ['userName'],
    isSystem: true,
  },
  {
    key: 'account_locked',
    name: 'Account Locked Notification',
    subject: 'Your Account Has Been Locked',
    htmlBody: `
      <h2>Account Locked</h2>
      <p>Hello {{userName}},</p>
      <p>Your account has been locked due to multiple failed login attempts.</p>
      <p>Your account will be automatically unlocked in 15 minutes.</p>
      <p>If you didn't attempt to log in, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Account Locked

Hello {{userName}},

Your account has been locked due to multiple failed login attempts.

Your account will be automatically unlocked in 15 minutes.

If you didn't attempt to log in, please contact your administrator immediately.

This is an automated message from OpsManager.`,
    variables: ['userName'],
    isSystem: true,
  },
  {
    key: 'mfa_enabled',
    name: 'MFA Enabled Notification',
    subject: 'Multi-Factor Authentication Enabled',
    htmlBody: `
      <h2>MFA Enabled</h2>
      <p>Hello {{userName}},</p>
      <p>Multi-factor authentication has been enabled on your account.</p>
      <p>You will now need to provide a verification code when logging in.</p>
      <p>If you didn't enable MFA, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `MFA Enabled

Hello {{userName}},

Multi-factor authentication has been enabled on your account.

You will now need to provide a verification code when logging in.

If you didn't enable MFA, please contact your administrator immediately.

This is an automated message from OpsManager.`,
    variables: ['userName'],
    isSystem: true,
  },
  {
    key: 'mfa_disabled',
    name: 'MFA Disabled Notification',
    subject: 'Multi-Factor Authentication Disabled',
    htmlBody: `
      <h2>MFA Disabled</h2>
      <p>Hello {{userName}},</p>
      <p>Multi-factor authentication has been disabled on your account.</p>
      <p>If you didn't disable MFA, please contact your administrator immediately and re-enable MFA.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `MFA Disabled

Hello {{userName}},

Multi-factor authentication has been disabled on your account.

If you didn't disable MFA, please contact your administrator immediately and re-enable MFA.

This is an automated message from OpsManager.`,
    variables: ['userName'],
    isSystem: true,
  },
  {
    key: 'backup_code_used',
    name: 'Backup Code Used Warning',
    subject: 'MFA Backup Code Used',
    htmlBody: `
      <h2>Backup Code Used</h2>
      <p>Hello {{userName}},</p>
      <p>A backup code was used to log in to your account.</p>
      <p><strong>Remaining backup codes:</strong> {{remainingCodes}}</p>
      <p>If you're running low on backup codes, please generate new ones from your account settings.</p>
      <p>If you didn't use a backup code, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Backup Code Used

Hello {{userName}},

A backup code was used to log in to your account.

Remaining backup codes: {{remainingCodes}}

If you're running low on backup codes, please generate new ones from your account settings.

If you didn't use a backup code, please contact your administrator immediately.

This is an automated message from OpsManager.`,
    variables: ['userName', 'remainingCodes'],
    isSystem: true,
  },
  {
    key: 'role_changed',
    name: 'Role Changed Notification',
    subject: 'Your Role Has Been Changed',
    htmlBody: `
      <h2>Role Change Notification</h2>
      <p>Hello {{userName}},</p>
      <p>Your role has been changed from <strong>{{oldRole}}</strong> to <strong>{{newRole}}</strong>.</p>
      <p>You will need to log in again for the changes to take effect.</p>
      <p>If you did not expect this change, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Role Change Notification

Hello {{userName}},

Your role has been changed from {{oldRole}} to {{newRole}}.

You will need to log in again for the changes to take effect.

If you did not expect this change, please contact your administrator immediately.

This is an automated message from OpsManager.`,
    variables: ['userName', 'oldRole', 'newRole'],
    isSystem: true,
  },
  {
    key: 'session_revoked',
    name: 'Session Revoked Notification',
    subject: 'Session Revoked',
    htmlBody: `
      <h2>Session Revoked</h2>
      <p>Hello {{userName}},</p>
      <p>A session on your account has been revoked.</p>
      <p><strong>Device:</strong> {{deviceInfo}}</p>
      <p><strong>IP Address:</strong> {{ipAddress}}</p>
      <p>If you didn't revoke this session, please contact your administrator immediately.</p>
      <hr>
      <p><small>This is an automated message from OpsManager.</small></p>
    `,
    textBody: `Session Revoked

Hello {{userName}},

A session on your account has been revoked.

Device: {{deviceInfo}}
IP Address: {{ipAddress}}

If you didn't revoke this session, please contact your administrator immediately.

This is an automated message from OpsManager.`,
    variables: ['userName', 'deviceInfo', 'ipAddress'],
    isSystem: true,
  },
];

async function seedEmailTemplates() {
  console.log('Seeding email templates...');

  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      update: template,
      create: template,
    });
    console.log(`✓ Seeded template: ${template.name}`);
  }

  console.log('Email templates seeded successfully!');
}

seedEmailTemplates()
  .catch((e) => {
    console.error('Error seeding email templates:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
