import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hostsRouter from "./hosts";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hostsRouter);
router.use(sessionsRouter);

export default router;
