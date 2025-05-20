import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app=express()

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

// for limiting the data from json
app.use(express.json({limit:"16kb"}))

//for the data request via a url
app.use(express.urlencoded({extended:true,limit:"16kb"})); // extended is for objects within objects, like extensions of url

//saving data temperoraly
app.use(express.static("public"))

// for the cookies
app.use(cookieParser())
export {app}