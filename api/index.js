// Vercel serverless entry. Vercel routes /api/* here (see vercel.json) and calls
// the exported Express app as the request handler. The Vite frontend is served
// as static files by Vercel's build; only /api is dynamic.
import app from "../server/app.js";

export default app;
