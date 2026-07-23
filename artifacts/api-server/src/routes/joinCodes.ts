import { Router, type IRouter } from "express";
import { ExchangeJoinCodeParams, ExchangeJoinCodeResponse } from "@workspace/api-zod";
import { exchangeJoinCode } from "../lib/joinCodes";
import { rateLimit, ipKey } from "../lib/rateLimit";

const router: IRouter = Router();

const exchangeLimiter = rateLimit({
  scope: "join-codes:exchange",
  windowMs: 60_000,
  max: 30,
  keyFn: ipKey,
});

router.post(
  "/join-codes/:code/exchange",
  exchangeLimiter,
  async (req, res): Promise<void> => {
    const params = ExchangeJoinCodeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const result = await exchangeJoinCode(params.data.code);
    if (!result) {
      res.status(404).json({ error: "Join code invalid or expired" });
      return;
    }
    res.json(
      ExchangeJoinCodeResponse.parse({
        playerToken: result.playerToken,
        sessionId: result.sessionId,
      }),
    );
  },
);

export default router;
