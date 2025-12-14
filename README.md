# 🪙 SimuFolio Telegram Bot

\![Bot Logo Placeholder]("https://cdn4.telesco.pe/file/juvLHSQ60Axfl1OXaybcOhppBsMm06PAYkbgKndrkWa7TM0W0wsezH88Qpw5GRLOnILSQN_lWUwSKGRBfZI8ZdVgiQgusS8Y0JCmX3smQcXyupEN2--NhCNVZ4IjxYxOuz8FALdPXaqxRi99KPR6pagUsbpOsyi5r_zzwlFlgnGkwZiYuwpGz_d_7_yW3mb07FVM492mYJxgWxaUf7RnW0H-7cvMgkuNVVxzu0RRR6dfj6GmGn_0Y2_eVNc8LYrNWZSTYG9t5P9GSBAkyc2Jn0KA5UlQ38XHt7NUMZTtK-CNTlJjybqNXC5anFKApfbj242x9_EDmMXfnSd9WS5VuQ.jpg")

**A stateless, cross-platform Telegram bot that allows users to create virtual, long-term cryptocurrency portfolio simulations and receive automated performance updates on their virtual investments.**

## 🌟 Highlights

  * **📈 Stateless Performance Tracking:** Relies on MongoDB Atlas for persistent session and subscription storage, ensuring zero data loss across serverless functions (Vercel).
  * **⏰ Proactive Notifications:** Users receive automated price updates (Hourly/Daily/Monthly) via an external Cron Job worker, ensuring continuous monitoring.
  * **🔎 Intelligent Search:** Quickly find any coin using its name or symbol via the CoinGecko Search API, along with a top 10 list for major assets.
  * **💸 Real-World Simulation:** Uses CoinGecko historical data to calculate actual Profit & Loss (P\&L) and percentage change based on the initial investment amount.

## 🚀 Getting Started

This guide assumes you have **Node.js/Deno** and **npm** installed, along with credentials for **Telegram**, **CoinGecko**, and **MongoDB Atlas**.

### 1\. Prerequisites

  * **Node.js / Deno Runtime:** Used for local development and running the Vercel Serverless Functions.
  * **MongoDB Atlas Cluster:** Required for stateless session and subscription data persistence.
  * **Telegram Bot Token:** Obtained from **BotFather**.
  * **CoinGecko API Key:** Free/Demo key is sufficient (but note the 365-day historical data limit).
  * **External Cron Service:** ([cron-job.org](https://cron-job.org/)) essential for automated updates.

### 2\. Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/simufolio.git
    cd simufolio
    ```
2.  **Install dependencies:**
    ```bash
    npm install # or yarn install
    ```
3.  **Setup Environment Variables:** Create a file named `.env` in the root directory and fill in your keys:
    ```env
    # Telegram Bot Token
    TG_BOT_API_KEY="YOUR_TELEGRAM_BOT_TOKEN"

    # MongoDB Atlas Connection String
    MONGO_URI="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/SimuFolioDB?retryWrites=true&w=majority"

    # CoinGecko Demo API Key
    COIN_GECKO_API="CG-XXXXXXXXXXXXXXXXXXXXX"

    # CRON Job Security Secret (Used by external scheduler only)
    CRON_SECRET="A_VERY_LONG_SECRET_STRING_FOR_WORKER_AUTH"
    ```

### 3\. Local Development (Polling Mode)

To run the bot on your local machine for testing the conversation flow:

```bash
# Ensure you are using the correct Deno command if running locally
deno run --allow-env --allow-net bot.ts
```

### 4\. Deployment (Vercel Webhook)

1.  **Configure Vercel:** Deploy the repository to Vercel. Ensure all variables from the `.env` file (except `CRON_SECRET`) are set in the Vercel Dashboard Environment Variables.
2.  **Set Webhook:** After deployment, link your Telegram bot to the Vercel function URL:
    ```
    https://api.telegram.org/bot<TG_BOT_API_KEY>/setWebhook?url=https://<YOUR_VERCEL_DOMAIN>/api/bot
    ```

-----

## 🏗️ Architecture & Workers

### 1\. File Structure

```
.
├── api/
│   ├── bot.ts                # Main GrammY webhook handler
│   └── notification_worker.ts # CRON job endpoint for automated pings
├── lib/
│   ├── coinGeckoApi.ts       # CoinGecko API wrappers (price, metadata, search)
│   ├── db.ts                 # MongoDB Atlas connection utility
│   ├── portfolio.ts          # MongoDB CRUD operations (subscriptions)
│   ├── session.ts            # MongoDB CRUD operations (temporary session state)
│   └── notification_helpers.ts # Utility for sending direct Telegram messages
├── node_modules/
├── .env
├── package.json
└── vercel.json               # Defines Vercel functions and CRON schedule
```

### 2\. Stateless Session Management

Since Vercel is stateless, we use the `lib/session.ts` service with MongoDB to maintain user conversation progress across multiple function invocations. This is crucial for the multi-step input (Coin Selection $\rightarrow$ Amount Input).

### 3\. Automated Notification Worker

Due to Vercel Hobby limits, the automated updates rely on an external scheduler.

| Component | Function | Frequency |
| :--- | :--- | :--- |
| **External Cron Service** | Calls Vercel URL with `Authorization` header. | Hourly (or Daily, based on user selection) |
| **Notification Worker** | `api/notification_worker.ts` | Runs on every trigger. |
| **Worker Logic** | Queries MongoDB for due subscriptions, fetches CoinGecko current prices, calculates P\&L, and uses `sendMessage` to send a direct Telegram message to the user. |

-----

## 🗺️ Usage & Bot Flow

The bot uses a guided, button-driven conversational flow to establish a simulation.

1.  **`/start`:** Presents the main options (Start Simulation / View Subscriptions).
2.  **🚀 Start New Simulation:** User chooses **Search** or **Top 10 List**.
3.  **Select Coin:** User selects the coin (e.g., Bitcoin).
4.  **Input Amount (Text Reply):** The user replies with the dollar amount. (The session state is saved in MongoDB here).
5.  **Select Interval:** User chooses **Hourly**, **Daily**, or **Monthly** updates.
6.  **Confirm:** The subscription is created and stored in the `subscriptions` collection.
7.  **📊 View My Subscriptions:** Displays a list of all active simulations for the user, allowing them to click for live performance checks.

-----

## 👤 Authors & License

| Role | Name | GitHub |
| :--- | :--- | :--- |
| **Developer** | Devdanny | [Your GitHub Profile]("https://github.com/Verifieddanny") |

This project is licensed under the **MIT License**.
