import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { deleteLocalFiles } from "../utils/deleteLocalFiles.js";

const generateRefreshAndAccessToken=async(userId)=>{
    try {
        const user=await User.findById(userId)
        const refreshToken=user.generateRefreshToken()
        const accessToken=user.generateAccessToken()
        // add refresh token to data base aswell do no need to relogin again
        user.refreshToken=refreshToken
        //SAVING can give error as password is not passed here
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}
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

    const loggedUser=await User.findById(user._id).select("-passsword -refreshToken") //password won't be sent back

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
    // The user was logged inso he had an access spoken we verified itand added it to the request body via the middleware thus we can access it here.
    await User.findByIdAndUpdate(req.user._id,
        {
            $set:{
                refreshToken:undefined
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

export {registerUser,loginUser,logoutUser}
