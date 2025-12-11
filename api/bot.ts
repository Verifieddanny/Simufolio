import { IncomingMessage, ServerResponse } from "http";
import { Bot, InlineKeyboard, webhookCallback, Context } from "grammy";
import {
  getCoinList,
  getHistoricalData,
  getCoinMetadata,
  getCurrentPrice,
  searchCoins,
} from "../lib/coinGeckoApi.js";
import {
  createSubscription,
  getSubscriptionById,
  getSubscriptionsByUserId,
} from "../lib/portfolio.js";
import { getSession, saveSession, clearSession } from "../lib/session.js";
import { ObjectId } from "mongodb";

const token = process.env.TG_BOT_API_KEY!;
if (!token) throw new Error("TG_BOT_API_KEY is unset");
const bot = new Bot(token);

// Simple HTML escaper for safe insertion into Telegram HTML parse_mode messages
function escapeHtml(input: string | number | null | undefined) {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text("🚀 Start New Simulation", "start_sim")
    .row()
    .text("📊 View My Subscriptions", "view_subs");

  await ctx.reply(
    `Welcome to <b>SimuFolio!</b> 🚀 Ready to track your virtual gains? Choose your action:`,
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
    }
  );
});

bot.callbackQuery("start_sim", async (ctx) => {
  await ctx.answerCallbackQuery("Fetching top coins...");
  const telegramId = String(ctx.from.id);

  await saveSession(telegramId, null);

  const initialKeyboard = new InlineKeyboard()
    .text("🔍 Search by Name/Symbol", "start_search")
    .row()
    .text("🔽 View Top 10 List", "view_top_10")
    .row();

  await ctx.editMessageText(
    "🔎 How would you like to find your investment token?",
    {
      reply_markup: initialKeyboard,
    }
  );
});

bot.callbackQuery(/^sim_coin:(.+)$/, async (ctx) => {
  const coinId = ctx.match[1];
  const telegramId = String(ctx.from.id);

  const metadata = await getCoinMetadata(coinId ?? "");
  if (!metadata) {
    await ctx.answerCallbackQuery("Error fetching coin details.");
    return;
  }

  await saveSession(telegramId, coinId ?? "");

  await ctx.answerCallbackQuery();

  const message = `You selected <b>${escapeHtml(
    metadata.name
  )} (${escapeHtml(metadata.symbol)})</b> (${metadata.marketRank ? `#${metadata.marketRank}` : "Unranked"}).\n\nCurrent Price: $${metadata.currentPrice.toFixed(
    2
  )}\n\n<b>Ready for the fiat injection?</b> 💵 Reply with the exact US Dollar amount (e.g., <code>500</code>, <code>100.50</code>) you wish to virtually invest.`;

  await ctx.reply(message, {
    parse_mode: "HTML",
    reply_markup: {
      force_reply: true,
      selective: true,
    },
  });
});

bot.on("message:text", async (ctx) => {
  const telegramId = String(ctx.from.id);
  const textInput = ctx.message.text.trim();

  const session = await getSession(telegramId);

  if (session?.coinId === "SEARCH_MODE") {
    await ctx.reply("Scanning the crypto universe for matches... 🌌");
    const results = await searchCoins(textInput);

    if (results.length === 0) {
      await saveSession(telegramId, null);
      return ctx.reply(
        `🥶 <b>Zero HODLers found.</b> No tokens match that query. Try another search term!`,
        { parse_mode: "HTML" }
      );
    }

    const keyboard = new InlineKeyboard();
    results.slice(0, 5).forEach((coin) => {
      // Show top 5 results
      keyboard
        .text(
          `${coin.symbol.toUpperCase()} (${coin.name})`,
          `sim_coin:${coin.id}`
        )
        .row();
    });

    await saveSession(telegramId, null);

    return ctx.reply(
      `✅ Found ${results.length} results. Select the correct coin:`,
      {
        reply_markup: keyboard.row().text("🔙 Back to Main Menu", "back_main"),
      }
    );
  }

  const amount = parseFloat(textInput);

  if (!session || !session.coinId) {
    return ctx.reply(
      "❌ Session expired or incomplete. Please start a new simulation with /start."
    );
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
    `💸 Investment Confirmation: You are minting <b>$${amount.toFixed(2)}</b> into <b>${escapeHtml(
      coinId.toUpperCase()
    )}</b>.\n\nHow often should I ping your portfolio?`,
    { parse_mode: "HTML", reply_markup: intervalKeyboard }
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
    lastNotificationDate: startDate,
  };

  try {
    const _subscriptionId = await createSubscription(subscriptionData);
    await ctx.editMessageText(
      `✅ <b>Simulation Deployed!</b> Your virtual investment is now live on the blockchain tracker! ⛓️\n\n<b>Asset:</b> ${escapeHtml(
        (coinId ?? "").toUpperCase()
      )}\n<b>Initial Investment:</b> $${amount.toFixed(2)}\n<b>Start Price:</b> $${initialCoinPrice.toFixed(2)}\n<b>Updates:</b> ${escapeHtml(
        interval
      )}`,
      { parse_mode: "HTML" }
    );
    // await clearSession(telegramId);
  } catch (dbError) {
    console.error("Database error creating subscription:", dbError);
    await ctx.editMessageText(
      "A database error occurred. Your simulation could not be saved."
    );
  }
});

bot.callbackQuery("view_subs", async (ctx) => {
  await ctx.answerCallbackQuery("Retrieving your simulations...");
  const telegramId = String(ctx.from.id);

  try {
    const subscriptions = await getSubscriptionsByUserId(telegramId);

    if (!subscriptions || subscriptions.length === 0) {
      return ctx.editMessageText(
        "You currently have no active simulations. Start a new one with the button below!",
        {
          reply_markup: new InlineKeyboard().text(
            "🚀 Start New Simulation",
            "start_sim"
          ),
        }
      );
    }

    const keyboard = new InlineKeyboard();

    subscriptions.forEach((sub, index) => {
      keyboard
        .text(
          `#${
            index + 1
          }: ${sub.cryptoId.toUpperCase()} ($${sub.investmentAmount.toFixed(
            0
          )})`,
          `view_details:${sub._id}`
        )
        .row();
    });

    keyboard.text("🔙 Back to Main Menu", "back_main").row();

    await ctx.editMessageText("📊 <b>Your Active Simulations:</b>", {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error viewing subscriptions:", error);
    await ctx.editMessageText(
      "A database error occurred while fetching your subscriptions."
    );
  }
});

bot.callbackQuery(/^view_details:(.+)$/, async (ctx) => {
  const subscriptionIdStr = ctx.match[1];

  await ctx.answerCallbackQuery("Calculating live performance...");

  try {
    const subscriptionId = new ObjectId(subscriptionIdStr);

    const sub = await getSubscriptionById(subscriptionId);

    if (!sub) {
      return ctx.editMessageText(
        "❌ Simulation details not found. It may have been deleted."
      );
    }

    const currentPrice = await getCurrentPrice(sub.cryptoId);

    if (currentPrice === null) {
      return ctx.editMessageText(
        `⚠️ Could not fetch the current price for ${escapeHtml(
          sub.cryptoId.toUpperCase()
        )}.\n\n<b>Simulation Data:</b>\nInitial Investment: $${sub.investmentAmount.toFixed(2)}\nStart Price: $${sub.initialCoinPrice.toFixed(2)}`,
        { parse_mode: "HTML" }
      );
    }

    const initialCoinPrice = sub.initialCoinPrice;
    const initialQuantity = sub.investmentAmount / initialCoinPrice;
    const currentValue = initialQuantity * currentPrice;
    const profitLoss = currentValue - sub.investmentAmount;
    const percentageChange = (profitLoss / sub.investmentAmount) * 100;

    const deltaEmoji = profitLoss >= 0 ? "📈" : "📉";
    const plSign = profitLoss >= 0 ? "+" : "";

    const message = `
        <b>${escapeHtml(deltaEmoji + ' Live Performance: ' + sub.cryptoId.toUpperCase())}</b>\n\n<b>Investment Overview:</b>\nInitial Investment: $${sub.investmentAmount.toFixed(2)}\nCurrent Value: $${currentValue.toFixed(2)}\nProfit/Loss (P&L): ${plSign}$${profitLoss.toFixed(2)}\n% Change: ${plSign}${percentageChange.toFixed(2)}%\n\n<b>Data Points:</b>\nStart Price (${escapeHtml(
      sub.startDate.toLocaleDateString()
    )}): $${initialCoinPrice.toFixed(2)}\nCurrent Price: $${currentPrice.toFixed(2)}\nInitial Quantity: ${initialQuantity.toFixed(8)} ${escapeHtml(
      sub.cryptoId.toUpperCase()
    )}\n\n<b>Updates:</b> ${escapeHtml(sub.updateInterval)}\n\n---`;

    const keyboard = new InlineKeyboard()
      .text("🔄 Refresh Data", `view_details:${subscriptionIdStr}`)
      .row()
      .text("🗑️ Delete Simulation", `delete_sub:${subscriptionIdStr}`)
      .row()
      .text("🔙 View All Subscriptions", "view_subs");

    await ctx.editMessageText(message, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error("Error displaying subscription details:", error);
    await ctx.editMessageText(
      "An unexpected error occurred while processing your simulation details."
    );
  }
});

bot.callbackQuery("view_top_10", async (ctx) => {
  await ctx.answerCallbackQuery("Fetching top 10 coins...");

  const coinList = await getCoinList();

  if (coinList.length === 0) {
    return ctx.editMessageText(
      "Sorry, coin data not found. Try searching instead."
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

  await ctx.editMessageText("🏆 <b>Top 10 by Market Cap</b> 👇 Choose your giant.", {
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

bot.callbackQuery("start_search", async (ctx) => {
  const telegramId = String(ctx.from.id);

  await saveSession(telegramId, "SEARCH_MODE");

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `🔍 <b>Enter the full name or symbol of the coin</b> you want to simulate (e.g., <i>Bitcoin</i> or <b>ETH</b>).`,
    {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("🔙 Back", "start_sim").row(),
    }
  );
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

//development: long polling
// bot.start();

export default async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== "POST") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("The bot handler is listening for POST requests.");
    return;
  }

  const handler = webhookCallback(bot, "https");

  try {
    await handler(req, res);
  } catch (error) {
    console.error("GrammY webhook handler error:", error);

    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
};
