# Job & Applications / Site Content UI and Workflow Refactor

Date: 2026-11-09

## Site Content workspace

### Desktop layout

- The page-level Site Content toolbar remains fixed at the top of the CMS page frame.
- The workspace below is a two-column `minmax(0, 1fr) minmax(0, 1fr)` grid, giving the listing and editor equal shares of the available width.
- The left listing panel has its own fixed toolbar, independently scrollable table body, sticky table headings, and pinned selection/help footer.
- The right editor panel has its own fixed card header, independently scrollable form body, and sticky form actions.
- `overscroll-behavior: contain` prevents wheel/touch scrolling in one pane from chaining into the other pane or the parent page.
- Wide tables can still scroll horizontally inside their own table scroller.

### Mobile layout

Below the desktop breakpoint, the two panes intentionally stack vertically. The table and editor retain their own bounded scroll regions; the outer page frame can scroll between the two panels.

### Selection and unsaved changes

- Searching no longer resets the selected content record or closes its editor.
- Existing records open in a read-only preview. The user chooses **Edit** to enter edit mode; new records open in edit mode.
- Switching record or content type prompts before discarding unsaved edits.
- Deleting or bulk-hiding the selected dirty record warns about the draft. The editor is unmounted only after the server confirms the hide/delete action, preventing a stale internal editor draft from being re-marked dirty.
- The single-row visibility action is disabled while that row has unsaved edits.

## Job & Applications workflow

- Vacancy list includes local search and visibility filters (all, published, draft, hidden).
- Applicant review includes status tabs, applicant search across contact data, cover letter and custom responses, and sorting by date or applicant name.
- Selecting an applicant opens a full profile with contact details, applied vacancy/category, date, CV link, cover letter, and additional form responses.
- Status updates use typed status values validated by the API route; pending state is tracked per applicant, so multiple different applicant rows can be updated concurrently without clearing another row's busy indicator.
- A successful status update synchronizes the open applicant profile, refreshes vacancy counts, and refreshes the inbox when applicable.
- The application form editor reports saved/unsaved state, protects dirty form changes on reload/removal, and validates mappings, field IDs, input types, options, and numeric/character ranges before saving.
- The UI makes the current API limit visible: applicant review indicates when the latest 2,000 records are loaded; the inbox notes when the total count exceeds the loaded sample.

## API and data notes

- This refactor uses the existing typed API modules and server routes. It does not introduce client-side direct database access.
- Recruitment status values remain `new`, `reviewing`, `shortlisted`, `rejected`, and `hired`.
- No database migration or production data mutation was performed as part of this source refactor.

## Validation performed

- TypeScript/TSX syntax transpilation checks passed for the seven modified TS/TSX files.
- PostCSS parsed `app/globals.css` successfully (4,776 top-level nodes/rules at final validation).
- Static verification confirmed the dirty bulk-hide success path closes the edited pane only after the API call succeeds.
- Static verification confirmed all applicant status UI controls use per-applicant busy state.
- Full TypeScript semantic checking, Next.js production build, and browser interaction tests were not run because project dependencies (`node_modules`) were not installed in the supplied archive and there is no connected test database/browser session.
