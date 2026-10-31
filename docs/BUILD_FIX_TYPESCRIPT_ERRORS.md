# Build Fix: Optional Subtitle and ES2017 Regex

## Errors addressed

1. `lib/cms/content.ts`: `collectionPageSnapshot()` can return a page without a subtitle. The page bootstrap insert now uses safe optional access and empty-string fallbacks for both language subtitles: `generated.subtitle?.en ?? ''` and `generated.subtitle?.bn ?? ''`. This removes TS18048 without assuming every collection page has a subtitle.

2. `tests/functional-contract.test.ts`: the test used the regex dotAll (`s`) flag, which is not supported by the project's configured ES2017 TypeScript target. The matcher now uses `/page\.contentComponent === 'job'[\s\S]*JobApplicationForm/`, which supports multiline matches without the ES2018 `s` flag.

## Checks performed

- Verified the updated matcher returns true against `components/pages/PageTemplate.tsx`.
- Re-ran the globally available TypeScript compiler. TS18048 and TS1501 no longer appear.
- A complete typecheck is not possible in this package workspace because dependencies and Node/React type packages are not installed; the compiler consequently reports missing module/type declaration errors unrelated to these two fixes.

## Verify in the project environment

Run after dependencies are installed:

```bash
npm ci
npm run build
```
