/*
 * asyncHandler wraps an async route handler function.
 * It calls Promise.resolve() on the handler to handle
 * both sync and async return values as a Promise.
 * If the Promise rejects (error thrown), catch() calls next(err),
 * forwarding the error to Express's centralized error middleware.
 * 
 * Key points:
 * - Promise.resolve ensures the handler result is a Promise.
 * - .catch(next) sends errors to Express error handlers.
 * - Avoids repetitive try/catch in every route.
 */
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}


export { asyncHandler }
//these are higher function that means function within function

/**
 * asyncHandler wraps an async route handler with an explicit try/catch.
 * It awaits the handler and catches any error thrown during execution.
 * On error, it sends an HTTP response with status code (err.code or 500),
 * and a JSON error message directly from inside this wrapper.
 * 
 * Key points:
 * - try/catch catches errors from awaited async function.
 * - Sends error response immediately, no next() call.
 * - Easier to understand but less flexible (no central error middleware).
 */

// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(err.code || 500).json({
//             success: false,
//             message: err.message
//         })
//     }
// }