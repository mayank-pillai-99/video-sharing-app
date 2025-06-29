import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

const generateAcessandRefreshTokens= async(userId)=>{
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken(); 
        const refreshToken = user.generateRefreshToken(); 
        user.refreshToken = refreshToken;
       
        await user.save({validateBeforeSave: false});

        return {accessToken, refreshToken};
    }catch(error){
        throw new ApiError(500, "Token generation failed");
    }
}
const registerUser = asyncHandler( async (req,res) =>{
     // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullname,username, email, password} = req.body;
    console.log("email:", email);

    if(
        [fullname, username, email, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser= await User.findOne({
        $or:[{username},{email}]
    })

    if (existedUser) {
        throw new ApiError(409, "Username or email already exists");
    };
    const avatarLocalPath=req.files?.avatar[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }

    const user =await User.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        username:username.toLowerCase(),
        email,
        password,
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser){
        throw new ApiError(500, "User registeration failed");
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser, "User registered successfully")
    )
})

const loginUser =asyncHandler(async (req, res) => {
    // Login logic will go here
    const {email,password,username} = req.body;

    if (!email && !username){
        throw new ApiError(400,"username or email is required")
    }

    const user=await User.findOne({
        $or:[{email},{username}]
    })

    if (!user){
        throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if( !isPasswordValid) {
        throw new ApiError(401, "Invalid password");
    }

    const {accessToken,refreshToken}=await generateAcessandRefreshTokens(user._id)

    const loggedInUser= await User.findById(user._id)
    .select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true,
    }

    res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie('accessToken', accessToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,
                refreshToken,
                accessToken
            },
            "User logged in successfully"
        )
    )
});

const logoutUser= asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{refreshToken:undefined}
        },
        {
            new:true
        }
    )
    const options=
    {
        httpOnly:true,
        secure:true,
    }
    return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken= req.cookies?.refreshToken || req.body?.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is required");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user= await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }
        if( user.refreshToken !== incomingRefreshToken) {
            throw new ApiError(401, "Invalid refresh token");
        }
    
        const options={
            httpOnly:true,
            secure:true,
        }
        const {accessToken, newRefreshToken} = await generateAcessandRefreshTokens(user._id);
    
        res
        .status(200)
        .cookie("refreshToken", newRefreshToken, options)
        .cookie("accessToken", accessToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken:newRefreshToken
                },
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid or expired refresh token");    
    }
})

const changeCurrentPassword =asyncHandler(async (req, res) => {
    const {currentPassword, newPassword} = req.body;

    const user= await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    const isPasswordValid = await user.isPasswordCorrect(currentPassword);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid current password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async (req, res) => {

    res
    .status(200)
    .json(
        new ApiResponse(200, req.user, "Current user fetched successfully")
    );
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullname, email} = req.body;

    if(!fullname || !email) {
        throw new ApiError(400, "Fullname and email are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname:fullname,
                email:email,
            }
        },
        {
            new: true,
        }
    ).select("-password");

    return res
    .status(200)
    .json(
        new ApiResponse(200,user, "User details updated successfully")
    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url,
            }
        },
        {
            new: true,
        }
    ).select("-password ");

    res
    .status(200)
    .json(
        new ApiResponse(200, user, "User avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file is required");
    }

    const coverImage = await uploadOnCloudinary(avatarLocalPath);
    if (!coverImage) {
        throw new ApiError(400, "Cover Image upload failed");
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url,
            }
        },
        {
            new: true,
        }
    ).select("-password ");

    res
    .status(200)
    .json(
        new ApiResponse(200, user, "User Cover Image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
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
                channelsSubscribedToCount: {
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
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};