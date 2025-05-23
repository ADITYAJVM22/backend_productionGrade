import multer from "multer";
//saving file to the server via the temp file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // cb means callback
    cb(null, "./public/temp")
  },
  filename: function (req, file, cb) {
    
    cb(null, file.originalname)
  }
})

export const upload = multer({
    storage,
})