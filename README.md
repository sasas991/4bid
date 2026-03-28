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
- **Application Layer** — FastAPI handling auth, auctions, bids, payments, and order lifecycle
- **Data Layer** — PostgreSQL storing users, auctions, bids, orders, and delivery status
- **Blockchain Layer** — Solana for wallet identity, SOL transfers, and signature verification

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
3. **Place a bid** — Each bid is signed by your wallet's private key. Bids must exceed the current highest.
4. **Win and pay** — Winner sends SOL directly to the seller; payment is verified via Solana RPC.
5. **Confirm delivery** — Both parties confirm each stage of the deal lifecycle.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/your-org/4bid.git
cd 4bid

# Start all services
docker compose up
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:8000`.

## License

See [LICENSE](LICENSE).
