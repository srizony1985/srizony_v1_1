# Build fix: social brand icon imports

## Problem

The Next.js/Turbopack build failed in `components/ui/NavBar.tsx` because `lucide-react` does not export the brand icons `Facebook`, `Instagram`, `Linkedin`, or `Youtube`. Turbopack reports these as missing static exports for both client and SSR bundles.

## Change

- Keep `ChevronDown`, `Heart`, `Menu`, `Moon`, `Sun`, and `X` imported from `lucide-react`.
- Import `SiFacebook`, `SiInstagram`, `SiLinkedin`, and `SiYoutube` from `react-icons/si` for the social links.
- Update the social icon map to use those four brand components.
- `react-icons` was already present in `package.json` and `package-lock.json`, and the footer already imports `FaLinkedin` from `react-icons/fa`; no dependency changes are needed.
- Add `tests/navbar-social-icons.test.ts` to guard against reintroducing brand icons into the Lucide import.

## Verification

- The changed source and all 211 existing TypeScript/TSX files (plus the new test) pass TypeScript syntax transpilation with TypeScript 5.8.3.
- Source scan confirms the Navbar no longer imports social brand icons from `lucide-react`.
- The full Next.js build was not run in this repair environment because project dependencies are not installed here. Run `npm ci && npm run build` in the project directory to confirm Turbopack bundling with the local lockfile.


## Follow-up fix: LinkedIn icon export

The subsequent Turbopack build reported that `SiLinkedin` is not exported by the installed `react-icons/si` package version. The navbar now imports `FaLinkedin` from `react-icons/fa`, which is already used by `components/ui/Footer.tsx`, and uses that icon for LinkedIn while retaining the Simple Icons exports for Facebook, Instagram, and YouTube. The navbar regression test asserts that the unavailable `SiLinkedin` symbol is not imported.
