# SubConscious Invest API (Backend)

FastAPI backend for the Expo frontend. Runs on **port 8000** by default.

## Run the backend (so the Expo frontend can use it)

### 1. Use a virtual environment (recommended)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment variables

Copy `.env.example` to `.env`. You only need:

- **MONGODB_URI** — e.g. `mongodb://localhost:27017` (or MongoDB Atlas connection string)
- **JWT_SECRET** — any random string for signing tokens

The server **starts even if MongoDB is down** (you’ll see a warning). Register/login will work once MongoDB is running.

### 3. Start MongoDB (required for register/login)

- **macOS (Homebrew):** `brew services start mongodb-community`
- **Docker:** `docker run -d -p 27017:27017 mongo:7`

### 4. Start the API server

From the **backend** directory with your venv activated:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- `--reload` — auto-restart on code changes (dev only).
- `--host 0.0.0.0` — listen on all interfaces so the Expo app can reach it (see below).

---

## Running backend and Expo at the same time

Use **two terminals**:

| Terminal 1 (backend)        | Terminal 2 (frontend)   |
|-----------------------------|--------------------------|
| `cd backend && source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` | `cd frontend && npx expo start` |

The frontend is already configured to use:

- **iOS Simulator:** `http://localhost:8000`
- **Android Emulator:** `http://10.0.2.2:8000`
- **Physical device on same Wi‑Fi:** set your machine’s LAN IP (e.g. `http://192.168.1.5:8000`) via `EXPO_PUBLIC_API_URL` in `frontend/.env` or in `app.config.js` / `app.json` extra.

---

## Quick health check

With the server running:

```bash
curl http://localhost:8000/health
# => {"status":"healthy"}
```

---

## Common errors

| Error | What to do |
|-------|------------|
| **ModuleNotFoundError: No module named 'fastapi'** | Activate venv and run `pip install -r requirements.txt` from `backend`. |
| **Register/login fails or MongoDB warning on startup** | Start MongoDB (see step 3) or set `MONGODB_URI` in `.env`. |
| **Port 8000 already in use** | Stop the process using 8000 or run uvicorn with `--port 8001` and point the frontend to that port. |
| **Expo app can’t reach API** | Use `--host 0.0.0.0`; on a physical device, use your computer’s LAN IP and ensure phone and computer are on the same Wi‑Fi. |

---

## API overview (current — auth only)

- `GET /` — API info  
- `GET /health` — Health check  
- `POST /auth/register` — Register  
- `POST /auth/login` — Login  
- `GET /auth/me` — Current user (Bearer token)  
- `PUT /auth/risk-profile` — Update risk profile  

Plaid, transactions, investments, and AI routes can be re-enabled later when you add those features.
