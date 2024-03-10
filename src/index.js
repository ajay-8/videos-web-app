import dotenv from "dotenv";
import connectDB from "./db/dbConnection.js";

dotenv.config({
    path: './env'
})


connectDB().then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port : ${process.env.PORT}`);
    })
}).catch((err) => {
    console.log("MONGODB connection failed !!! ", err);
})