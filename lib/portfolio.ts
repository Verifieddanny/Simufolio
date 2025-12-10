import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db.ts";

const COLLECTION_NAME = "subscriptions";

export interface Subscription {
  _id?: ObjectId;
  telegramId: string;
  cryptoId: string;
  investmentAmount: number;
  startDate: Date;
  updateInterval: string;
  initialCoinPrice: number;
  lastNotificationDate: Date;
}

export const createSubscription = async (data: Subscription) => {
  const db = await connectToDatabase();

  const result = await db.collection(COLLECTION_NAME).insertOne(data);

  return result.insertedId;
};

export const getSubscriptionsByUserId = async (
  telegramId: string
): Promise<Subscription[]> => {
  const db = await connectToDatabase();

  const subscriptions = await db
    .collection(COLLECTION_NAME)
    .find({ telegramId: telegramId })
    .toArray();

  return subscriptions as Subscription[];
};

export const getSubscriptionById = async (
  subscriptionId: ObjectId
): Promise<Subscription | null> => {
  const db = await connectToDatabase();
  const subscription = await db
    .collection<Subscription>(COLLECTION_NAME)
    .findOne({ _id: subscriptionId });

  return subscription; 
};

export const deleteSubscription = async (subscriptionId: ObjectId) => {
  const db = await connectToDatabase();

  const result = await db
    .collection(COLLECTION_NAME)
    .deleteOne({ _id: subscriptionId });

  return result.deletedCount;
};
