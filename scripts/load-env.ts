import { createRequire } from 'node:module'

const require = createRequire(`${process.cwd()}/scripts/load-env.ts`)
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env')

/** Load Next.js-compatible environment files once for standalone maintenance commands. */
loadEnvConfig(process.cwd())
