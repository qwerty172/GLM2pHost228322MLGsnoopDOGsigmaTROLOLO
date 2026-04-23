import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hostsRouter from "./hosts";
import playersRouter from "./players";
import sessionsRouter from "./sessions";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hostsRouter);
router.use(playersRouter);
router.use(sessionsRouter);
router.use(walletRouter);

export default router;
