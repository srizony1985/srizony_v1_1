import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const shell = read('app/admin/dashboard/_components/Shell.tsx')
const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
const donationForm = read('components/ui/DonationForm.tsx')
const donationApi = read('app/api/donations/initiate/route.ts')
const css = read('app/globals.css')

test('CMS sidebar no longer exposes UI Text & Labels', () => {
  assert.doesNotMatch(shell, /key:\s*['"]ui-content['"]|label:\s*['"]UI Text & Labels['"]|href:\s*['"]\/admin\/dashboard\/ui-content['"]/) 
})

test('Page Builder no longer renders Homepage Hero Settings', () => {
  assert.doesNotMatch(pageBuilder, /LandingGlobalEditor|Homepage Hero Settings|page-builder-landing-hero/)
  assert.match(pageBuilder, /existing site-wide hero copy and autoplay configuration remain in effect/i)
})

test('Anonymous donations do not render or submit donor personal details', () => {
  assert.match(donationForm, /\{!anonymous \? <div className=\{\"sf-donation-fields\"\}>/)
  assert.match(donationForm, /\{ amount: value, method, anonymous: true \}/)
  assert.match(donationForm, /setEmail\(''\)[\s\S]*setPhone\(''\)/)
  assert.match(donationForm, /No personal information is needed\./)
})

test('Donation API stores no anonymous donor PII and uses Foundation gateway contact', () => {
  assert.match(donationApi, /email: z\.email\(\)\.max\(254\)\.optional\(\)/)
  assert.match(donationApi, /phone: z\.string\(\)\.trim\(\)\.regex\(\/\^\\\+\?\[0-9\]\{7,20\}\$\/\)\.optional\(\)/)
  assert.match(donationApi, /email: body\.anonymous \? '' :/)
  assert.match(donationApi, /phone: body\.anonymous \? '' :/)
  assert.match(donationApi, /FALLBACK_CONTACT\.email/)
  assert.match(donationApi, /FALLBACK_CONTACT\.primaryPhone/)
  assert.match(donationApi, /cus_name: gatewayCustomer\.name, cus_email: gatewayCustomer\.email, cus_phone: gatewayCustomer\.phone/)
})

test('Light mode gives slug hero breadcrumbs and donation actions stronger contrast', () => {
  assert.match(css, /html\[data-mode="light"\] \.sf-main \.sf-banner:not\(\.sf-banner--plain\) \.sf-crumbs ol/)
  assert.match(css, /html\[data-mode="light"\] \.sf-main \.sf-banner--plain \.sf-crumbs ol/)
  assert.match(css, /html\[data-mode="light"\] \.sf-main \.sf-donation-chip-on/)
  assert.match(css, /html\[data-mode="light"\] \.sf-main \.sf-donation-submit/)
})
