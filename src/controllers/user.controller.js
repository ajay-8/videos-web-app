import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/fileUploads.js"
// import { ApiResponse } from "../utils/ApiResponse.js";
import { emailValidator } from "../validators/email.validator.js";
import jwt from "jsonwebtoken"


const generateAccessAndRefereshTokens = async (userId) => {

    try {

        const userObj = await User.findById(userId);
        const accessToken = userObj.generateAccessToken();
        const refreshToken = userObj.generateRefreshToken();
    
        userObj.refreshToken = refreshToken
    
        // validateBeforeSave set to false as it ensures that no validation should work while saving the object.
        await userObj.save({ validateBeforeSave: false })
    
        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, `${error}`)
    }
}


const registerUser = asyncHandler( async (req, res) => {

    let coverImageLocalPath;
    let avatarLocalPath;
    let coverImage;

    const requiredFields = ['fullName', 'username', 'email', 'password'];

    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
        return res.status(400).json({
            message: `${missingFields} is required`
        })
    }

    const { fullName, email, username, password } = req.body

    if (!emailValidator(email)) {
        return res.status(400).json({
            message: "Please send correct email address."
        })
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        // A 409 status code is used to indicate a conflict with the current state of a resource, 
        // such as when trying to create or update a resource that already exists or has conflicting information.
        return res.status(409).json({
            message: "User with email or username already exists"
        })
    }


    // check for avatar image (mandatory)
    if (Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path
    } else {
        return res.status(400).json({
            message: "Avatar file is required."
        })
    }

    // check for cover image
    if (Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // upload images on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        res.status(500).json({
            message: "Error occurred while uploading avatar file on cloudinary."
        })
    }

    if (coverImageLocalPath) {
        coverImage = await uploadOnCloudinary(coverImageLocalPath)
    }

    const createdUser = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    if (!createdUser) {
        return res.status(500).json({
            message: "Error occurred while creating user."
        })
    } else {
        const res_body = {
            fullName: createdUser.fullName,
            avatar: createdUser.avatar,
            coverImage: createdUser.coverImage,
            email: createdUser.email,
            username: createdUser.username
        }
        return res.status(201).json({
            message: "User created successfully.",
            data: res_body
        })
    }

})

const loginUser = asyncHandler( async (req, res) => {

    const {email, password} = req.body;

    if ( !(email || password) ) {
        return res.status(400).json({
            message: "Please provide valid email and password."
        })
    }

    const user = await User.findOne({ email })

    if (!user) {
        res.status(400).json({
            message: "User does not exist."
        })
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        res.status(400).json({
            message: "Invalid user credentials."
        })
    }

    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // (httpOnly and secure) set to true so that only server can edit the cookies.
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie(
        "accessToken", accessToken, options
    ).cookie(
        "refreshToken", refreshToken, options
    ).json({
        message: "User logged in Successfully.",
        data: loggedInUser, accessToken, refreshToken
    })


})

const logoutUser = asyncHandler( async (req, res) => {
    const user = req.user

    await User.findByIdAndUpdate(
        user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie(
        "accessToken", options
    ).clearCookie(
        "refreshToken", options
    ).json({
        message: "User logged out successfully."
    })
})

const refreshAccessToken = asyncHandler( async (req, res) => {

    const userRefreshToken = req.cookies?.refreshToken || req.header("refreshToken");

    if ( !userRefreshToken ) {
        res.status(401).json({
            message: "Please provide refresh token."
        })
    }

    try {
        const userDecodedRefreshToken = jwt.verify(userRefreshToken, process.env.REFRESH_TOKEN_SECRET_KEY)
    
        const user = await User.findById(userDecodedRefreshToken?._id);
    
        if ( !user ) {
            res.status(401).json({
                message: "Invalid refresh token!"
            })
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshTokens(user._id)
        console.log(accessToken, newRefreshToken)
    
        return res.status(200).cookie(
            "accessToken", accessToken, options
        ).cookie(
            "refreshToken", newRefreshToken, options
        ).json({
            message: "User token regenerated.",
            data: {
                accessToken, newRefreshToken
            }
        })
    } catch (error) {
        console.log(error?.message)
        res.status(400).json({
            message: "unable to regenerate refresh token"
        })
    }


})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
};