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
router.route('/refresh-token').post(refreshAccessToken)
router.route("/update-password").post(verifyUserToken, changeCurrentPassword)
router.route("/get-current-user").post(verifyUserToken, getCurrentUser)
router.route("/update-user-details").post(verifyUserToken, updateUserDetails)
router.route("/update-user-avatar").post(verifyUserToken, updateUserAvatar)
router.route("/update-user-cover-image").post(verifyUserToken, updateUserCoverImage)


export default router;