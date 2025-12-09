import { connectToDatabase } from "./db.js";
import { ObjectId } from "mongodb"; 

const SESSION_COLLECTION = "sessions";

interface SessionData {
  _id?: ObjectId;
  telegramId: string;
  coinId: string | null;
  timestamp: Date;
}


/**
 * Saves or updates a user's current conversation state (coinId) in MongoDB.
 */
export async function saveSession(telegramId: string, coinId: string | null): Promise<void> {
  const db = await connectToDatabase();
  const data: SessionData = {
    telegramId: telegramId,
    coinId: coinId,
    timestamp: new Date(),
  };

  await db.collection<SessionData>(SESSION_COLLECTION).updateOne(
    { telegramId: telegramId },
    { $set: data },
    { upsert: true }
  );
}


/**
 * Retrieves the user's current conversation state from MongoDB.
 */
export async function getSession(telegramId: string): Promise<SessionData | null> {
  const db = await connectToDatabase();
  const session = await db.collection<SessionData>(SESSION_COLLECTION).findOne({ telegramId: telegramId });
  return session;
}



/**
 * Clears the session after the process is complete (optional, but good practice).
 */
export async function clearSession(telegramId: string): Promise<void> {
  const db = await connectToDatabase();
  await db.collection(SESSION_COLLECTION).deleteOne({ telegramId: telegramId });
}