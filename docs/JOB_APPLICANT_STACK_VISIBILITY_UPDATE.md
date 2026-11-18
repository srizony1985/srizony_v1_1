# Job & Applications — Applicant Visibility Update

## What changed

- The Applications primary tab now shows a top-right badge with the total number of new applicants, summed from vacancy summaries.
- The Applications workspace opens on the New status. The status sub-tabs are New, Reviewing, Short-listed, Rejected, and Hired.
- New applicants are shown as a vertical stack of full-width cards, newest application first (LIFO-style order), rather than a dense table/queue.
- Selecting an application card opens the applicant detail modal, including the applied-for vacancy, category, contact information, submission date, resume, cover letter, and custom responses.
- The modal provides explicit status action buttons for all five recruitment statuses. Saving updates the card and applicant modal immediately after the API confirms success.

## Behaviour

- Status counts are recalculated from the currently loaded applications and selected vacancy filter.
- Vacancy review opens Applications on the New status for that vacancy.
- New applicant badge is visible even when Applications is not the active tab, using the new-applicant counts already returned with the vacancy summaries.
- Cards remain keyboard-accessible buttons, with separate modal status actions.

## Verification

Run:

```bash
node --test tests/jobs-applicant-stack-ui.test.mjs tests/jobs-four-tab-contract.test.mjs tests/jobs-applicant-inbox.test.mjs tests/jobs-page-stylesheet.test.mjs
```

The full Next.js build and live database/browser checks require project dependencies and a connected CMS environment.
