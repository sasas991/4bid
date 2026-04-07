"use client";

import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, Connection, Signer } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import idlJson from "./tokenization_contract.json";

const PROGRAM_ID = new PublicKey("2KQUuKgA5QXLgUdzRDCDEM1kgAfRnKucgAp6N38iihYa");

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const PROTOCOL_SEED = Buffer.from("protocol");
const ASSET_SEED = Buffer.from("asset");
const AUCTION_SEED = Buffer.from("auction");
const BID_COMMIT_SEED = Buffer.from("bid_commit");
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");

type ProgramMethodBuilder = {
  accounts: (accounts: Record<string, unknown>) => {
    signers?: (signers: Signer[]) => { rpc: () => Promise<string> };
    rpc: () => Promise<string>;
  };
};

type ProgramMethods = Record<string, (...args: unknown[]) => ProgramMethodBuilder>;

const idl: unknown = idlJson;

function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function u64Le(value: BN | number): Buffer {
  const bn = value instanceof BN ? value : new BN(value);
  return bn.toArrayLike(Buffer, "le", 8);
}

function parseProtocolState(data: Buffer): { nextAssetId: BN; nextAuctionId: BN } {
  // Anchor account discriminator (8 bytes) + fields from state.rs
  const offset = 8 + 32 + 32 + 2 + 1;
  const nextAssetId = new BN(data.subarray(offset, offset + 8), "le");
  const nextAuctionId = new BN(data.subarray(offset + 8, offset + 16), "le");
  return { nextAssetId, nextAuctionId };
}

function random32(): Uint8Array {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function sha256(chunks: Uint8Array[]): Promise<Uint8Array> {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const hash = await crypto.subtle.digest("SHA-256", merged);
  return new Uint8Array(hash);
}

function ensureWallet(wallet: WalletContextState): asserts wallet is WalletContextState & {
  publicKey: PublicKey;
  signTransaction: NonNullable<WalletContextState["signTransaction"]>;
} {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected or cannot sign transactions");
  }
}

function getProgram(connection: Connection, wallet: WalletContextState) {
  ensureWallet(wallet);
  const provider = new AnchorProvider(
    connection,
    wallet as unknown as Parameters<typeof AnchorProvider>[1],
    { commitment: "confirmed" },
  );
  return new Program(idl as never, provider);
}

export async function createAuctionOnChain(params: {
  connection: Connection;
  wallet: WalletContextState;
  title: string;
  metadataUri: string;
  realWorldRef: string;
  minBidLamports: BN;
  commitDurationSec?: number;
  revealDurationSec?: number;
}) {
  const { connection, wallet } = params;
  ensureWallet(wallet);

  const program = getProgram(connection, wallet);
  const methods = program.methods as unknown as ProgramMethods;
  const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
  const protocolInfo = await connection.getAccountInfo(protocolPda, "confirmed");
  if (!protocolInfo?.data) {
    throw new Error("Protocol is not initialized on-chain");
  }

  const { nextAssetId, nextAuctionId } = parseProtocolState(Buffer.from(protocolInfo.data));

  const [assetPda] = PublicKey.findProgramAddressSync(
    [ASSET_SEED, protocolPda.toBuffer(), u64Le(nextAssetId)],
    PROGRAM_ID,
  );

  const mint = Keypair.generate();
  const creatorAta = deriveAta(wallet.publicKey, mint.publicKey);

  const createAssetSig = await methods
    .createAsset({
      assetId: nextAssetId,
      title: params.title,
      metadataUri: params.metadataUri,
      realWorldRef: params.realWorldRef,
      verificationHash: Array.from(random32()),
      decimals: 0,
    })
    .accounts({
      mint: mint.publicKey,
    })
    .signers?.([mint as Signer])?.rpc();

  if (!createAssetSig) {
    throw new Error("Failed to create asset transaction");
  }

  const now = Math.floor(Date.now() / 1000);
  const startTs = new BN(now + 10);
  const commitEndTs = new BN(startTs.toNumber() + (params.commitDurationSec ?? 120));
  const revealEndTs = new BN(commitEndTs.toNumber() + (params.revealDurationSec ?? 120));

  const createAuctionSig = await methods
    .createAuction({
      auctionId: nextAuctionId,
      startTs,
      commitEndTs,
      revealEndTs,
      minBidLamports: params.minBidLamports,
    })
    .accounts({
      asset: assetPda,
    })
    .rpc();

  // Re-derive PDAs after successful transactions (must match on-chain seeds)
  const [auctionPda] = PublicKey.findProgramAddressSync(
    [AUCTION_SEED, assetPda.toBuffer(), u64Le(nextAuctionId)],
    PROGRAM_ID,
  );

  return {
    createAssetSig,
    createAuctionSig,
    auctionPda: auctionPda.toBase58(),
    assetPda: assetPda.toBase58(),
    mint: mint.publicKey.toBase58(),
    sellerPubkey: wallet.publicKey.toBase58(),
    chainStatus: "created",
    startTs: startTs.toNumber(),
    commitEndTs: commitEndTs.toNumber(),
    revealEndTs: revealEndTs.toNumber(),
  };
}

export async function commitBidOnChain(params: {
  connection: Connection;
  wallet: WalletContextState;
  auctionPubkey: string;
  amountLamports: BN;
}) {
  const { connection, wallet, auctionPubkey, amountLamports } = params;
  ensureWallet(wallet);
  const program = getProgram(connection, wallet);
  const methods = program.methods as unknown as ProgramMethods;
  const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
  const auction = new PublicKey(auctionPubkey);

  const [bidCommitPda] = PublicKey.findProgramAddressSync(
    [BID_COMMIT_SEED, auction.toBuffer(), wallet.publicKey.toBuffer()],
    PROGRAM_ID,
  );

  const salt = random32();
  const digest = await sha256([
    auction.toBytes(),
    wallet.publicKey.toBytes(),
    u64Le(amountLamports),
    salt,
  ]);

  const signature = await methods
    .commitBid({
      commitment: Array.from(digest),
      committedAmountLamports: amountLamports,
    })
    .accounts({
      protocol: protocolPda,
      auction,
      bidder: wallet.publicKey,
      bidCommit: bidCommitPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return {
    signature,
    bidCommitPda: bidCommitPda.toBase58(),
    saltHex: bytesToHex(salt),
  };
}

export async function revealBidOnChain(params: {
  connection: Connection;
  wallet: WalletContextState;
  auctionPubkey: string;
  amountLamports: BN;
  saltHex: string;
}) {
  const { connection, wallet, auctionPubkey, amountLamports, saltHex } = params;
  ensureWallet(wallet);
  const program = getProgram(connection, wallet);
  const methods = program.methods as unknown as ProgramMethods;
  const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
  const auction = new PublicKey(auctionPubkey);

  const [bidCommitPda] = PublicKey.findProgramAddressSync(
    [BID_COMMIT_SEED, auction.toBuffer(), wallet.publicKey.toBuffer()],
    PROGRAM_ID,
  );

  const signature = await methods
    .revealBid({
      amountLamports,
      salt: Array.from(hexToBytes(saltHex)),
    })
    .accounts({
      protocol: protocolPda,
      auction,
      bidder: wallet.publicKey,
      bidCommit: bidCommitPda,
    })
    .rpc();

  return { signature, bidCommitPda: bidCommitPda.toBase58() };
}

export async function finalizeAuctionOnChain(params: {
  connection: Connection;
  wallet: WalletContextState;
  auctionPubkey: string;
  sellerPubkey: string;
  treasuryPubkey: string;
  winnerPubkey: string;
}) {
  const { connection, wallet, auctionPubkey, sellerPubkey, treasuryPubkey, winnerPubkey } = params;
  ensureWallet(wallet);
  const program = getProgram(connection, wallet);
  const methods = program.methods as unknown as ProgramMethods;
  const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);
  const auction = new PublicKey(auctionPubkey);
  const winner = new PublicKey(winnerPubkey);

  const [winningBidCommit] = PublicKey.findProgramAddressSync(
    [BID_COMMIT_SEED, auction.toBuffer(), winner.toBuffer()],
    PROGRAM_ID,
  );

  const signature = await methods
    .finalizeAuctionState()
    .accounts({
      protocol: protocolPda,
      auction,
      winningBidCommit,
      seller: new PublicKey(sellerPubkey),
      treasury: new PublicKey(treasuryPubkey),
    })
    .rpc();

  return { signature, winningBidCommit: winningBidCommit.toBase58() };
}

export async function cancelAuctionOnChain(params: {
  connection: Connection;
  wallet: WalletContextState;
  auctionPubkey: string;
  assetPubkey: string;
  mintPubkey: string;
  sellerPubkey: string;
}) {
  const { connection, wallet, auctionPubkey, assetPubkey, mintPubkey, sellerPubkey } = params;
  ensureWallet(wallet);
  const program = getProgram(connection, wallet);
  const methods = program.methods as unknown as ProgramMethods;
  const [protocolPda] = PublicKey.findProgramAddressSync([PROTOCOL_SEED], PROGRAM_ID);

  const auction = new PublicKey(auctionPubkey);
  const mint = new PublicKey(mintPubkey);
  const seller = new PublicKey(sellerPubkey);
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [VAULT_AUTHORITY_SEED, auction.toBuffer()],
    PROGRAM_ID,
  );

  const vaultAssetTokenAccount = deriveAta(vaultAuthorityPda, mint);
  const sellerAssetTokenAccount = deriveAta(seller, mint);

  const signature = await methods
    .cancelAuction()
    .accounts({
      protocol: protocolPda,
      auction,
      asset: new PublicKey(assetPubkey),
      mint,
      seller,
      vaultAuthority: vaultAuthorityPda,
      vaultAssetTokenAccount,
      sellerAssetTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { signature };
}
