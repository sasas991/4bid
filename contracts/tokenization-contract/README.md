# 4bid On-Chain Auction Program (Anchor 0.32.1)

## Docker note

This README is for the on-chain program only.
To run the full app (frontend + backend + db + minio), use root README:

- `../../README.md`

Quick app start from repo root:

```bash
cd /path/to/4bid
sudo docker compose up -d --build
sudo docker compose ps
```

## Build

```bash
cd contracts/tokenization-contract
anchor build
```

## Test

```bash
cd contracts/tokenization-contract
anchor test
```

## Deploy (Devnet)

```bash
cd contracts/tokenization-contract
solana config set --url https://api.devnet.solana.com
anchor build
anchor deploy --provider.cluster devnet
```

## Notes

- Auction state is on-chain and is the source of truth.
- Backend should only index/cache on-chain state and expose read APIs for frontend UX.
- Commit-reveal hides bid amounts until reveal phase, but wallet addresses remain public.
