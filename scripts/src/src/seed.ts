import { db, botsTable, tradesTable } from "@workspace/db";

const SAMPLE_XML = `<xml xmlns="http://www.w3.org/1999/xhtml" is_dbot="true" collection="false">
  <variables></variables>
  <block type="trade_definition" id="trade_definition_root" deletable="false" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">R_75</field>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradetype">
        <field name="TRADETYPECAT_LIST">callput</field>
        <field name="TRADETYPE_LIST">callput</field>
      </block>
    </statement>
  </block>
</xml>`;

async function main(): Promise<void> {
  const existingBots = await db.select().from(botsTable);
  if (existingBots.length === 0) {
    await db.insert(botsTable).values([
      {
        name: "Vol75 Martingale Recovery",
        description: "Classic 2x martingale on Volatility 75 — short stop after 5 steps.",
        strategy: "Martingale",
        market: "Volatility 75",
        tags: ["martingale", "synthetic", "vol75"],
        favorite: true,
        status: "idle",
        xmlContent: SAMPLE_XML,
        sizeBytes: Buffer.byteLength(SAMPLE_XML, "utf-8"),
      },
      {
        name: "Boom 1000 Spike Catcher",
        description: "Buys CALL after 850-tick run; trails out on first opposite tick.",
        strategy: "Spike",
        market: "Boom 1000",
        tags: ["boom", "spike"],
        favorite: false,
        status: "idle",
        xmlContent: SAMPLE_XML,
        sizeBytes: Buffer.byteLength(SAMPLE_XML, "utf-8"),
      },
      {
        name: "R_100 Even/Odd Sniper",
        description: "Digit even/odd over Volatility 100 with anti-streak filter.",
        strategy: "Digits",
        market: "Volatility 100",
        tags: ["digits", "vol100", "even-odd"],
        favorite: false,
        status: "paused",
        xmlContent: SAMPLE_XML,
        sizeBytes: Buffer.byteLength(SAMPLE_XML, "utf-8"),
      },
      {
        name: "Crash 500 Dip Buyer",
        description: "Counter-trend CALL on Crash 500 after a fast move down.",
        strategy: "Counter-trend",
        market: "Crash 500",
        tags: ["crash", "counter-trend"],
        favorite: true,
        status: "idle",
        xmlContent: SAMPLE_XML,
        sizeBytes: Buffer.byteLength(SAMPLE_XML, "utf-8"),
      },
    ]);
  }

  const existingTrades = await db.select().from(tradesTable);
  if (existingTrades.length === 0) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const SAMPLES: Array<{
      symbol: string;
      contractType: string;
      stake: number;
      result: "win" | "loss" | "breakeven";
      profit: number;
      offset: number;
    }> = [
      { symbol: "R_75", contractType: "CALL", stake: 5, result: "win", profit: 4.65, offset: 14 },
      { symbol: "R_75", contractType: "PUT", stake: 5, result: "loss", profit: -5, offset: 13 },
      { symbol: "BOOM1000", contractType: "CALL", stake: 10, result: "win", profit: 8.9, offset: 12 },
      { symbol: "R_100", contractType: "DIGITEVEN", stake: 2, result: "win", profit: 1.86, offset: 11 },
      { symbol: "R_100", contractType: "DIGITEVEN", stake: 2, result: "loss", profit: -2, offset: 10 },
      { symbol: "CRASH500", contractType: "CALL", stake: 8, result: "win", profit: 7.4, offset: 9 },
      { symbol: "R_75", contractType: "CALL", stake: 5, result: "win", profit: 4.65, offset: 8 },
      { symbol: "R_75", contractType: "PUT", stake: 5, result: "win", profit: 4.65, offset: 7 },
      { symbol: "R_50", contractType: "CALL", stake: 4, result: "loss", profit: -4, offset: 6 },
      { symbol: "BOOM1000", contractType: "CALL", stake: 10, result: "win", profit: 8.9, offset: 5 },
      { symbol: "R_100", contractType: "DIGITODD", stake: 2, result: "loss", profit: -2, offset: 4 },
      { symbol: "CRASH500", contractType: "CALL", stake: 8, result: "win", profit: 7.4, offset: 3 },
      { symbol: "R_75", contractType: "CALL", stake: 6, result: "win", profit: 5.58, offset: 2 },
      { symbol: "R_75", contractType: "PUT", stake: 6, result: "loss", profit: -6, offset: 1 },
      { symbol: "BOOM1000", contractType: "PUT", stake: 12, result: "win", profit: 10.68, offset: 0 },
    ];
    await db.insert(tradesTable).values(
      SAMPLES.map((s) => ({
        symbol: s.symbol,
        contractType: s.contractType,
        stake: s.stake,
        payout: s.profit > 0 ? s.stake + s.profit : 0,
        profit: s.profit,
        result: s.result,
        notes: "",
        tradedAt: new Date(now - s.offset * day),
      })),
    );
  }

  console.log("Seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
