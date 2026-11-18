# Srizony Foundation — Recruitment Email & Vacancy Lifecycle

## Supported runtime

The project runtime pin is Node.js `24.21.0` (`.nvmrc`). The Drive exporter and recruitment mailer use Node-compatible ESM/CommonJS interop and built-in `fetch`. Run `nvm use` before installing dependencies and running the production build.

## Public application flow

1. A published vacancy displays **Apply now** only while its deadline remains open.
2. The Apply button is disabled after 23:59:59.999 Bangladesh time on the deadline date.
3. The server independently checks the vacancy status, canonical career route and deadline before writing the application. A client-side button state is not treated as authorization.
4. Applicant name and email are required system fields. The CMS form normalizer restores them for older saved forms, and the Form Builder prevents either field from being removed or made optional.
5. The application is committed first. Its confirmation email is recorded in `job_email_outbox` and attempted immediately. Email delivery failure does not erase a valid application.

The applicant receipt says that the application was successfully submitted to Srizony Foundation administration and that the applicant will be notified after review. It includes an application reference.

## Applicant status emails

A real status transition creates a separate outbox event (repeating the same status without a transition does not send a duplicate):

- **Reviewing:** application is being reviewed for the vacancy title and position.
- **Short-listed:** congratulates the applicant and says the interview schedule for the role will be published soon.
- **Rejected:** informs the applicant that the application was rejected for the vacancy title and position.
- **Hired:** sends a selection confirmation and onboarding follow-up note.

The status record is saved independently from mail delivery. If mail is temporarily unavailable, the outbox preserves the message for retry.

## Gmail mailbox + App Password configuration (server only)

**Important protocol distinction:** a Google App Password cannot authenticate requests to the Gmail REST API (`users.messages.send`). Google requires OAuth 2.0 credentials for Gmail REST API requests. To honor the requested actual-email + App Password setup without OAuth refresh tokens, this project sends email through **Gmail SMTP using Nodemailer** (`smtp.gmail.com:465`, implicit TLS). This is authenticated Gmail sending, but it is not the Gmail REST API. See Google's [Gmail API authorization guide](https://developers.google.com/workspace/gmail/api/auth/web-server), [Gmail SMTP settings](https://developers.google.com/workspace/gmail/imap/imap-smtp), and [App Password help](https://support.google.com/mail/answer/185833).

Add these values to the deployment's server environment (and to local `.env.local` for development). Never add them to `NEXT_PUBLIC_*` variables or client code.

```dotenv
GMAIL_USER=no-reply@srizony.admin
GMAIL_APP_PASSWORD=your-16-character-google-app-password
# Optional; omit to send as GMAIL_USER. A different address must be a verified Send-As alias.
# JOB_MAIL_FROM="Srizony Foundation <no-reply@srizony.admin>"
JOB_MAIL_REPLY_TO=recruitment@srizony.admin
CRON_SECRET=replace-with-a-long-random-secret
```

Google account setup:

1. Sign in to the actual sender mailbox (for example, `no-reply@srizony.admin`).
2. Enable **2-Step Verification** on that Google account. App Passwords are available only for eligible accounts with 2-Step Verification enabled; some Workspace policies or account configurations may disable the feature.
3. Open Google Account → Security → App passwords, create an App Password for this application, and copy the generated 16-character value.
4. Set `GMAIL_USER` to that exact mailbox and `GMAIL_APP_PASSWORD` to its App Password in the server environment. The mailer removes spaces from the grouped App Password value automatically.
5. By default, mail is sent from `GMAIL_USER`. If `JOB_MAIL_FROM` is a different address, configure and verify it as a Gmail / Google Workspace **Send mail as** alias for the authenticated mailbox first; otherwise Gmail may rewrite the From address.
6. Deploy the variables to every production environment that should send mail, then redeploy so the server runtime receives them.

The repository cannot create the mailbox, enable 2-Step Verification, generate the App Password, or provision a Send-As alias. If `no-reply@srizony.admin` is not an actual Google mailbox or verified alias on a domain controlled by the Foundation, use the real authorized sender address instead. Keep the App Password private, rotate it if exposed, and never commit it to source control.

## Outbox and retry behaviour

- The message is written to `job_email_outbox` before an immediate Gmail SMTP attempt.
- `event_key` is unique to the application event / status transition / interview revision, preventing repeated admin actions from creating duplicate outbox rows.
- Temporary delivery errors are retained with exponential retry delays; messages stop retrying after 12 attempts and are marked failed for administrator review.
- The protected `/api/cron/maintenance` endpoint also processes pending job email rows. `CRON_SECRET` must be configured for the deployment cron.
- The current `vercel.json` maintenance cron runs once per day. Initial delivery is attempted immediately; a transient failure can therefore wait until the next maintenance run before its next retry. Increase the cron cadence only if the hosting plan supports it.

## Vacancy lifecycle

The CMS **Job & Applications → Vacancies** workspace has four lifecycle tabs:

| Stage | Entry condition | Main actions |
|---|---|---|
| New | Deadline has not passed | Create, view and edit vacancy; extend deadline is available after the deadline |
| Review | Deadline has passed and no interview is scheduled | Review details and applicants, extend deadline, schedule interviews |
| Interview | A schedule exists and is active | View per-applicant slots, hire/reject, extend end time, reschedule and close |
| Processed | Interview is closed after all shortlisted applicants are resolved | View vacancy and applicant records |

Stage transitions are computed from the database deadline and interview state. The CMS refreshes the stage list periodically and when the page regains focus; no scheduled background job is needed to move a vacancy from New to Review.

## Interview scheduling

- Only currently short-listed applications receive an appointment.
- Applicant order is application submission time ascending (oldest submission first), then application ID.
- Every person gets a distinct consecutive slot: `start + (slot number × minutes per applicant)`.
- The suggested interview end is `start + (short-listed count × minutes per applicant)`.
- Server validation repeats the duration/count check and rejects an insufficient time window.
- Scheduling or rescheduling sends each short-listed applicant an email containing their own appointment time.
- Rescheduling increments the interview revision and generates a new outbox event for each currently short-listed applicant.
- Appointment history for applicants already marked Hired or Rejected is retained when a schedule is revised.
- Closing is blocked until every short-listed applicant is marked Hired or Rejected. The close operation locks the vacancy interview and its applications in a consistent order, preventing a concurrent status update from leaving the interview closed with an unresolved short-list. A closed process cannot accept a new Short-listed status.

The repository uses Drizzle's Neon HTTP driver. That driver does not support interactive `db.transaction()` calls, so schedule and appointment changes are issued as one PostgreSQL statement with data-modifying CTEs. This prevents a partial schedule from being committed.

## Database deployment

Run the migration before using this workflow in production:

```bash
npm install
npm run db:migrate
npm run build
```

Migration: `drizzle/0023_job_recruitment_workflow_and_email_outbox.sql`

It adds the application status-change timestamp, persistent email outbox, vacancy interview record and per-applicant appointment records. The application validates these migrated tables read-only; it does not create or alter them at request time.

## Operational verification checklist

- [ ] Confirm `GMAIL_USER` is the actual sender mailbox and `GMAIL_APP_PASSWORD` belongs to that same account.
- [ ] Send a test email and confirm the actual From header is the authenticated mailbox or its verified Send-As alias.
- [ ] Submit a test application and confirm receipt email and reference number.
- [ ] Attempt a duplicate submission and confirm it is rejected.
- [ ] Set a vacancy deadline in the past and confirm both the public Apply action and server endpoint reject submissions.
- [ ] Change an applicant to Reviewing, Short-listed and Rejected; confirm the correct email is delivered for each actual transition.
- [ ] Short-list multiple applicants, schedule a window, and confirm each email has a different sequential slot.
- [ ] Reschedule and confirm new appointment emails are sent.
- [ ] Hire/reject every shortlisted applicant and close the interview; confirm the vacancy moves to Processed.
- [ ] Temporarily disable mail credentials and verify messages remain in the outbox, then restore credentials and verify retry delivery.
