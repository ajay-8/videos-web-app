// Cloudinary is an end-to-end image- and video-management solution for websites and mobile apps,
// covering everything from image and video uploads, storage, manipulations, optimizations to delivery.

import {v2 as cloudinary} from 'cloudinary';
import fs from "fs";


cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfully
        //console.log("file is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got successfull.
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed.
        return null;
    }
}   


const deleteImageOnCloudinary = async (filePath) => {
    try {
        if (!filePath) return null
        //delete the file on cloudinary
        const response = await cloudinary.uploader.destroy(filePath);
        if (response?.result === "ok") {
            console.log("Avatar image removed from cloudinary seccessfully.")
        } else {
            console.log(`unable to remove avatar due to ${response}`)
        }
    } catch (error) {
        console.log(error?.message)
    }
}


export {uploadOnCloudinary, deleteImageOnCloudinary}