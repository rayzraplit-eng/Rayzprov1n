import { Router, type IRouter } from "express";
import {
  CalculateMartingaleBody,
  CalculateMartingaleResponse,
  CalculateRiskBody,
  CalculateRiskResponse,
  CalculateCompoundBody,
  CalculateCompoundResponse,
  ListToolsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const TOOLS = [
  {
    id: "martingale",
    name: "Martingale Calculator",
    description:
      "Project your stake ladder, total exposure, and break-even step for a martingale recovery strategy.",
    category: "Risk",
    icon: "trending-up",
  },
  {
    id: "risk",
    name: "Position Size & Risk",
    description:
      "Compute the right contract size for a fixed account-risk percentage and stop-loss distance.",
    category: "Risk",
    icon: "shield",
  },
  {
    id: "compound",
    name: "Compound Growth",
    description:
      "Project account equity over N days at a target daily return — see when small edges compound into big numbers.",
    category: "Planning",
    icon: "line-chart",
  },
];

router.get("/tools", async (_req, res): Promise<void> => {
  res.json(ListToolsResponse.parse(TOOLS));
});

router.post("/tools/martingale", async (req, res): Promise<void> => {
  const parsed = CalculateMartingaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { baseStake, multiplier, steps, payoutPercent } = parsed.data;
  const round = (n: number): number => Math.round(n * 100) / 100;
  const stepRows: Array<{
    step: number;
    stake: number;
    cumulativeLoss: number;
    payout: number;
    netIfWin: number;
  }> = [];
  let cumulative = 0;
  let stake = baseStake;
  for (let i = 1; i <= steps; i += 1) {
    const payout = stake * (1 + payoutPercent / 100);
    const previousLossesBefore = cumulative;
    cumulative += stake;
    const netIfWin = payout - stake - previousLossesBefore;
    stepRows.push({
      step: i,
      stake: round(stake),
      cumulativeLoss: round(cumulative),
      payout: round(payout),
      netIfWin: round(netIfWin),
    });
    stake = stake * multiplier;
  }
  res.json(
    CalculateMartingaleResponse.parse({
      steps: stepRows,
      totalRisk: round(cumulative),
    }),
  );
});

router.post("/tools/risk", async (req, res): Promise<void> => {
  const parsed = CalculateRiskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { accountBalance, riskPercent, stopLossPips, pipValue } = parsed.data;
  const round = (n: number): number => Math.round(n * 100) / 100;
  const riskAmount = (accountBalance * riskPercent) / 100;
  const positionSize = stopLossPips * pipValue > 0 ? riskAmount / (stopLossPips * pipValue) : 0;
  res.json(
    CalculateRiskResponse.parse({
      riskAmount: round(riskAmount),
      positionSize: round(positionSize),
    }),
  );
});

router.post("/tools/compound", async (req, res): Promise<void> => {
  const parsed = CalculateCompoundBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { startingBalance, dailyReturnPercent, days } = parsed.data;
  const round = (n: number): number => Math.round(n * 100) / 100;
  const points: Array<{ day: number; balance: number }> = [];
  const factor = 1 + dailyReturnPercent / 100;
  let balance = startingBalance;
  points.push({ day: 0, balance: round(balance) });
  for (let i = 1; i <= days; i += 1) {
    balance = balance * factor;
    points.push({ day: i, balance: round(balance) });
  }
  res.json(
    CalculateCompoundResponse.parse({
      points,
      finalBalance: round(balance),
      totalProfit: round(balance - startingBalance),
    }),
  );
});

export default router;
