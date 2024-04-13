import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/user.model.js"
import { uploadOnCloudinary, deleteImageOnCloudinary } from "../utils/cloudinary.js"
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

const changeCurrentPassword = asyncHandler( async (req, res) => {
    try {
        const {oldPassword, newPassword1, newPassword2} = req.body;
    
        if (newPassword1 != newPassword2) {
            return res.status(400).json({
                message: "password mismatched."
            })
        };
        
        const user = await User.findById(req.user?._id);
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    
        if (!isPasswordCorrect) {
            return res.status(400).json({
                message: "Incorrect password!!"
            })
        };
    
        user.password = newPassword1;
        await user.save({validateBeforeSave: false})
    
        return res.status(200).json({
            message: "Password changed successfully."
        })
    } catch (error) {
        console.log(error?.message)
        return res.status(400).json({
            message: "unable to update user password."
        })
    }
})

const getCurrentUser = asyncHandler( async(req, res) => {
    return res.status(200).json({
        message: "user fetched successfully.",
        data: req.user
    })
})

const updateUserDetails = asyncHandler( async (req, res) => {

    try {
        const {fullName, username} = req.body;

        // if (!fullName || !username) {
        //     return res.status(400).json({
        //         message: "Please provide username and fullname."
        //     })
        // }
        if (!(fullName || username)) {
            return res.status(400).json({
                message: "Please provide either username and fullName or both."
            })
        }
        
        // restrict user to change username if given username already in use by another user
        const existedUsername = await User.findOne({ username: username });
    
        if (existedUsername) {
            return res.status(400).json({
                message: "username already taken."
            })
        }

        // const existedFullname = await User.findOne({ fullName: fullName });
    
        // if (existedFullname) {
        //     return res.status(400).json({
        //         message: "fullname already taken."
        //     })
        // }
    
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    fullName,
                    username
                }
            },
            {new: true}
        ).select("-password -refreshToken")

        return res.status(200).json({
            message: "user details updated.",
            data: user
        })

    } catch (error) {
        console.log(error?.message)
        return res.status(400).json({
            message: "unable to update user details"
        })
    }
})

const updateUserAvatar = asyncHandler( async (req, res)=> {

    try {
        const avatarLocalPath = req.file?.path;

        if (!avatarLocalPath) {
            return res.status(400).json({
                message: "Please provide avatar image."
            })
        }

        const requestedUser = await User.findById(req.user?._id);
        const ExistedAvatarImage = requestedUser.avatar;

        // upload new avatar image on cloudinary first and then delete the previous avatar image
        const updatedAvatar = await uploadOnCloudinary(avatarLocalPath);
        if (!updatedAvatar) {
            res.status(500).json({
                message: "Error occurred while uploading avatar file on cloudinary."
            })
        }

        // delete previous avatar file from cloudinary
        const deletedAvatarResponse = await deleteImageOnCloudinary(ExistedAvatarImage);

        if (deletedAvatarResponse === 'error') {
            console.log("Error occurred while deleting avatar file from cloudinary.")
            return res.status(400).json({
                message: "unable to update user avatar"
            })
        }

        // updating user object with the new uploaded avatar image
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    avatar: updatedAvatar?.url || ""
                }
            },
            {new: true}
        ).select("-password -refreshToken")

        return res.status(200).json({
            message: "user avatar updated successfully.",
            data: user
        })
    } catch (error) {
        console.log(error?.message)
        return res.status(400).json({
            message: "Exception occurred while updating user avatar.",
        })
    }
})

const updateUserCoverImage = asyncHandler( async (req, res)=> {

    try {
        const coverImageLocalPath = req.file?.path;
    
        if (!coverImageLocalPath) {
            return res.status(400).json({
                message: "Please provide cover image."
            })
        }
    
        const requestedUser = User.findById(req.user?._id);
    
        const ExistedCoverImage = requestedUser.coverImage;

        // upload new cover image on cloudinary first and then delete the previous cover image
        const updatedCoverImage = await uploadOnCloudinary(coverImageLocalPath);
        if (!updatedCoverImage) {
            res.status(500).json({
                message: "Error occurred while uploading coverImage file on cloudinary."
            })
        }

        // delete previous coverImage file from cloudinary
        const deletedCoverImageResponse = await deleteImageOnCloudinary(ExistedCoverImage);

        if (deletedCoverImageResponse === 'error') {
            console.log("Error occurred while deleting coverImage file from cloudinary.")
            return res.status(400).json({
                message: "unable to update user coverImage"
            })
        }
    
        // updating user object with the new uploaded cover image
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    coverImage: updatedCoverImage?.url || ""
                }
            },
            {new: true}
        ).select("-password -refreshToken")
    
        return res.status(200).json({
            message: "user cover image updated successfully.",
            data: user
        })
    } catch (error) {
        console.log(error?.message)
        return res.status(400).json({
            message: "Exception occurred while updating user cover image.",
        })
    }
})

const getUserProfile = asyncHandler( async (req, res) => {
    const { username } = req.params;
    console.log(req.params)
    // const { username } = req.body;

    if ( !username?.trim() ) {
        return res.status(400).json({
            message: "invalid username!!"
        })
    }

    const userProfile = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                createdAt: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    // console.log(userProfile)

    if (!userProfile) {
        return res.status(404).json({
            message: "user does not exists."
        })
    }

    return res.status(200).json({
        message: "ok",
        data: userProfile
    })
})

const getWatchHistory = asyncHandler( async( req, res) => {

})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserProfile,
    getWatchHistory
};