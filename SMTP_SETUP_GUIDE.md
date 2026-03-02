# OTP Email Configuration Guide

## Problem
OTPs were being saved to the database but not being sent via email because SMTP credentials are not configured.

## Solution

### Option 1: Gmail with App Password (Recommended)

1. **Enable 2-Factor Authentication on Gmail**
   - Go to your Google Account (myaccount.google.com)
   - Navigate to Security
   - Enable 2-Step Verification if not already enabled

2. **Generate App Password**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Google will generate a 16-character password
   - Copy this password (remove spaces if any)

3. **Update `.env` file**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=your-email@gmail.com
   ```

### Option 2: Alternative SMTP Services

#### SendGrid
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=verified-sender@yourdomain.com
```

#### Mailgun
```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-mailgun-password
SMTP_FROM=noreply@yourdomain.mailgun.org
```

#### AWS SES
```
SMTP_HOST=email-smtp.region.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=verified-email@yourdomain.com
```

## Testing After Configuration

1. **Restart your backend server**
   ```bash
   npm start
   ```

2. **Test OTP sending**
   - Navigate to Service Provider registration
   - Click "Send OTP"
   - Check if email arrives in inbox (or spam folder)

3. **Check server logs**
   - Look for: `✅ OTP email sent successfully to [email]`
   - Or error message if SMTP fails

## Troubleshooting

### Error: "SMTP credentials are not configured"
- Verify `.env` file has all 4 SMTP variables set
- Ensure no trailing spaces in credentials
- Restart the server after changes

### Error: "421 Service Unavailable"
- SMTP port may be blocked by your firewall
- Try port 587 instead of 465
- Contact your hosting provider about SMTP port access

### Emails going to spam
- Gmail: Check spam folder first
- Add sender email to contacts
- Configure SPF/DKIM records for your domain (if using custom domain)

### Error: "Invalid credentials"
- Double-check the SMTP password (especially from Gmail App Passwords)
- Ensure no accidental spaces
- For Gmail, use the 16-character app password without spaces

## Security Notes

⚠️ **Important:**
- Never commit `.env` file to git
- Use environment variables in production
- Rotate passwords regularly
- Use App Passwords instead of main Gmail password
- Consider using a dedicated email account for automated emails

## After Deployment

When deploying to production:
1. Set environment variables on your hosting platform (Vercel, Heroku, etc.)
2. Do NOT commit `.env` to git
3. Test OTP sending in production
4. Monitor server logs for email errors
