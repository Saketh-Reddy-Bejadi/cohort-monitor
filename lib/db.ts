import "server-only";
import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
};

function client(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const named = /^mongodb(?:\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri);
  if (!named && !process.env.MONGODB_DB) {
    throw new Error("Set a database name in MONGODB_URI or set MONGODB_DB");
  }
  // Reuse one connection across hot reloads in dev.
  globalForMongo._mongoClient ??= new MongoClient(uri).connect().catch((e) => {
    // Do not keep a failed connection: the next request tries again.
    delete globalForMongo._mongoClient;
    throw e;
  });
  return globalForMongo._mongoClient;
}

export async function getDb(): Promise<Db> {
  return (await client()).db(process.env.MONGODB_DB || undefined);
}
