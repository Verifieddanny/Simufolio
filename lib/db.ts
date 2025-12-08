import { Db, MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri!);

let dbInstance: Db;

export const connectToDatabase = async () => {
  if (dbInstance) {
    return dbInstance;
  }
  try {
    await client.connect();
    dbInstance = client.db("SimuFolio");
    console.log("Successfully connected to MongoDB Atlas.");
    return dbInstance;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
};
