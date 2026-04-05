# 4bid

A decentralized auction and settlement platform built on Solana. No banks, no intermediaries, no centralized accounts — just wallets, bids, and transparent deal cycles.

## What is 4bid?

4bid lets users create and participate in auctions using their Solana wallet as their identity. Bids are cryptographically signed, payments are made in SOL, and every stage of the deal — from bid to delivery confirmation — is tracked transparently.

**Supported lot types:**
- Physical goods (electronics, items)
- Services (design, development, consulting)
- Knowledge (courses, mentorship, information access)

## Architecture

```
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

- **Presentation Layer** — Next.js with Solana Wallet Adapter
- **Application Layer** — FastAPI for auth, metadata, and chain-state indexing/projections
- **Data Layer** — PostgreSQL storing user data + mirrored on-chain auction projections
- **Blockchain Layer** — Solana Anchor program as the source of truth for critical auction execution

## Tech Stack

**Frontend**
- Next.js (App Router) + TypeScript
- `@solana/wallet-adapter` (Phantom / Solflare)
- TanStack Query
- Tailwind CSS

**Backend**
- Python 3.11+ / FastAPI
- SQLAlchemy + Alembic
- PostgreSQL
- `solana-py` / `solders`

**Infrastructure**
- Docker / Docker Compose
- Nginx (reverse proxy)

## How It Works

1. **Connect wallet** — No registration, no email, no password. Your wallet is your identity.
2. **Create or browse auctions** — Filter by lot type, view bid history.
3. **Place/Reveal bids on-chain** — Commit/reveal and bid validity are enforced by the smart contract.
4. **Finalize/settle on-chain** — Winner selection, settlement, refunds, and cancellation are executed on-chain.
5. **Read via backend projections** — Backend indexes chain state for fast UI queries but is not authoritative.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/sasas991/4bid.git
cd 4bid

# Start all services
docker compose up
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:8000`.

## License

See [LICENSE](LICENSE).
