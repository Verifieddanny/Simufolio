import { IncomingMessage, ServerResponse } from 'http';
import { connectToDatabase } from '../lib/db.js'; 
import { getCurrentPrice } from '../lib/coinGeckoApi.js';
import { sendTelegramNotification, isNotificationDue } from '../lib/notification_helpers.js';
import { ObjectId } from 'mongodb';
import type { Subscription } from '../lib/portfolio.js';

const SUBSCRIPTION_COLLECTION = 'subscriptions';


export default async (req: IncomingMessage, res: ServerResponse) => {
    const authHeader = req.headers['authorization'];
    const expectedSecret = process.env.CRON_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized: Invalid Cron Secret.');
        return;
    }
    
    const db = await connectToDatabase();
    const subscriptions = db.collection(SUBSCRIPTION_COLLECTION);
    
    const now = new Date();
    let notificationsSent = 0;

    try {
        const cursor = subscriptions.find();

        const subs: Subscription[] = await cursor.toArray() as Subscription[];

        for (const sub of subs) {
            if (!isNotificationDue(sub)) {
                continue; 
            }
            
            const currentPrice = await getCurrentPrice(sub.cryptoId);
            if (currentPrice === null) {
                console.warn(`Skipping notification for ${sub.cryptoId}: Price unavailable.`);
                continue;
            }

            const initialQuantity = sub.investmentAmount / sub.initialCoinPrice;
            const currentValue = initialQuantity * currentPrice;
            const profitLoss = currentValue - sub.investmentAmount;
            const percentageChange = (profitLoss / sub.investmentAmount) * 100;

            const deltaEmoji = profitLoss >= 0 ? '🟢' : '🔴';
            const plSign = profitLoss >= 0 ? '+' : '';

            const message = `
${deltaEmoji} *TimeVest Update: ${sub.cryptoId.toUpperCase()}*
Subscription: ${sub.updateInterval}

*Initial Investment:* $${sub.investmentAmount.toFixed(2)}
*Current Value:* $${currentValue.toFixed(2)}
*Total P&L:* ${plSign}$${profitLoss.toFixed(2)} (${plSign}${percentageChange.toFixed(2)}%)
Current Price: $${currentPrice.toFixed(2)}

To see all details, use the /start command.
            `;

            // 4. Send Notification
            const success = await sendTelegramNotification(sub.telegramId, message, 'MarkdownV2');

            if (success) {
                // 5. Update lastNotificationDate in MongoDB
                await subscriptions.updateOne(
                    { _id: sub._id as ObjectId },
                    { $set: { lastNotificationDate: now } }
                );
                notificationsSent++;
            }
        }

        // 6. Send success response back to Vercel Cron Job runner
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', totalProcessed: subs.length, notificationsSent: notificationsSent }));

    } catch (error) {
        console.error('CRON WORKER FATAL ERROR:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: errorMessage }));
    }
};