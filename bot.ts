// import { IncomingMessage, ServerResponse } from "http";
import { Bot, InlineKeyboard, webhookCallback, Context } from "grammy";
import {
  getCoinList,
  getHistoricalData,
  getCoinMetadata,
} from "./lib/coinGeckoApi.js";
import { createSubscription } from "./lib/portfolio.js";
import { getSession, saveSession, clearSession } from "./lib/session.js";

const token = process.env.TG_BOT_API_KEY!;
if (!token) throw new Error("TG_BOT_API_KEY is unset");
const bot = new Bot(token);

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("🚀 Start New Simulation", "start_sim")
    .row()
    .text("📊 View My Subscriptions", "view_subs");

  await ctx.reply("Welcome to Simufolio! What would you like to do?", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery("start_sim", async (ctx) => {
  await ctx.answerCallbackQuery("Fetching top coins...");
  const telegramId = String(ctx.from.id);

  await saveSession(telegramId, null);

  const coinList = await getCoinList();

  if (coinList.length === 0) {
    return ctx.editMessageText(
      "Sorry, I could not fetch coin data right now. Try again later."
    );
  }

  const keyboard = new InlineKeyboard();
  coinList.slice(0, 10).forEach((coin) => {
    keyboard
      .text(
        `${coin.symbol.toUpperCase()} (${coin.name})`,
        `sim_coin:${coin.id}`
      )
      .row();
  });

  keyboard.text("🔙 Back to Main Menu", "back_main").row();

  await ctx.editMessageText("Select the cryptocurrency you want to simulate:", {
    reply_markup: keyboard,
  });
});

bot.callbackQuery(/^sim_coin:(.+)$/, async (ctx) => {
  const coinId = ctx.match[1];
  const telegramId = String(ctx.from.id);

  const metadata = await getCoinMetadata(coinId ??"");
  if (!metadata) {
    await ctx.answerCallbackQuery("Error fetching coin details.");
    return;
  }

  await saveSession(telegramId, coinId ?? "");

  await ctx.answerCallbackQuery();

  const message = `You selected **${metadata.name} (${metadata.symbol})**. 
    
    Current Price: $${metadata.currentPrice.toFixed(2)}
    Rank: #${metadata.marketRank}

    *Now, please reply to this message with the exact US Dollar amount (e.g., 100, 500.50) you wish to virtually invest.*`;

  await ctx.reply(message, {
    parse_mode: "Markdown",
    reply_markup: { 
        force_reply: true,
        selective: true, 
    },
  });
});

bot.on("message:text", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const amountText = ctx.message.text.trim();
  const amount = parseFloat(amountText);

  const session = await getSession(telegramId);

  if (isNaN(amount) || amount <= 0) {
    return ctx.reply(
      "❌ Invalid amount. Please reply with a positive number (e.g., 100)."
    );
  }

  if (!session || !session.coinId) { 
    return ctx.reply("❌ Session expired or incomplete. Please start a new simulation with /start.");
  }
  
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply(
      "❌ Invalid amount. Please reply with a positive number (e.g., 100)."
    );
  }

  const coinId = session.coinId;

  const intervalKeyboard = new InlineKeyboard()
    .text("Hourly", `confirm_sub:${coinId}:${amount}:hourly`)
    .text("Daily", `confirm_sub:${coinId}:${amount}:daily`)
    .row()
    .text("Monthly", `confirm_sub:${coinId}:${amount}:monthly`)
    .row();

  await ctx.reply(
    `You are investing **$${amount.toFixed(
      2
    )}** into **${coinId.toUpperCase()}**.
    
    How often would you like to receive automated performance updates?`,
    {
      parse_mode: "Markdown",
      reply_markup: intervalKeyboard,
    }
  );
});

bot.callbackQuery(/^confirm_sub:(.+):(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Processing Subscription...");
  const [coinId, amountStr, interval] = ctx.match.slice(1);
  const amount = parseFloat(amountStr ?? "");
  const telegramId = String(ctx.from.id);
  const startDate = new Date();

  const todayDate = startDate.toISOString().split("T")[0];

  const initialCoinPrice = await getHistoricalData(
    coinId ?? "",
    todayDate ?? ""
  );

  if (initialCoinPrice === null) {
    return ctx.editMessageText(
      `❌ Failed to start simulation for ${coinId}. Could not fetch historical price data. Please try again later.`
    );
  }

  const subscriptionData = {
    telegramId: telegramId,
    cryptoId: coinId ?? "",
    investmentAmount: amount,
    startDate: startDate,
    updateInterval: interval ?? "",
    initialCoinPrice: initialCoinPrice,
  };

  try {
    const _subscriptionId = await createSubscription(subscriptionData);

    await ctx.editMessageText(
      `✅ **Simulation Started!**
            
            **Asset:** ${(coinId ?? "").toUpperCase()}
            **Initial Investment:** $${amount.toFixed(2)}
            **Start Price:** $${initialCoinPrice.toFixed(2)}
            **Updates:** ${interval}
            
            I will now track the performance of this $${amount.toFixed(
              2
            )} investment over time.`,
      { parse_mode: "Markdown" }
    );
  } catch (dbError) {
    console.error("Database error creating subscription:", dbError);
    await ctx.editMessageText(
      "A database error occurred. Your simulation could not be saved."
    );
  }
});

bot.callbackQuery("back_main", (ctx) =>
  ctx.editMessageText("Welcome back to the main menu!", {
    reply_markup: new InlineKeyboard().text(
      "🚀 Start New Simulation",
      "start_sim"
    ),
  })
);
bot.on("callback_query", (ctx) => ctx.answerCallbackQuery());

bot.start();

// Vercel Export Handler
// export default async (req: IncomingMessage, res: ServerResponse) => {
//     if (req.method !== "POST") {
//       res.writeHead(200, { "Content-Type": "text/plain" });
//       res.end("The bot handler is listening for POST requests.");
//       return;
//     }

//     const handler = webhookCallback(bot, "https");

//     try {
//       await handler(req, res);
//     } catch (error) {
//       console.error("GrammY webhook handler error:", error);

//       res.writeHead(500, { "Content-Type": "text/plain" });
//       res.end("Internal Server Error");
//     }
//   };
