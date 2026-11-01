import "server-only";
import { getDb } from "../db";
import { doneKeyPattern, type DoneMark } from "./engine.ts";
import type { Holiday } from "./holidays.ts";
import type { Cohort } from "./types.ts";

export type StoredCohort = Cohort & { updated_at?: string; updated_by?: string };

type Doc = Cohort & { updated_at?: Date; updated_by?: string };

/** The one cohort we know so far. Launch date and people are not known yet. */
const SEED: Cohort = {
  id: "aise-c4",
  name: "AISE C4",
  program: "AISE",
  kind: "Live cohort",
  status: "active",
  no_waitlist: false,
  start: "2026-10-25",
  ic_close: "2026-11-10",
  standard_from: "2026-11-11",
  enrol_close: "2026-11-12",
  ic_price: 42000,
  standard_price: 54000,
};

let ready: Promise<void> | undefined;

/** Create indexes and seed AISE C4 once ever. Deleting it later does not bring it back. */
function prepare(): Promise<void> {
  ready ??= (async () => {
    const db = await getDb();
    await db.collection("planner_cohorts").createIndex({ id: 1 }, { unique: true });
    await db.collection("planner_cohorts").createIndex({ name: 1 });
    await db.collection("planner_done").createIndex({ key: 1 }, { unique: true });
    const settings = db.collection<{ name: string }>("planner_settings");
    await settings.createIndex({ name: 1 }, { unique: true });
    // Insert the cohort first and the marker last, so a failed insert is retried
    // on the next start. If two processes start together, the unique id index
    // makes the second insert fail with 11000, which is fine.
    if (!(await settings.findOne({ name: "seed" }))) {
      try {
        await db.collection<Doc>("planner_cohorts").insertOne({ ...SEED, updated_at: new Date(), updated_by: "seed" });
      } catch (e) {
        if ((e as { code?: number }).code !== 11000) throw e;
      }
      await settings.updateOne({ name: "seed" }, { $setOnInsert: { name: "seed" } }, { upsert: true });
    }
  })().catch((e) => {
    ready = undefined;
    throw e;
  });
  return ready;
}

async function cohorts() {
  await prepare();
  return (await getDb()).collection<Doc>("planner_cohorts");
}

/** Drop Mongo's _id and turn the update time into text. */
function toCohort(doc: Doc & { _id?: unknown }): StoredCohort {
  const { _id, updated_at, updated_by, ...fields } = doc;
  void _id;
  return { ...fields, updated_at: updated_at?.toISOString(), updated_by };
}

export async function listCohorts(): Promise<StoredCohort[]> {
  const docs = await (await cohorts()).find().sort({ name: 1 }).toArray();
  return docs.map(toCohort);
}

/** An id that is not text could be a Mongo operator object, so refuse it. */
function assertId(id: unknown): asserts id is string {
  if (typeof id !== "string") throw new Error("Cohort id must be text");
}

/** The cohort without who last saved it, for people who cannot edit cohorts. */
export function withoutAuthor(c: StoredCohort): StoredCohort {
  const { updated_by, ...rest } = c;
  void updated_by;
  return rest;
}

export async function getCohort(id: string): Promise<StoredCohort | null> {
  assertId(id);
  const doc = await (await cohorts()).findOne({ id });
  return doc ? toCohort(doc) : null;
}

const meta = (by: string) => ({ updated_at: new Date(), updated_by: by });

/** Insert a new cohort. Returns false when the id is already taken. */
export async function createCohort(cohort: Cohort, by: string): Promise<boolean> {
  try {
    await (await cohorts()).insertOne({ ...cohort, ...meta(by) });
    // Clears marks left behind if an earlier delete of this id stopped halfway.
    await deleteDoneFor(cohort.id);
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

/**
 * Replace the whole cohort with this id. When `loadedAt` is given, the save only
 * goes through if nobody else saved since then, so edits do not overwrite each other.
 */
export async function replaceCohort(
  cohort: Cohort,
  by: string,
  loadedAt?: string,
): Promise<"ok" | "missing" | "stale"> {
  const col = await cohorts();
  const filter = loadedAt ? { id: cohort.id, updated_at: new Date(loadedAt) } : { id: cohort.id };
  const res = await col.replaceOne(filter, { ...cohort, ...meta(by) });
  if (res.matchedCount === 1) return "ok";
  return (await col.findOne({ id: cohort.id })) ? "stale" : "missing";
}

/** Create or replace by id. Used by the API. */
export async function upsertCohort(cohort: Cohort, by: string): Promise<void> {
  await (await cohorts()).replaceOne({ id: cohort.id }, { ...cohort, ...meta(by) }, { upsert: true });
}

export async function deleteCohort(id: string): Promise<boolean> {
  assertId(id);
  const res = await (await cohorts()).deleteOne({ id });
  // A cohort made later with the same id must not inherit old ticks.
  if (res.deletedCount === 1) await deleteDoneFor(id);
  return res.deletedCount === 1;
}

type DoneDoc = { key: string; done: boolean; by: string; at: Date };

async function doneMarks() {
  await prepare();
  return (await getDb()).collection<DoneDoc>("planner_done");
}

/** Every done mark, by task key. */
export async function listDone(): Promise<Record<string, DoneMark>> {
  const docs = await (await doneMarks()).find().toArray();
  return Object.fromEntries(docs.map((d) => [d.key, { done: d.done, by: d.by, at: d.at.toISOString() }]));
}

/** Tick or untick a task. The mark is kept when unticked, so we still know who did what. */
export async function setDone(key: string, done: boolean, by: string): Promise<void> {
  if (typeof key !== "string") throw new Error("Task key must be text");
  await (await doneMarks()).updateOne({ key }, { $set: { done, by, at: new Date() } }, { upsert: true });
}

async function deleteDoneFor(cohortId: string): Promise<void> {
  await (await doneMarks()).deleteMany({ key: { $regex: doneKeyPattern(cohortId) } });
}

async function settingsDocs() {
  await prepare();
  return (await getDb()).collection<{ name: string; holidays?: Holiday[]; updated_at?: Date; updated_by?: string }>("planner_settings");
}

/** The holiday list and when it was last saved. Empty until an admin saves one. */
export async function getHolidaysDoc(): Promise<{ holidays: Holiday[]; updated_at: string }> {
  const doc = await (await settingsDocs()).findOne({ name: "holidays" });
  return { holidays: doc?.holidays ?? [], updated_at: doc?.updated_at?.toISOString() ?? "" };
}

export async function getHolidays(): Promise<Holiday[]> {
  return (await getHolidaysDoc()).holidays;
}

/**
 * Save the holiday list. `loadedAt` is the `updated_at` the editor was opened with
 * ("" if nothing was saved yet). If someone saved since then, nothing is written and
 * this returns null, so two admins do not overwrite each other and re-date every task.
 * Returns the new `updated_at` on success.
 */
export async function saveHolidays(holidays: Holiday[], by: string, loadedAt: string): Promise<string | null> {
  const updated_at = new Date();
  const filter = { name: "holidays", updated_at: loadedAt ? new Date(loadedAt) : { $exists: false } };
  try {
    // The unique index on name turns a lost race on the first save into 11000.
    await (await settingsDocs()).updateOne(filter, { $set: { holidays, updated_at, updated_by: by } }, { upsert: true });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return null;
    throw e;
  }
  return updated_at.toISOString();
}
