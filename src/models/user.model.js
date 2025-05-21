import mongoose,{Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
const userSchema=new Schema(
    {
        username:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true,
            index:true //good for searching
        },
        email:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true,
        },
        fullName:{
            type:String,
            required:true,
            trim:true,
        },
        avatar:{
            type:String, //cloud url from 3rd party to store image
            required:true,
            
        },
        coverImage:{
            type:String,
            
        },
        watchHistory:[
            {
                type:Schema.Types.ObjectId,
                ref:"Video"
            }
        ],
        password:{
            type: String,
            required:[true,'Password is required']
        },
        refreshToken:{
            type:String
        }
    }
    ,{timestamps:true}
);
// encrypt the password before saving using hooks
userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next();//only encrypting when user has modified or 1st time saved the password else nothing

    this.password=bcrypt.hash(this.password,10); //10 rounds of hashing
    next();
})
// matching the password by the encrpted one if the same
userSchema.methods.isPasswordCorrect=async function (password) {
    return await bcrypt.compare(password,this.password)
}
userSchema.methods.generateAccessToken=async function(params) {
    return jwt.sign({
        _id:this._id,
        email:this.email,
        username:this.username,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn:process.env.ACCESS_TOKEN_EXPIRE
    }
)
}
userSchema.methods.generateRefreshToken=async function(params) {
    return jwt.sign({
        _id:this._id,
        
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn:process.env.REFRESH_TOKEN_EXPIRE
    }
)
}
export const User=mongoose.model("User",userSchema)