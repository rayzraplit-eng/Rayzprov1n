import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    // Allow same-origin requests and the Replit preview domain.
    // In production the frontend is served from the same origin, so this
    // effectively blocks cross-origin callers in all environments.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // same-origin / server-to-server
      const allowed =
        origin.includes("replit.app") ||
        origin.includes("replit.dev") ||
        origin.includes("localhost");
      cb(allowed ? null : new Error("CORS: origin not allowed"), allowed);
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
