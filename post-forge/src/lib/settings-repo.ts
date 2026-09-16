/**
 * Settings-defaults store: a single `settings` document holding generation
 * defaults (`GenerationOptions`) applied when a run doesn't override them.
 *
 * No API keys are stored here — those are env-only per the locked decision
 * in CLAUDE.md ("Settings shows integration status + test-connection;
 * never key entry").
 */

import { getDb } from "./mongo";
import type { GenerationOptions } from "./state";

const SETTINGS_ID = "default";
const SETTINGS_COLLECTION = "settings";

const DEFAULT_SETTINGS: GenerationOptions = {
  tone: "informative",
  length: "medium",
};

type SettingsDoc = GenerationOptions & { _id: string };

async function settingsCollection() {
  const db = await getDb();
  return db.collection<SettingsDoc>(SETTINGS_COLLECTION);
}

/** Returns generation defaults, falling back to sensible built-ins for any unset field. */
export async function getSettings(): Promise<GenerationOptions> {
  const settings = await settingsCollection();
  const doc = await settings.findOne({ _id: SETTINGS_ID });
  if (!doc) {
    return { ...DEFAULT_SETTINGS };
  }
  const { _id: _unused, ...rest } = doc;
  void _unused;
  return { ...DEFAULT_SETTINGS, ...rest };
}

/** Upserts a partial set of generation defaults into the singleton settings doc. */
export async function putSettings(partial: Partial<GenerationOptions>): Promise<GenerationOptions> {
  const settings = await settingsCollection();
  await settings.updateOne(
    { _id: SETTINGS_ID },
    { $set: partial },
    { upsert: true }
  );
  return getSettings();
}
