// will verify if an user is there or not, will be used to logout
import { User } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";

export const verifyJWT=asyncHandler(async(req,_,next)=>{
    try {
        // as we are using cookie parser middleware so we can have cokkies in req too as it's both sides
        const token=req.cookies?.accessToken||req.header("Authorization")?.replace("Bearer ","")  //1st ? is for if say mobile app and no cookie access
        // here we are getting the accesstoken by either cokkie or in header it is stored in format: Authoriaztion: Bearer <token name> so we are replacing it
        if(!token){
            throw new ApiError(401,"Unauthorized requesr")
        }
        // while we were genarting accesstoken in usermodel, we were sending a lot of data like id, username,,email, fullname so now decode it
        const decodedToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user=await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user){
            throw new ApiError(401,"invalid access token")
        }
    
        // adding new object to req
        req.user=user;
        next();
    } catch (error) {
        throw new ApiError(401,error?.message||"Invalid access token")
    }

})