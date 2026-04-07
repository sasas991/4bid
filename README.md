# 4bid

4bid is a Solana-based auction platform with an on-chain trust model:

- critical auction outcomes are decided by the Anchor program
- backend mirrors verified chain state for UX/read performance
- frontend signs and submits transactions from user wallets

## Core idea

`Chain decides. Backend verifies/mirrors. Frontend signs.`

4bid supports:

- physical goods
- physical services
- digital services
- information/knowledge lots

## Trust model

Critical actions are intended to be on-chain:

- create auction state
- commit bid
- reveal bid
- finalize auction state
- settle winner asset/funds
- refund loser
- cancel auction

Backend is a projection/indexing layer for fast API responses, not final authority.

## Privacy model (important)

4bid is **pseudonymous**, not fully anonymous.

- wallet signatures authorize actions
- wallet addresses and transactions are public on Solana
- optional Google auth can link identity data (`email`, `google_id`, `username`, etc.)

## High-level architecture

```text
Next.js Frontend  --->  FastAPI Backend  ---> PostgreSQL (projection cache)
       |                      |
       |                      ---> Solana RPC (read + verify)
       |
       ---> Wallet signatures + Anchor tx submission (Solana)
```

## Tech stack

Frontend:

- Next.js 16 + TypeScript
- Solana wallet adapter
- Anchor client (`@coral-xyz/anchor`)

Backend:

- FastAPI + SQLAlchemy + Alembic
- PostgreSQL
- `solana-py` + `solders`

Infra:

- Docker Compose
- MinIO for file storage

## Repository layout

```text
4bid/
  backend/                     FastAPI service + DB models + migrations
  frontend/                    Next.js app
  contracts/tokenization-contract/
                               Anchor program + tests
  docker-compose.yml
```

## Docker (full app)

From repo root:

```bash
cd ~/programming/grinding_python/4bid
sudo docker compose up -d --build
sudo docker compose ps
```

Endpoints:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- Backend docs: `http://localhost:8000/docs`
- MinIO console: `http://localhost:9001`

Useful Docker commands:

```bash
# follow backend/frontend logs
sudo docker compose logs -f backend frontend

# restart one service
sudo docker compose restart backend
sudo docker compose restart frontend

# stop stack
sudo docker compose down

# stop + remove volumes (full reset)
sudo docker compose down -v

# stop + remove orphans
sudo docker compose down --remove-orphans
```

If Docker permission error appears:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## Frontend checks

```bash
cd frontend
npm install
npm run lint
npm run build
```

## Contract checks

```bash
cd contracts/tokenization-contract
anchor build
anchor test
```

## Running local validator flow (free testing)

If devnet faucet limits block you, use local validator:

Terminal 1:

```bash
cd ~/programming/grinding_python/4bid
solana-test-validator --reset
```

Terminal 2:

```bash
solana config set --url http://127.0.0.1:8899
solana airdrop 100
solana balance
```

Deploy program:

```bash
cd ~/programming/grinding_python/4bid/contracts/tokenization-contract
anchor build
anchor deploy
```

Then run app stack:

```bash
cd ~/programming/grinding_python/4bid
sudo docker compose up -d --build
```

## Mainnet/devnet funding note

On Solana, token transfers still need SOL for fees.
If wallet has `0 SOL`, on-chain actions fail even if it has PYUSD.

## Common issues

### `permission denied ... docker.sock`

Use `sudo docker compose ...` or add your user to `docker` group.

### `address already in use :8000`

Port 8000 is occupied (often by another backend or validator gossip bind side effect).
Stop the conflicting process/container, then restart compose.

### Auction row created but UI says on-chain initialization failed

This means backend metadata create succeeded, but chain tx step failed.
Check:

- connected wallet matches authenticated account
- wallet has SOL for fees
- correct network (localnet/devnet/mainnet)
- protocol/program initialization state
- frontend + backend logs at submit time

## Current auth modes

- Wallet nonce + signature login
- Optional Google login
- Dev bypass mode (`DEV_AUTH_BYPASS`) for local testing only

## Do not use dev bypass in production

`DEV_AUTH_BYPASS=true` is for local development/testing only.
Keep it disabled in production.

## Contract README

Contract-specific build/test/deploy notes:

- [contracts/tokenization-contract/README.md](contracts/tokenization-contract/README.md)

## License

See [LICENSE](LICENSE)
