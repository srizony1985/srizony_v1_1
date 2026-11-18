/** JSON primitives and recursively typed JSON structures used by CMS snapshots. */
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
export type JsonRecord = Record<string, JsonValue>

/**
 * Values accepted at API, database and storage boundaries before validation.
 * Keep this wider than JsonValue for driver dates/binary fields, but avoid
 * `any`/`unknown` so callers must still narrow values before reading properties.
 */
export type ExternalValue = JsonValue | object | undefined
export type ExternalRecord = Record<string, ExternalValue>

/** PostgreSQL drivers can additionally expose Date and binary values. */
export type DatabaseValue = JsonValue | Date | Uint8Array
export type DatabaseRow = Record<string, DatabaseValue>

/** A record whose values may not yet have been supplied. */
export type OptionalJsonRecord = Record<string, JsonValue | undefined>
