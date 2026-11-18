# Gmail App Password setup for Srizony CMS

## Chosen delivery method

This project uses Nodemailer with Gmail SMTP and an App Password. It does not use OAuth2 refresh tokens or the Gmail REST API.

An App Password is not a Gmail REST API credential. Google's Gmail API REST endpoints require OAuth 2.0 authorization. Gmail SMTP is the compatible option when the requested credential is the actual mailbox email address plus App Password.

## Environment

```dotenv
GMAIL_USER=no-reply@srizony.admin
GMAIL_APP_PASSWORD=your-16-character-google-app-password
# Optional; if used, this must be a verified Send-As alias on this Gmail account.
# JOB_MAIL_FROM="Srizony Foundation <no-reply@srizony.admin>"
JOB_MAIL_REPLY_TO=recruitment@srizony.admin
CRON_SECRET=replace-with-a-long-random-secret
```

All values are server-only. Never use `NEXT_PUBLIC_` prefixes. Never commit the App Password.

## Generate an App Password

1. Sign in to the Google mailbox that will send recruitment notifications.
2. Enable 2-Step Verification.
3. Open Google Account → Security → App passwords.
4. Generate a dedicated password for Srizony CMS and store it in the production secret manager.
5. Set `GMAIL_USER` to the same mailbox and `GMAIL_APP_PASSWORD` to the generated value.
6. Deploy/restart the application and submit a test application to verify delivery.

App Password availability can be restricted by Workspace admin policy or account type. The mailbox/domain must already exist. To send from `no-reply@srizony.admin`, that must be the actual authenticated mailbox or a verified Send-As alias.

## Transport details

- Host: `smtp.gmail.com`
- Port: `465`
- Security: implicit TLS
- Authentication: mailbox email + App Password
- Library: Nodemailer

The persistent `job_email_outbox` remains unchanged: the application event is stored before delivery, immediate send is attempted, and failures remain retryable through the maintenance worker.

## References

- [Google: Gmail API server-side authorization](https://developers.google.com/workspace/gmail/api/auth/web-server)
- [Google: Gmail IMAP, POP and SMTP settings](https://developers.google.com/workspace/gmail/imap/imap-smtp)
- [Google Account Help: App Passwords](https://support.google.com/mail/answer/185833)
- [Nodemailer: Using Gmail](https://nodemailer.com/guides/using-gmail)
