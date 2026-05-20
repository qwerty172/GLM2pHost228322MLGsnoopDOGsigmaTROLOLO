import { Router, type IRouter } from "express";
import downloadsRouter from "./downloads";
import gamesRouter from "./games";
import healthRouter from "./health";
import hostsRouter from "./hosts";
import playersRouter from "./players";
import publicRouter from "./public";
import sessionsRouter from "./sessions";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(downloadsRouter);
router.use(gamesRouter);
router.use(healthRouter);
// Public routes must mount BEFORE hostsRouter — both serve the /hosts path
// and Express picks the first registered handler.
router.use(publicRouter);
router.use(hostsRouter);
router.use(playersRouter);
router.use(sessionsRouter);
router.use(walletRouter);

export default router;
