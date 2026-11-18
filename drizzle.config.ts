import { createRequire } from 'node:module'
import { defineConfig } from 'drizzle-kit'


const require = createRequire(`${process.cwd()}/drizzle.config.ts`)
const { loadEnvConfig } = require('@next/env') as typeof import('@next/env')
loadEnvConfig(process.cwd())

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
