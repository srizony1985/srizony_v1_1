console.error(`Drizzle auto-generation is disabled for this repository.

The database history is maintained as reviewed SQL migrations in ./drizzle, while several legacy/structural tables are created and evolved by those SQL files. Running drizzle-kit generate against the partial Drizzle snapshot can produce duplicate or destructive migrations.

Create a reviewed SQL migration, register it in drizzle/meta/_journal.json, and add a migration-contract test instead.`)
process.exit(1)
