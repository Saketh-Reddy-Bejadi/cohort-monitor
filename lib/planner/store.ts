import "server-only";
import { getDb } from "../db";
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
    const settings = db.collection<{ name: string }>("planner_settings");
    await settings.createIndex({ name: 1 }, { unique: true });
    // The unique index makes this safe when two processes start together:
    // only one of them inserts the "seed" marker, so only one seeds.
    const res = await settings.updateOne({ name: "seed" }, { $setOnInsert: { name: "seed" } }, { upsert: true });
    if (res.upsertedCount === 1) {
      await db.collection<Doc>("planner_cohorts").insertOne({ ...SEED, updated_at: new Date(), updated_by: "seed" });
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

export async function getCohort(id: string): Promise<StoredCohort | null> {
  const doc = await (await cohorts()).findOne({ id });
  return doc ? toCohort(doc) : null;
}

const meta = (by: string) => ({ updated_at: new Date(), updated_by: by });

/** Insert a new cohort. Returns false when the id is already taken. */
export async function createCohort(cohort: Cohort, by: string): Promise<boolean> {
  try {
    await (await cohorts()).insertOne({ ...cohort, ...meta(by) });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false;
    throw e;
  }
}

/** Replace the whole cohort with this id. Returns false when it does not exist. */
export async function replaceCohort(cohort: Cohort, by: string): Promise<boolean> {
  const res = await (await cohorts()).replaceOne({ id: cohort.id }, { ...cohort, ...meta(by) });
  return res.matchedCount === 1;
}

/** Create or replace by id. Used by the API. */
export async function upsertCohort(cohort: Cohort, by: string): Promise<void> {
  await (await cohorts()).replaceOne({ id: cohort.id }, { ...cohort, ...meta(by) }, { upsert: true });
}

export async function deleteCohort(id: string): Promise<boolean> {
  const res = await (await cohorts()).deleteOne({ id });
  return res.deletedCount === 1;
}
