# SMTP Relay Error Fix - "550 Relay is not allowed"

## Error Message
```
[EmailService] Failed to send email: OpsManager - SMTP Test Email to abdullahshahid906@gmail.com
[EmailService] Error details: Can't send mail - all recipients were rejected: 550 <abdullahshahid906@gmail.com> Relay is not allowed
[EmailService] Error code: EENVELOPE
```

## What This Means
The SMTP server is **rejecting** your email because it doesn't allow "relaying" (sending emails to external domains). This is an anti-spam protection.

## Common Causes & Solutions

### 1. Authentication Failed ❌
**Problem:** Username or password is incorrect.

**Check:**
- Verify username is correct (usually your full email address)
- Verify password is correct
- For Gmail: Use **App Password**, not your regular password

**Solution:**
```
Settings → SMTP Configuration
- Username: your-full-email@domain.com (not just "username")
- Password: Your actual SMTP password or App Password
```

---

### 2. From Address Doesn't Match ❌
**Problem:** Many SMTP servers require the "From" address to match your authenticated email.

**Example:**
```
Authenticated as: user@hostbreak.com
From Address: noreply@opsmanager.local  ❌ MISMATCH
```

**Solution:**
```
Settings → SMTP Configuration
- From Email Address: user@hostbreak.com (same as username)
- From Name: OpsManager (can be anything)
```

---

### 3. SMTP Server Doesn't Allow Relay ❌
**Problem:** Your SMTP server is configured to only send emails to its own domain.

**Example:**
```
Your domain: hostbreak.com
Sending to: abdullahshahid906@gmail.com  ❌ External domain
```

**Solution:**
Contact your hosting provider to:
- Enable SMTP relay for authenticated users
- Or use a different SMTP server that allows relay

---

### 4. Wrong SMTP Port 🔧
**Problem:** Using wrong port for your authentication method.

**Ports:**
- **Port 25:** Unencrypted, often blocked by ISPs
- **Port 465:** SSL/TLS (secure: true)
- **Port 587:** STARTTLS (secure: false, then upgrades)

**Recommended Settings:**
```
Port: 587
Secure: false (STARTTLS)
```

Or:
```
Port: 465
Secure: true (SSL/TLS)
```

---

## Recommended Solutions

### Option 1: Use Gmail SMTP (Easiest) ✅

**Step 1: Generate App Password**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to "App Passwords"
4. Generate password for "Mail"
5. Copy the 16-character password

**Step 2: Configure SMTP**
```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: [16-character app password]
From Address: your-email@gmail.com
From Name: OpsManager
Secure: false (STARTTLS)
```

**Why Gmail?**
- ✅ Reliable and fast
- ✅ Allows relay to any email address
- ✅ Free for low volume
- ✅ No certificate issues

---

### Option 2: Fix Your Current SMTP Server

**Step 1: Match From Address to Username**
```
Username: user@hostbreak.com
From Address: user@hostbreak.com  ✅ MATCH
```

**Step 2: Try Port 587 with STARTTLS**
```
Port: 587
Secure: false
```

**Step 3: Contact Hosting Provider**
Ask them to:
- Enable SMTP relay for authenticated users
- Confirm correct SMTP hostname
- Confirm correct port and security settings

---

### Option 3: Use SendGrid (Production) ✅

**Free Tier:** 100 emails/day

**Step 1: Sign up at https://sendgrid.com**

**Step 2: Create API Key**
1. Go to Settings → API Keys
2. Create API Key with "Mail Send" permission
3. Copy the API key

**Step 3: Configure SMTP**
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey (literally "apikey")
Password: [Your SendGrid API key]
From Address: verified-sender@yourdomain.com
From Name: OpsManager
Secure: false
```

**Step 4: Verify Sender**
SendGrid requires sender verification:
1. Go to Settings → Sender Authentication
2. Verify your email address or domain

---

## Testing Checklist

### Before Testing
- [ ] Username is full email address
- [ ] Password is correct (App Password for Gmail)
- [ ] From Address matches username
- [ ] Port is 587 or 465
- [ ] Secure setting matches port (587=false, 465=true)

### Test Steps
1. Save SMTP settings
2. Check backend logs for connection details:
   ```
   [EmailService] Sending email via smtp.gmail.com:587 (secure: false)
   [EmailService] From: OpsManager <your-email@gmail.com>, To: test@example.com
   [EmailService] Auth: Yes
   ```
3. Send test email
4. Check logs for success or error details

### If Still Failing
Check backend logs for:
- `Error code: EAUTH` → Authentication failed (wrong username/password)
- `Error code: EENVELOPE` → Relay not allowed (from address mismatch)
- `Error code: ETIMEDOUT` → Connection timeout (wrong host/port)
- `Error code: ECONNREFUSED` → Connection refused (wrong port or firewall)

---

## Quick Reference: Common SMTP Settings

### Gmail
```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: [App Password]
From: your-email@gmail.com
Secure: false
```

### Outlook/Office 365
```
Host: smtp.office365.com
Port: 587
Username: your-email@outlook.com
Password: [Your password]
From: your-email@outlook.com
Secure: false
```

### SendGrid
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [API Key]
From: [Verified sender]
Secure: false
```

### Shared Hosting (cPanel/Plesk)
```
Host: mail.yourdomain.com
Port: 587
Username: user@yourdomain.com
Password: [Email password]
From: user@yourdomain.com
Secure: false
```

---

## Files Modified
- `backend/src/modules/email/email.service.ts` - Added detailed error logging
- `frontend/components/dashboard/smtp-settings-view.tsx` - Fixed controlled input warning

---

**Status:** 🔧 TROUBLESHOOTING
**Date:** February 8, 2026
**Next Step:** Use Gmail SMTP or match From Address to Username
