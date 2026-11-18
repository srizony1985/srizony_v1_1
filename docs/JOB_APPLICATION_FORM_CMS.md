# CMS-managed job application form

The public job application form is generated entirely from the `job-application-form.json` CMS document. The Job Management page exposes this document through the **Job application form builder**.

## CMS capabilities

- Edit the English and Bangla form heading, introduction and submit-button labels.
- Add, edit, remove and reorder up to 40 public fields.
- Supported field types: text, email, telephone, number, date, URL, textarea, select, checkbox and private PDF resume upload.
- Configure bilingual field labels and placeholders, required/optional state, text-length and number ranges, select options and empty-option labels.
- Optionally map one field to the applicant name, email, phone, cover letter or resume system column. Mapping does not create a separate hard-coded input; it only makes the selected response available in the existing recruitment inbox columns.
- The public API validates the submitted keys and values against the currently published CMS form configuration. Removed or unknown field IDs are rejected.

## Resume handling

The resume field is optional or required according to the CMS setting. When enabled, uploads remain PDF-only, capped at 4 MB, private, rate-limited and attached through a short-lived one-time token. When the field is removed from the CMS form, the public resume upload endpoint rejects further uploads. A form without a resume field can still accept submissions.

## Compatibility and storage

The former version stored only additional questions in the CMS while name, email, phone, cover letter and resume were separately rendered in React. When a stored form has no `version: 2`, the normalizer preserves its existing custom questions and adds editable starter records for the former built-in fields. The CMS builder saves the upgraded configuration as version 2.

All submitted values are stored in `job_applications.custom_fields` as JSONB. Configured system mappings also populate the existing `name`, `email`, `phone`, `cover_letter` and `resume_url` columns so the current applicant inbox and operational reports remain compatible. Name and email columns may be blank when the CMS form no longer collects those values; duplicate-email detection runs only when a mapped email is supplied.

The runtime CMS DDL now ensures the JSONB response column and its GIN index exist, including on environments where migration 0020 has not yet been applied.
