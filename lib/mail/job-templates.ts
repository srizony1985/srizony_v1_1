import type { JobMailMessage } from './job-mailer'

export type JobMailTemplate = JobMailMessage & { eventKey: string; applicationId: number }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] || character)
}

function frame(title: string, paragraphs: string[]) {
  const safeTitle = escapeHtml(title)
  const htmlParagraphs = paragraphs.map((paragraph) => `<p style="margin:0 0 16px;line-height:1.65;color:#253044">${escapeHtml(paragraph)}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;padding:28px 12px;background:#f4f6f8;font-family:Arial,sans-serif"><main style="max-width:600px;margin:0 auto;padding:30px 28px;background:#fff;border:1px solid #e5e9ef;border-radius:14px"><p style="margin:0 0 12px;color:#c62828;font-size:12px;font-weight:700;letter-spacing:1px">SRIZONY FOUNDATION</p><h1 style="margin:0 0 22px;color:#152235;font-size:22px;line-height:1.3">${safeTitle}</h1>${htmlParagraphs}<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #e5e9ef;color:#667085;font-size:12px;line-height:1.6">This is an automated recruitment message from Srizony Foundation. Please do not reply to this address.</p></main></body></html>`
}

function formatDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Dhaka',
  }).format(date) + ' (Bangladesh time)'
}

export function applicationReceivedEmail(input: {
  applicationId: number; name: string; email: string; jobTitle: string; jobRole: string
}): JobMailTemplate {
  const position = [input.jobTitle, input.jobRole].filter(Boolean).join(' — ')
  const reference = `SF-JOB-${String(input.applicationId).padStart(6, '0')}`
  const paragraphs = [
    `Dear ${input.name || 'Applicant'},`,
    `Your application has been successfully submitted to the Srizony Foundation administration for ${position}.`,
    'You will be notified once we review your application.',
    `Your application reference is ${reference}. Please keep it for your records.`,
  ]
  return {
    eventKey: `job-application:${input.applicationId}:confirmation`,
    applicationId: input.applicationId,
    to: input.email,
    subject: `Application received — ${input.jobTitle}`,
    text: `SRIZONY FOUNDATION\n\n${paragraphs.join('\n\n')}\n\nThis is an automated recruitment message.`,
    html: frame('Application received successfully', paragraphs),
  }
}

export function applicationStatusEmail(input: {
  applicationId: number; transitionKey: string; name: string; email: string;
  jobTitle: string; jobRole: string; status: 'reviewing' | 'shortlisted' | 'rejected' | 'hired'
}): JobMailTemplate {
  const position = [input.jobTitle, input.jobRole].filter(Boolean).join(' — ')
  const paragraphs = input.status === 'reviewing'
    ? [`Dear ${input.name || 'Applicant'},`, `Your application is being reviewed for the ${position}.`, 'We will contact you when there is an update.']
    : input.status === 'shortlisted'
      ? [`Dear ${input.name || 'Applicant'},`, `Congratulations! Your application has been short-listed for the ${position}.`, 'The interview schedule for this role will be published soon.']
      : input.status === 'rejected'
        ? [`Dear ${input.name || 'Applicant'},`, `Sorry! Your application has been rejected for the ${position}.`, 'Thank you for your interest in Srizony Foundation and for the time you invested in applying.']
        : [`Dear ${input.name || 'Applicant'},`, `Congratulations! You have been selected for the ${position} at Srizony Foundation.`, 'Our administration will contact you with the next onboarding steps.']
  const title = input.status === 'reviewing' ? 'Application under review'
    : input.status === 'shortlisted' ? 'You have been short-listed'
      : input.status === 'rejected' ? 'Application update' : 'Congratulations on your selection'
  return {
    eventKey: `job-application:${input.applicationId}:status:${input.status}:${input.transitionKey}`,
    applicationId: input.applicationId,
    to: input.email,
    subject: `${title} — ${input.jobTitle}`,
    text: `SRIZONY FOUNDATION\n\n${paragraphs.join('\n\n')}\n\nThis is an automated recruitment message.`,
    html: frame(title, paragraphs),
  }
}

export function interviewAppointmentEmail(input: {
  applicationId: number; interviewId: number; revision: number; name: string; email: string;
  jobTitle: string; jobRole: string; startsAt: string; endsAt: string; rescheduled: boolean
}): JobMailTemplate {
  const position = [input.jobTitle, input.jobRole].filter(Boolean).join(' — ')
  const appointment = `${formatDateTime(input.startsAt)} to ${formatDateTime(input.endsAt)}`
  const paragraphs = input.rescheduled
    ? [`Dear ${input.name || 'Applicant'},`, `The interview schedule for ${position} has changed. Your new interview appointment is ${appointment}.`, 'Please join or arrive on time. If you are unable to attend, contact the recruitment administration.']
    : [`Dear ${input.name || 'Applicant'},`, `Your interview for ${position} is scheduled for ${appointment}.`, 'Please join or arrive on time. If you are unable to attend, contact the recruitment administration.']
  const title = input.rescheduled ? 'Your interview has been rescheduled' : 'Your interview is scheduled'
  return {
    eventKey: `job-interview:${input.interviewId}:revision:${input.revision}:application:${input.applicationId}`,
    applicationId: input.applicationId,
    to: input.email,
    subject: `${title} — ${input.jobTitle}`,
    text: `SRIZONY FOUNDATION\n\n${paragraphs.join('\n\n')}\n\nThis is an automated recruitment message.`,
    html: frame(title, paragraphs),
  }
}
