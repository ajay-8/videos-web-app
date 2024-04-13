import { Router } from "express";
import { loginUser, 
        logoutUser, 
        registerUser, 
        refreshAccessToken,
        changeCurrentPassword,
        getCurrentUser,
        updateUserDetails,
        updateUserAvatar,
        updateUserCoverImage,
        getUserProfile,
        getWatchHistory
    } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyUserToken } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

// secured routes
router.route("/logout").post(verifyUserToken, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/update-password").post(verifyUserToken, changeCurrentPassword)
router.route("/get-current-user").post(verifyUserToken, getCurrentUser)
router.route("/update-user-details").patch(verifyUserToken, updateUserDetails)
router.route("/update-user-avatar").patch(verifyUserToken, upload.single("avatar"), updateUserAvatar)
router.route("/update-user-cover-image").patch(verifyUserToken, upload.single("coverImage"), updateUserCoverImage)
router.route("/user-profile/:username").get(verifyUserToken, getUserProfile)
router.route("user-watch-history").get(verifyUserToken, getWatchHistory)


export default router;