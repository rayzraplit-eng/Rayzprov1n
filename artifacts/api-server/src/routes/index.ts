import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import botsRouter from "./bots";
import toolsRouter from "./tools";
import tradesRouter from "./trades";
import dashboardRouter from "./dashboard";
import oauthRouter from "./oauth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(oauthRouter);
router.use(accountsRouter);
router.use(botsRouter);
router.use(toolsRouter);
router.use(tradesRouter);
router.use(dashboardRouter);

export default router;
