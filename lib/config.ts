export function getAppName() {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Notes Codex";
}

export function getImportNotesDir() {
  return process.env.IMPORT_NOTES_DIR?.trim() || "./sample-imports";
}

export function getAdminImportSecret() {
  return process.env.ADMIN_IMPORT_SECRET?.trim() || "";
}
