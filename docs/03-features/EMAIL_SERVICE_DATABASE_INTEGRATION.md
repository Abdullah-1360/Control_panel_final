# Email Service Database Integration & TLS Fix

## Problem 1: SMTP Settings Not Used
**Issue:** Email service was reading SMTP settings from `.env` file instead of database settings configured via UI.

**Symptom:** 
- Saving SMTP settings in UI had no effect
- Emails sent to MailHog (localhost:1025) instead of configured SMTP server
- Backend logs showed "Email sent successfully" but emails not received

**Root Cause:**
The `EmailService` was initialized once on startup with settings from environment variables, never checking the database.

## Solution 1: Read SMTP Settings from Database

### Changes Made

**1. Updated `EmailService` to load settings from database:**
```typescript
// Before: Read from .env on startup
constructor(private configService: ConfigService) {
  this.initializeTransporter(); // Only runs once
}

// After: Read from database before each email
async sendEmail(options: EmailOptions): Promise<boolean> {
  const isConfigured = await this.initializeTransporter(); // Loads from DB
  // ...
}
```

**2. Added database query method:**
```typescript
private async getSmtpSettingsFromDb() {
  const settings = await this.prisma.settings.findMany({
    where: { key: { startsWith: 'smtp.' } }
  });
  
  // Decrypt encrypted fields (password)
  // Return settings object
}
```

**3. Updated `EmailModule` imports:**
```typescript
@Module({
  imports: [PrismaModule, EncryptionModule], // Added dependencies
  providers: [EmailService],
  exports: [EmailService],
})
```

### Benefits
- ✅ SMTP settings UI now works correctly
- ✅ Settings can be changed without restarting backend
- ✅ Each email uses latest settings from database
- ✅ Encrypted passwords properly decrypted

---

## Problem 2: TLS Certificate Mismatch

**Error:**
```
Error [ERR_TLS_CERT_ALTNAME_INVALID]: Hostname/IP does not match certificate's altnames: 
Host: mail.hostbreak.com. is not in the cert's altnames: 
DNS:plesk.hostbreak.com, DNS:www.plesk.hostbreak.com
```

**Root Cause:**
SMTP server hostname (`mail.hostbreak.com`) doesn't match the SSL certificate hostname (`plesk.hostbreak.com`). Common with shared hosting providers.

## Solution 2: Disable TLS Certificate Validation

### Changes Made

Added `tls.rejectUnauthorized: false` to nodemailer transporter:

```typescript
this.transporter = nodemailer.createTransport({
  host: settings.host,
  port: settings.port,
  secure: settings.secure,
  auth: { ... },
  tls: {
    // Ignore certificate validation errors
    rejectUnauthorized: false,
  },
});
```

### Security Note
⚠️ **This bypasses SSL certificate validation.** While this is acceptable for development and trusted SMTP servers, it reduces security by allowing man-in-the-middle attacks.

**For production:**
- Use the correct hostname that matches the certificate
- Or obtain a properly configured SMTP server
- Or use a managed email service (SendGrid, AWS SES, etc.)

---

## Alternative Solutions

### Option 1: Use Correct Hostname
Change SMTP host from `mail.hostbreak.com` to `plesk.hostbreak.com` (the hostname in the certificate).

### Option 2: Use Port 587 with STARTTLS
Instead of port 465 (SSL), use port 587 (STARTTLS):
- Port: 587
- Secure: false (STARTTLS will upgrade connection)

### Option 3: Use Gmail SMTP
For testing, use Gmail's SMTP server:
- Host: smtp.gmail.com
- Port: 587
- Secure: true
- Username: your-email@gmail.com
- Password: App Password (not your regular password)

**Generate Gmail App Password:**
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate password for "Mail"
5. Use generated password in SMTP settings

---

## Testing

### 1. Save SMTP Settings
1. Login as SUPER_ADMIN: admin@opsmanager.local / Password123!
2. Go to Settings → SMTP Configuration
3. Enter your SMTP details
4. Click "Save SMTP Settings"

### 2. Send Test Email
1. Enter your email address in "Recipient Email Address"
2. Click "Send Test Email"
3. Check backend logs for:
   ```
   [EmailService] Sending email via smtp.example.com:587 (secure: true)
   [EmailService] Email sent successfully: OpsManager - SMTP Test Email to you@example.com (MessageID: <...>)
   ```
4. Check your inbox (and spam folder)

### 3. Verify Database Storage
```sql
SELECT key, value, "isEncrypted" FROM settings WHERE key LIKE 'smtp.%';
```

Expected results:
- `smtp.host` - Not encrypted
- `smtp.port` - Not encrypted
- `smtp.username` - Not encrypted
- `smtp.password` - **Encrypted** ✅
- `smtp.fromAddress` - Not encrypted
- `smtp.fromName` - Not encrypted
- `smtp.secure` - Not encrypted

---

## Common SMTP Providers

### Gmail
- Host: smtp.gmail.com
- Port: 587
- Secure: true
- Requires: App Password (not regular password)

### Outlook/Office 365
- Host: smtp.office365.com
- Port: 587
- Secure: true

### SendGrid
- Host: smtp.sendgrid.net
- Port: 587
- Secure: true
- Username: apikey
- Password: Your SendGrid API key

### AWS SES
- Host: email-smtp.us-east-1.amazonaws.com
- Port: 587
- Secure: true
- Username: SMTP username from AWS
- Password: SMTP password from AWS

### MailHog (Development)
- Host: localhost
- Port: 1025
- Secure: false
- No authentication required
- Web UI: http://localhost:8025

---

## Files Modified

1. `backend/src/modules/email/email.service.ts`
   - Added `PrismaService` and `EncryptionService` dependencies
   - Changed `initializeTransporter()` to load from database
   - Added `getSmtpSettingsFromDb()` method
   - Added TLS certificate bypass
   - Improved error logging

2. `backend/src/modules/email/email.module.ts`
   - Added `PrismaModule` and `EncryptionModule` imports

---

## Troubleshooting

### Email Not Received

**Check 1: Backend Logs**
```
[EmailService] Email sent successfully: ... (MessageID: <...>)
```
If you see this, the email was sent to SMTP server.

**Check 2: Spam Folder**
Check your spam/junk folder.

**Check 3: SMTP Server Logs**
Contact your hosting provider to check their SMTP logs.

**Check 4: From Address**
Some SMTP servers require the "From" address to match your account email.

### Authentication Failed

**Error:** `Invalid login: 535 Authentication failed`

**Solutions:**
- Verify username and password are correct
- For Gmail: Use App Password, not regular password
- Check if SMTP authentication is enabled on your server

### Connection Timeout

**Error:** `Connection timeout`

**Solutions:**
- Verify SMTP host and port are correct
- Check firewall rules (port 587 or 465 must be open)
- Try alternative port (587 vs 465)

### TLS/SSL Errors

**Error:** `ERR_TLS_CERT_ALTNAME_INVALID` or `CERT_HAS_EXPIRED`

**Solutions:**
- Use `rejectUnauthorized: false` (already implemented)
- Use correct hostname that matches certificate
- Contact hosting provider for correct SMTP hostname

---

## Environment Variables (Legacy)

The `.env` file still contains SMTP settings for backward compatibility:

```env
# SMTP (MailHog for development)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@opsmanager.local"
```

**Note:** These are **no longer used** by the email service. All SMTP settings are now read from the database.

You can keep these for reference or remove them.

---

**Status:** ✅ FIXED
**Date:** February 8, 2026
**Tested:** Gmail SMTP, Shared Hosting SMTP
