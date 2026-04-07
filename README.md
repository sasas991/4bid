# 4bid

A decentralized auction and settlement platform built on Solana. No banks, no intermediaries, no centralized accounts — just wallets, bids, and transparent deal cycles.

## What is 4bid?

4bid lets users tokenize assets/services and run auctions using their Solana wallet as identity. Auction-critical state is handled on-chain, while backend mirrors verified chain state for fast UI reads.

**Supported lot types:**

- Physical goods
- Services
- Knowledge / information
- Digital services

## Problem we solve

Traditional marketplaces rely on platform trust for critical outcomes:

- auction progression and winner determination
- settlement/refund correctness
- custody assumptions around deal state

4bid solves this by combining:

- on-chain auction authority (program-enforced outcomes)
- tokenization-first listing flow for assets/services
- backend verification/projection layer for fast UX reads

## Architecture

```text
Frontend (Next.js)
      │
      │  REST API
      │
Backend (FastAPI)
      │              │
      │ SQL          │ RPC
      │              │
PostgreSQL      Solana Network
```

- **Presentation layer**: Next.js + wallet adapter
- **Application layer**: FastAPI (auth, metadata, projection sync)
- **Data layer**: PostgreSQL (off-chain projection/cache)
- **Blockchain layer**: Anchor program (source of truth for critical auction outcomes)

## Trust model

Chain decides; backend verifies/mirrors; frontend signs.

Critical auction operations are intended to be on-chain:

- create auction
- commit/reveal bid
- finalize/cancel auction
- settlement/refunds

## Tech stack

**Frontend**

- Next.js 16 + TypeScript
- `@solana/wallet-adapter`
- `@coral-xyz/anchor`

**Backend**

- FastAPI + SQLAlchemy + Alembic
- PostgreSQL
- `solana-py` + `solders`

**Infrastructure**

- Docker Compose
- MinIO

## Getting started

```bash
# Clone
git clone https://github.com/sasas991/4bid.git
cd 4bid

# Start all services
docker compose up -d --build
docker compose ps
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:8000`.

## Docker commands

```bash
# follow logs
docker compose logs -f backend frontend

# restart services
docker compose restart backend
docker compose restart frontend

# stop stack
docker compose down

# full reset (includes db volume)
docker compose down -v

# clean orphan containers
docker compose down --remove-orphans
```

If you get Docker permission errors (`docker.sock`), run with `sudo` or add your user to the `docker` group.

## Development checks

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run build
```

Contract:

```bash
cd contracts/tokenization-contract
anchor build
anchor test
```

## Localnet flow (free testing)

Use local validator if devnet faucet is rate-limited:

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

Deploy contract to localnet:

```bash
cd contracts/tokenization-contract
anchor build
anchor deploy
```

Then run app stack and test from UI.

## Common issues

### `permission denied ... docker.sock`

Run docker commands with `sudo` or fix docker group permissions.

### `failed to bind host port 8000`

Port 8000 is already in use. Stop the conflicting process/container, then restart compose.

### Auction appears in backend but on-chain initialization failed

This means metadata create succeeded, but chain tx failed. Check:

- wallet has SOL for fees
- network matches app/validator
- connected wallet matches authenticated account
- contract/protocol is initialized
- frontend/backend logs during submit

## Contract README

Contract-specific instructions:

- [contracts/tokenization-contract/README.md](contracts/tokenization-contract/README.md)