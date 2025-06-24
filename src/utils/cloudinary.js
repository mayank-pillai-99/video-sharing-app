import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';


cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });


const uploadOnCloudinary = async (localFilePath) => {
    try {
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto',
        });
        fs.unlinkSync(filePath); // Delete the file after upload
        console.log('File uploaded successfully:', response);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath); 
        return null;
    }
}


export {uploadOnCloudinary };