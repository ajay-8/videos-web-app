import jwt from "jsonwebtoken"
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

export const verifyUser = asyncHandler ( async (req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
        if (!token) {
            res.status(401).json({
                message: "Unauthorized request."
            })
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if (!user) {
            res.status(401).json({
                message: "Access token is invalid."
            })
        }
    
        req.user = user
        next()

    } catch (error) {
        res.status(401).json({
            message: error?.message || "Access token is invalid."
        })
    }
    
})