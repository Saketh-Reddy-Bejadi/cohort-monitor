import "server-only";
import { getDb } from "../db";
import { doneKeyPattern, type Custom, type DoneMark, type Override } from "./engine.ts";
import type { Holiday, HolidayChange, HolidayFieldErrors } from "./holidays.ts";
import type { CustomInput } from "./task-input.ts";
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
    await db.collection("planner_overrides").createIndex({ key: 1 }, { unique: true });
    await db.collection("planner_customs").createIndex({ id: 1 }, { unique: true });
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
    // Clears marks, moves and tasks left behind if an earlier delete of this id stopped halfway.
    await deleteTaskDataFor(cohort.id);
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
  // A cohort made later with the same id must not inherit old ticks, moves or tasks.
  if (res.deletedCount === 1) await deleteTaskDataFor(id);
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

async function deleteTaskDataFor(cohortId: string): Promise<void> {
  const key = { $regex: doneKeyPattern(cohortId) };
  const customs = await customDocs();
  // Ticks on this cohort's one-off tasks are stored under `custom:<id>`, so find them before the tasks go.
  const customKeys = (await customs.find({ cohortId }, { projection: { id: 1 } }).toArray()).map((d) => `custom:${d.id}`);
  await Promise.all([
    (await doneMarks()).deleteMany({ $or: [{ key }, { key: { $in: customKeys } }] }),
    (await overrideDocs()).deleteMany({ key }),
    customs.deleteMany({ cohortId }),
  ]);
}

type OverrideDoc = { key: string; date: string; reason: string; by: string; at: Date };

async function overrideDocs() {
  await prepare();
  return (await getDb()).collection<OverrideDoc>("planner_overrides");
}

/** Every moved date, by task key. */
export async function listOverrides(): Promise<Record<string, Override>> {
  const docs = await (await overrideDocs()).find().toArray();
  return Object.fromEntries(docs.map((d) => [d.key, { date: d.date, reason: d.reason, by: d.by, at: d.at.toISOString() }]));
}

/** Move one task to a new date, with the reason. A second move replaces the first. */
export async function setOverride(key: string, date: string, reason: string, by: string): Promise<void> {
  if (typeof key !== "string") throw new Error("Task key must be text");
  await (await overrideDocs()).updateOne({ key }, { $set: { date, reason, by, at: new Date() } }, { upsert: true });
}

/** Go back to the date the rules give. */
export async function clearOverride(key: string): Promise<void> {
  if (typeof key !== "string") throw new Error("Task key must be text");
  await (await overrideDocs()).deleteOne({ key });
}

type CustomDoc = { id: string; title: string; date: string; cohortId?: string; owner?: string; by: string; at: Date };

async function customDocs() {
  await prepare();
  return (await getDb()).collection<CustomDoc>("planner_customs");
}

/** Every one-off task, in the shape the task engine takes. */
export async function listCustoms(): Promise<Custom[]> {
  const docs = await (await customDocs()).find().sort({ at: 1 }).toArray();
  return docs.map((d) => ({ id: d.id, title: d.title, date: d.date, cohortId: d.cohortId, owner: d.owner }));
}

/** One one-off task with who made it, so we can check who may delete it. */
export async function getCustom(id: string): Promise<(Custom & { by: string }) | null> {
  if (typeof id !== "string") throw new Error("Task id must be text");
  const d = await (await customDocs()).findOne({ id });
  return d ? { id: d.id, title: d.title, date: d.date, cohortId: d.cohortId, owner: d.owner, by: d.by } : null;
}

export async function createCustom(task: CustomInput, by: string): Promise<string> {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  await (await customDocs()).insertOne({ id, ...task, by, at: new Date() });
  return id;
}

export async function updateCustomDate(id: string, date: string): Promise<boolean> {
  if (typeof id !== "string") throw new Error("Task id must be text");
  const res = await (await customDocs()).updateOne({ id }, { $set: { date } });
  return res.matchedCount === 1;
}

export async function deleteCustom(id: string): Promise<boolean> {
  if (typeof id !== "string") throw new Error("Task id must be text");
  const res = await (await customDocs()).deleteOne({ id });
  // A ticked one-off task would leave its mark behind otherwise.
  if (res.deletedCount === 1) await (await doneMarks()).deleteOne({ key: `custom:${id}` });
  return res.deletedCount === 1;
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

/**
 * Change the holiday list: add, edit or remove one holiday. It reads the list, applies the
 * change, and saves only if nobody saved in between. If someone did, it reads again and
 * redoes the change after a short random pause, so two admins working at once never
 * lose each other's work. If it still cannot get through, it says so and nothing is lost.
 */
export async function changeHolidays(
  by: string,
  op: (list: Holiday[]) => HolidayChange,
): Promise<{ ok: true } | { ok: false; errors?: HolidayFieldErrors; message?: string }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const doc = await getHolidaysDoc();
    const result = op(doc.holidays);
    if (!result.ok) return result;
    if (await saveHolidays(result.holidays, by, doc.updated_at)) return { ok: true };
    // A random pause, so callers that collided do not collide again on the same beat.
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
  }
  return { ok: false, message: "Someone else is changing the holidays right now. Try again." };
}
