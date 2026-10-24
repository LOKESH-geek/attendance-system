import { MongoClient } from "mongodb";

const options = {};
let cachedClientPromise: Promise<MongoClient> | undefined;

declare global {
  // Reuse the connection during Next.js development hot reloads.
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not defined. Add it to your .env.local file.");

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri, options).connect();
    }
    return global._mongoClientPromise;
  }

  if (!cachedClientPromise) cachedClientPromise = new MongoClient(uri, options).connect();
  return cachedClientPromise;
}

export default getMongoClient;
