# 4bid

4bid is a Solana-based auction marketplace for tokenized lots (goods/services) with on-chain settlement logic and a fast web UX.

## Problem

Traditional auction platforms keep critical state off-chain:
- winners and final prices are trusted to platform logic
- settlement and refund rules are opaque
- users depend on centralized operators

## What 4bid Solves

4bid moves auction-critical decisions into smart contract flow and keeps backend as a projection/API layer.

Core goals:
- predictable, program-enforced auction outcomes
- tokenization-first listing flow for lots
- transparent lifecycle: create -> bid -> finalize -> settle/refund
- wallet-first user flow for signing and ownership

## Product Scope

Supported lot categories:
- Physical goods
- Services
- Knowledge
- Digital services

High-level capabilities:
- create and manage auctions
- place and track bids
- finalize/cancel by rules
- settlement/refund paths
- profile + listing management

## Architecture

```text
Next.js Frontend (UI + wallet)
          |
          | HTTP
          v
FastAPI Backend (auth, API, projection)
      |                    |
      | SQL                | Solana RPC
      v                    v
PostgreSQL           Solana Program (Anchor)
```

Trust boundary:
- On-chain program: source of truth for critical auction logic
- Backend: read model/projection, integrations, API orchestration
- Frontend: transaction preparation + wallet signatures + UX

## Tech Stack

Frontend:
- Next.js 16
- TypeScript
- Solana wallet adapter
- Anchor client libs

Backend:
- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL
- solana-py / solders

Infra:
- Docker Compose
- MinIO (file storage)

## Repository Layout

```text
4bid/
├── frontend/                      # Next.js app
├── backend/                       # FastAPI app + migrations + scripts
├── contracts/tokenization-contract/ # Anchor program + tests
├── docker-compose.yml
└── README.md
```

## Quick Start (Docker)

```bash
git clone https://github.com/sasas991/4bid.git
cd 4bid

# Start all services
docker compose up -d --build

# Check status
docker compose ps
```

Endpoints:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`
- MinIO console: `http://localhost:9001`

## Environment Notes

`docker-compose.yml` already contains sane local defaults.

Common overrides:
- `GOOGLE_CLIENT_ID` (optional; for Google auth path)
- `DEV_AUTH_BYPASS=true` (enabled by default for local dev)
- `SOLANA_RPC_URL` (defaults to devnet in backend compose env)

## Daily Dev Commands

```bash
# Logs
docker compose logs -f backend frontend

# Restart one service
docker compose restart backend
docker compose restart frontend

# Stop
docker compose down

# Full reset (including DB volume)
docker compose down -v

# Remove orphan containers
docker compose down --remove-orphans
```

## Frontend Validation

```bash
cd frontend
npm install
npm run lint
npm run build
```

## Contract Validation (Anchor)

```bash
cd contracts/tokenization-contract
anchor build
anchor test
```

If validator startup fails during tests, clear local test ledger and retry:

```bash
rm -rf .anchor/test-ledger
anchor test
```

## Localnet Testing Flow (No Real Money)

Use local validator for deterministic testing and free SOL:

Terminal 1:
```bash
solana-test-validator --reset
```

Terminal 2:
```bash
solana config set --url http://127.0.0.1:8899
solana airdrop 100
solana balance
```

Then deploy contract:

```bash
cd contracts/tokenization-contract
anchor build
anchor deploy
```

Then run web stack and test full auction flows from UI.

## Troubleshooting

### Docker permission denied (`docker.sock`)

Use `sudo docker ...` or add your user to docker group:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Port 8000 already in use

```bash
sudo lsof -i :8000
sudo fuser -k 8000/tcp
```

Then restart compose.

### Backend starts but frontend create/list fails

Check:
- wallet network matches backend/program network
- wallet has SOL for transaction fees
- program is deployed on selected cluster
- backend and frontend logs during submit (`docker compose logs -f`)

### Google login error: `Missing required parameter: client_id`

Set `GOOGLE_CLIENT_ID` before compose up/rebuild.

## Related Docs

- Contract docs: [`contracts/tokenization-contract/README.md`](contracts/tokenization-contract/README.md)

## License

MIT (see `LICENSE` if present in your branch/repo policy).
