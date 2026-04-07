import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { readFileSync } from "fs";
import { createHash } from "crypto";

const PROGRAM_ID = new PublicKey("2KQUuKgA5QXLgUdzRDCDEM1kgAfRnKucgAp6N38iihYa");
const TREASURY = new PublicKey("2vMHvc2ChZtYXhN4vBQ9KDRj98jsJpW9ctHMx3Bfv1JL");
const FEE_BPS = 250; // 2.5%

// Load admin keypair
const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
const secret = JSON.parse(readFileSync(keypairPath, "utf-8"));
const admin = Keypair.fromSecretKey(Uint8Array.from(secret));

// Derive protocol PDA
const [protocolPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("protocol")],
  PROGRAM_ID,
);

// Build instruction data: 8-byte discriminator + u16 LE fee_bps
const discriminator = createHash("sha256")
  .update("global:initialize_protocol")
  .digest()
  .subarray(0, 8);
const data = Buffer.alloc(10);
discriminator.copy(data, 0);
data.writeUInt16LE(FEE_BPS, 8);

const ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: protocolPda, isSigner: false, isWritable: true },
    { pubkey: admin.publicKey, isSigner: true, isWritable: true },
    { pubkey: TREASURY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data,
});

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function main() {
  console.log("Admin:", admin.publicKey.toBase58());
  console.log("Protocol PDA:", protocolPda.toBase58());
  console.log("Treasury:", TREASURY.toBase58());
  console.log("Fee BPS:", FEE_BPS);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: admin.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([admin]);

  const sig = await connection.sendTransaction(tx, { skipPreflight: false });
  console.log("Tx signature:", sig);

  await connection.confirmTransaction(sig, "confirmed");
  console.log("Protocol initialized successfully!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
