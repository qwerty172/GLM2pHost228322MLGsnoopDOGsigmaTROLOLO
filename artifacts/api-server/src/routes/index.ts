import { Router, type IRouter } from "express";
import downloadsRouter from "./downloads";
import gamesRouter from "./games";
import healthRouter from "./health";
import hostsRouter from "./hosts";
import playersRouter from "./players";
import sessionsRouter from "./sessions";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(downloadsRouter);
router.use(gamesRouter);
router.use(healthRouter);
router.use(hostsRouter);
router.use(playersRouter);
router.use(sessionsRouter);
router.use(walletRouter);

export default router;
