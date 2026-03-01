# ChudInvesting

**Save a little from every purchase. Let AI invest it.**

ChudInvesting is a mobile-first app that turns everyday spending into automatic investing. Link your spending (or use demo transactions), set your risk level, and watch the app set aside a percentage of each transaction into a savings pool—then **AI auto-invests** that cash into stocks and crypto using real market prices. No broker link required; everything is simulated for a safe, hackathon-friendly demo.

---

## 🏆 Hackathon Submission

Built for **DeerHacks**. ChudInvesting demonstrates:

- **Behavioral nudge:** Save a % from each transaction (higher for discretionary, lower for essential).
- **AI-driven allocation:** Gemini suggests where to invest based on your balance and risk profile.
- **Real prices, simulated orders:** CoinGecko (crypto) + yfinance (stocks)—no real money moved.
- **Differentiated spending:** Rich demo transaction pool (discretionary vs essential) to show how savings rules adapt.

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| **Transaction-based savings** | Each purchase triggers a configurable savings % (essential vs discretionary). |
| **Risk profiles** | Chill / Moderate / Aggressive—controls savings % and AI’s suggested asset mix. |
| **Savings pool** | Accumulated cash from transaction savings; used as the source for investing. |
| **AI auto-invest** | After each processed transaction, Gemini suggests an asset (SPY, SOL, etc.); the app simulates a buy and adds a holding. |
| **Portfolio** | View holdings (stocks + Solana crypto), live prices, P&amp;L. Manually invest or sell; proceeds go back to the pool. |
| **Demo mode** | Add random or preset transactions (Starbucks, Netflix, Costco, utilities, etc.) to drive savings + auto-invest without a real bank. |
| **Bank linking (optional)** | Plaid integration for connecting a real account (sandbox supported). |

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Expo (React Native), TypeScript, Expo Router, React Native Plaid Link |
| **Backend** | FastAPI, Python 3.x, Pydantic |
| **Database** | Supabase (PostgreSQL + Auth-compatible JWT) |
| **AI** | Google Gemini (transaction classification + investment advice) |
| **Prices** | CoinGecko (crypto), yfinance (stocks) |
| **Banking** | Plaid (optional, sandbox) |

---

## 📁 Project Structure

```
deerhacks-v/
├── frontend/                 # Expo app (iOS, Android, Web)
│   ├── app/
│   │   ├── (auth)/            # Login, Register
│   │   ├── (tabs)/            # Dashboard, Portfolio, Settings
│   │   └── _layout.tsx
│   ├── components/
│   ├── services/              # API clients (auth, transactions, investments)
│   └── .env                   # EXPO_PUBLIC_API_URL
├── backend/                   # FastAPI API
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/           # auth, transactions, investments
│   │   ├── services/          # savings_engine, auto_invest, gemini, price_service, etc.
│   │   └── models/
│   ├── requirements.txt
│   └── .env                   # Supabase, JWT, Gemini, Plaid (optional)
└── README.md                  # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm** or **yarn**
- **Python** 3.10+
- **Supabase** account ([supabase.com](https://supabase.com))

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Copy environment variables:

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `SUPABASE_URL` — Project URL from Supabase dashboard  
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (backend only; never expose in frontend)  
- `JWT_SECRET` — Any strong random string for signing tokens  

Optional (for full experience):

- `GEMINI_API_KEY` — For AI classification and investment advice ([Google AI](https://aistudio.google.com/apikey))  
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox` — For bank linking  

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health check: [http://localhost:8000/health](http://localhost:8000/health) → `{"status":"healthy"}`

### 2. Supabase Setup

In the Supabase SQL editor, create the tables your app expects (users, transactions, investments, etc.). If you have migration files or a schema in the repo, run those. Minimum concept:

- **users** — id (uuid), email, password hash, risk_profile, savings_pool, etc.  
- **transactions** — id, user_id, merchant, amount, date, ai_category, processed, savings_amount, etc.  
- **investments** — id, user_id, asset, asset_type, shares, amount_invested, price_at_purchase, status, etc.

(Exact column names should match what the backend uses.)

### 3. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:8000
```

For a **physical device** on the same Wi‑Fi, use your machine’s LAN IP instead of `localhost`, e.g. `http://192.168.1.5:8000`.

Start Expo:

```bash
npx expo start
```

Then run on iOS Simulator, Android Emulator, or scan the QR code for a device.

### 4. Use the App

1. **Register** an account (stored in Supabase via the backend).  
2. **Set risk profile** in Settings (Chill / Moderate / Aggressive).  
3. **Dashboard** — See recent transactions and savings summary.  
4. **Settings → Demo** — Use “Add random transaction” or pick a preset (e.g. Starbucks, Netflix, Costco, utilities). Each add runs savings + auto-invest (if Gemini is configured).  
5. **Portfolio** — View holdings, invest from pool, or sell; new auto-invests appear here with correct values.

---

## 🔌 API Overview

| Area | Endpoints (examples) |
|------|------------------------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/risk-profile` |
| **Transactions** | `GET /transactions/`, `POST /transactions/add`, `GET /transactions/demo-options`, `POST /transactions/process`, `GET /transactions/savings` |
| **Investments** | `GET /investments/portfolio`, `GET /investments/history`, `POST /investments/execute`, `POST /investments/sell`, `GET /investments/advice`, `GET /investments/stocks/search` |
| **Health** | `GET /`, `GET /health` |

---

## 🎯 Demo Flow (Hackathon)

1. Open **Settings** → **Demo**.  
2. Tap **“Add random transaction”** or choose a preset (discretionary vs essential).  
3. Backend adds the transaction, runs savings (%), updates the pool, then triggers **auto-invest** (Gemini picks asset; simulated buy with real price).  
4. Open **Portfolio** — New holding appears with correct value; total balance = portfolio + savings pool.  
5. Optionally **Invest** more from pool or **Sell** a holding; proceeds return to the pool.

---

## 📜 License

MIT (or as specified for the hackathon).

---

## 🙏 Credits

- **DeerHacks** — Hackathon  
- **Supabase** — Backend and database  
- **Google Gemini** — AI classification and investment suggestions  
- **Plaid** — Bank linking (optional)  
- **CoinGecko** — Crypto prices  
- **yfinance** — Stock prices  

**ChudInvesting** — Save from every purchase. Let AI invest it.
