/**
 * Compare a snapshot's source column type with the migrated target type.
 * Permit exact matches and safe PostgreSQL widening from varchar(n) to text.
 * Do not permit narrowing, unknown casts, or varchar length mismatches.
 */
export function compareSnapshotColumnType(declaredDataType, actualDataType, actualCharacterMaximumLength) {
  const match = String(declaredDataType || '').match(/^(.+?)(?:\((\d+)\))?$/)
  if (!match || !actualDataType) {
    return { compatible: false, kind: 'type', declaredBaseType: null, declaredLength: null }
  }

  const declaredBaseType = match[1].trim()
  const declaredLength = match[2] ? Number(match[2]) : null

  if (declaredBaseType === actualDataType) {
    if (declaredLength !== null && Number(actualCharacterMaximumLength) !== declaredLength) {
      return { compatible: false, kind: 'length', declaredBaseType, declaredLength }
    }
    return { compatible: true, kind: 'exact', declaredBaseType, declaredLength }
  }

  // A varchar(n) source value always fits in PostgreSQL TEXT without truncation.
  if (
    declaredBaseType === 'character varying' &&
    declaredLength !== null &&
    actualDataType === 'text' &&
    actualCharacterMaximumLength == null
  ) {
    return { compatible: true, kind: 'safe-widening', declaredBaseType, declaredLength }
  }

  return { compatible: false, kind: 'type', declaredBaseType, declaredLength }
}
