import 'server-only'
import nodemailer from 'nodemailer'

export type JobMailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

export type JobMailDelivery = { configured: false } | { configured: true; messageId: string }

let gmailTransporter: ReturnType<typeof nodemailer.createTransport> | null = null

function credentials() {
  const user = process.env.GMAIL_USER?.trim() || ''
  // Google displays App Passwords grouped with spaces; SMTP expects the compact value.
  const appPassword = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
  return { user, appPassword }
}

export function isJobMailConfigured() {
  const config = credentials()
  return Boolean(config.user && config.appPassword)
}

/**
 * Gmail App Passwords authenticate Gmail SMTP, not the Gmail REST API.
 * Keep this transport server-only and never expose credentials to client code.
 */
function getGmailTransporter() {
  if (gmailTransporter) return gmailTransporter

  const config = credentials()
  if (!config.user || !config.appPassword) return null

  gmailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: config.user,
      pass: config.appPassword,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    tls: { minVersion: 'TLSv1.2' },
  })

  return gmailTransporter
}

export async function deliverJobMail(message: JobMailMessage): Promise<JobMailDelivery> {
  const config = credentials()
  if (!config.user || !config.appPassword) return { configured: false }

  const transporter = getGmailTransporter()
  if (!transporter) return { configured: false }

  // Use the authenticated Gmail mailbox as the default sender. A different
  // JOB_MAIL_FROM must be configured as a verified Gmail/Workspace Send-As alias.
  const from = process.env.JOB_MAIL_FROM?.trim()
    || `Srizony Foundation <${config.user}>`

  const result = await transporter.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: process.env.JOB_MAIL_REPLY_TO?.trim() || config.user,
    headers: {
      'X-Entity-Ref-ID': `srizony-job-${Date.now().toString(36)}`,
      'Auto-Submitted': 'auto-generated',
    },
  })

  return { configured: true, messageId: String(result.messageId || '') }
}
