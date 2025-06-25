import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT= asyncHandler(async (req, res, next) => {
    try{
        const token = req.cookies?.accessToken || req.header('authorization')?.replace('Bearer ', '');
        if (!token){
            throw new ApiError(401, "Access token is required");
        }

        const decodedToken =jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        const user= await User.findById(decodedToken?._id).select("-password -refreshToken")

        if (!user){
            throw new ApiError(404, "User not found");
        }
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token");
    }
})