import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"})) // to handle json data with a limit of 16kb i.e. max 16kb of json is allowed
app.use(express.urlencoded({extended: true, limit: "16kb"})) // to encode url while parsing
app.use(express.static("public")) // for static files
app.use(cookieParser()) // to handle cookies

// routes import 
import userRouter from './routes/user.routes.js'



// routes declaration
app.use("/api/v1/users", userRouter)

export { app }