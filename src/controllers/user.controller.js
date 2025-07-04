import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteLocalFiles } from "../utils/deleteLocalFiles.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateRefreshAndAccessToken=async(userId)=>{
    try {
        const user=await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()
        // add refresh token to data base aswell do no need to relogin again
        user.refreshToken=refreshToken
        //SAVING can give error as password is not passed here
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong")
    }
}


const registerUser=asyncHandler(async (req,res)=>{
    // get user detail fdrom frontend
    // validation - not empty
    // check if already exits - username,email
    // check for images, check for avatar
    // upload to cloudinary, avatar
    // create user object - create entry in DB
    // remove password and token key from  res
    // check for user creation 
    // return response

    // getting data from form or json format
    const {fullName,email, username,password}=req.body;

    // validating if empty or not
    // classic method can be to have 4 if statements and 'if' anyone is empty then throw error but we can use .some method of an array in js
    if([fullName,email,username,password].some((field)=> field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }

    // // check if already exits
    // const existedUser=await User.findOne({
    //     $or:[{username},{email}]
    // })
    // if(existedUser){
    //     deleteLocalFiles([])
    //     throw new ApiError(409,"user already exists")
    // }

    // check for files from multer, it gives more props to req like .files
    const avatarLocalPath=req.files?.avatar[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage[0]?.path; //this will give error if user didn't send it as it was opyional in our DB
    // so better method
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }

    // check if already exits and then delet the files too
    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        deleteLocalFiles([avatarLocalPath,coverImageLocalPath])
        throw new ApiError(409,"user already exists")
    }

    // upload to cloudinary
    const avatar=await uploadOnCloudinary(avatarLocalPath);
    const coverImage=await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"failed to upload on cloud")
    }

    // crating user object and enter in DB
    const user=await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverImage?.url || "", //if exits the extract url or else leave empty as notr required
        email,
        password,
        username:username.toLowerCase()
    })
    // check if created and removing pass and token
    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken" //will not get selected
    )
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user!!")
    }

    // giving response
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registred succesfully")
    )
})

const loginUser=asyncHandler(async (req,res)=>{
    // req.body->data extract
    // username or email based login
    // find user if not found give the message and return
    // check the password
    // access and refresh token
    // send cookie

    const {email,username,password}=req.body

    if(!username && !email){
        throw new ApiError(400,"Email or username is required")
    }
    const user= await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"User not found")
    }

    const isPasswordVaild=await user.isPasswordCorrect(password)
    if(!isPasswordVaild){
        throw new ApiError(401,"Wrong password")
    }
    const {accessToken,refreshToken}=await generateRefreshAndAccessToken(user._id)
    // We call the function after finding the user from our databasein above lines so it is not having any token so either recallthe query for database or update the object like:
    // Save refreshToken
    // user.refreshToken = refreshToken;
    // await user.save();

    // // Convert to plain object
    // const loggedUser = user.toObject();

    // // Manually remove sensitive fields
    // delete loggedUser.password;
    // delete loggedUser.refreshToken;

    // // Return response
    // return {
    //     user: loggedUser,
    //     accessToken,
    //     refreshToken
    // };  or else just requery:

    const loggedUser=await User.findById(user._id).select("-password -refreshToken") //password won't be sent back

    //sending cookies
    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedUser,accessToken,refreshToken
            },
            "User logged in successfully"
        )
    )

})
const logoutUser=asyncHandler(async(req,res)=>{
    // The user was logged inso he had an access token we verified itand added it to the request body via the middleware thus we can access it here.
    await User.findByIdAndUpdate(req.user._id,
        {
            $unset:{
                refreshToken:1 // this removes the field from document
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(
        200,
        {},
        "User logged out successfully"
    ))
})
// say user hits the expiry of accesss token so instead of relogin we will generate new tokens via the refreshtoken
const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken||req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized request")
    }
    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        const user=await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }

        if(incomingRefreshToken!=user.refreshToken){
            throw new ApiError(401,"Refresh token is expired or used")
        }
        const options={
            httpOnly:true,
            secure:true
        }
        const {accessToken,newRefreshToken}=await generateRefreshAndAccessToken(user._id)
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refresToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                201,
                {accessToken,refreshToken:newRefreshToken},
                "AccessToken Refreshed"
            )
        )

    } catch (error) {
        throw new ApiError(401,"Invalid RefreshToken or Access")
    }
})

const changePassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body;
    const user=await User.findById(req.user?._id) //using middleware

    const isPasswordVaild=await user.isPasswordCorrect(oldPassword)
    if(!isPasswordVaild){
        throw new ApiError(400,"Wrong password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(201)
    .json(new ApiResponse(200,{},"password updated succesfully"))
})

const getCurrentUser=asyncHandler(async (req,res)=>{
    // const user=await User.findById(req.user?._id);//not needed
    return res.status(200).json(new ApiResponse(200,req.user,"user details fetched"))
})

const updateProfileDetails=asyncHandler(async(req,res)=>{
    const {email,fullName}=req.body
    if(!email || !fullName){
        throw new ApiError(400,"All fields are required")
    }
    const user=await User.findByIdAndUpdate(req.user?._id,
        {
            $set:{
                email:email,
                fullName
            }
        },{
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Details updated succesfully"
    ))
})

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"No image found")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    if(!avatar){
        throw new ApiError(400,"Error while uploading")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password")
    try {
        deleteLocalFiles([avatarLocalPath])
    } catch (error) {
        throw new ApiError(400,"Problem while deleting locally after uploading")
        
    }
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "Avatar updated succesfully"
    ))

})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(401,"No cover image found")
    }
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage){
        throw new ApiError(400,"Error while uploading")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")
     try {
        deleteLocalFiles([coverImageLocalPath])
    } catch (error) {
        throw new ApiError(400,"Problem while deleting coverImage locally after uploading")
        
    }
    return res
    .status(200)
    .json(new ApiResponse(
        200,
        user,
        "coverImage updated succesfully"
    ))

})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params //via the url
    if(!username?.trim()){
        throw new ApiError(400,"username is missing")
    }
    // aggregate pipeline, advance concept like sde2 sde3
    const channel=await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },{
            // couuting docs where the channel is present to have all subscribers count
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            // couuting docs where the subscriber is present to have all subscribed channel count
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },{
            // adding filed in our user model via another pipeline
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },{
            // not projecting all data but selected ones like only ging fullname,username etc
            $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar:1,
                coverImageL:1,
                email:1
            }
        }
    ])
    // console.log(channel) //check
    if(!channel?.length){
        throw new ApiError(400,"No channel found")
    }
    return res.status(200)
    .json(new ApiResponse(
        200,
        channel[0],
        "User channel fetched successfully"
    ))
})

const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                // since videos also have user as owner so we have to use nested pipelines
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            // since we don't want whole user details so only fullname,username and avatar will be projected on owner
                            pipeline:[
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            // overwritting to send the owner as owner[0] will be the the pipeline of the owner above as
                            // we will be returing an array above so better just return the first actual value
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "watch History fetched successfully"
        )
    )
})
export {registerUser,loginUser,logoutUser,refreshAccessToken,changePassword,getCurrentUser,updateProfileDetails,updateUserAvatar,
    updateUserCoverImage,getUserChannelProfile,getWatchHistory
}
