import dotenv from "dotenv";
import connectDB from "./db/dbConnection.js";

dotenv.config({
    path: './env'
})


connectDB()