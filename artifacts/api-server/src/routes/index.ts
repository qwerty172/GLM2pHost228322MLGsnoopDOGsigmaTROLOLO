import { Router, type IRouter } from "express";
import downloadsRouter from "./downloads";
import gamesRouter from "./games";
import healthRouter from "./health";
import hostsRouter from "./hosts";
import playersRouter from "./players";
import publicRouter from "./public";
import sessionsRouter from "./sessions";
import walletRouter from "./wallet";
import quotasRouter from "./quotas";
import adminRouter from "./admin";
import submissionsRouter from "./submissions";
import storageRouter from "./storage";
import loansRouter from "./loans";
import premiumRouter from "./premium";
import agentAuthRouter from "./agentAuth";
import vdsRouter from "./vds";
import quotaAiChatRouter from "./quotaAiChat";
import enrichRouter from "./enrich";
import vtRouter from "./vt";
import devKeysRouter from "./devKeys";
import embedRouter from "./embed";

const router: IRouter = Router();

router.use(agentAuthRouter);
router.use(downloadsRouter);
router.use(enrichRouter);
router.use(gamesRouter);
router.use(healthRouter);
// Public routes must mount BEFORE hostsRouter — both serve the /hosts path
// and Express picks the first registered handler.
router.use(publicRouter);
router.use(hostsRouter);
router.use(playersRouter);
router.use(sessionsRouter);
router.use(walletRouter);
router.use(quotasRouter);
router.use(adminRouter);
router.use(submissionsRouter);
router.use(storageRouter);
router.use(loansRouter);
router.use(premiumRouter);
router.use(vdsRouter);
router.use(quotaAiChatRouter);
router.use(vtRouter);
router.use(devKeysRouter);
router.use(embedRouter);

export default router;
