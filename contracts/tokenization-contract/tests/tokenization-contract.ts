// @ts-nocheck
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { createHash, randomBytes } from "crypto";
import { expect } from "chai";

import { TokenizationContract } from "../target/types/tokenization_contract";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const PROTOCOL_SEED = Buffer.from("protocol");
const ASSET_SEED = Buffer.from("asset");
const AUCTION_SEED = Buffer.from("auction");
const BID_COMMIT_SEED = Buffer.from("bid_commit");
const VAULT_AUTHORITY_SEED = Buffer.from("vault_authority");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function u64Le(value: anchor.BN | number): Buffer {
  const bn = value instanceof anchor.BN ? value : new anchor.BN(value);
  return bn.toArrayLike(Buffer, "le", 8);
}

function deriveAta(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function deriveCommitment(
  auction: PublicKey,
  bidder: PublicKey,
  amountLamports: anchor.BN,
  salt: Buffer,
): number[] {
  const digest = createHash("sha256")
    .update(
      Buffer.concat([
        auction.toBuffer(),
        bidder.toBuffer(),
        u64Le(amountLamports),
        salt,
      ]),
    )
    .digest();

  return Array.from(digest);
}

async function expectErrorContains(
  fn: () => Promise<unknown>,
  expected: string,
): Promise<void> {
  try {
    await fn();
    expect.fail(`Expected error containing '${expected}', but transaction succeeded`);
  } catch (err) {
    expect(String(err)).to.include(expected);
  }
}

describe("tokenization-contract", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.TokenizationContract as Program<TokenizationContract>;

  const admin = Keypair.generate();
  const seller = Keypair.generate();
  const bidderA = Keypair.generate();
  const bidderB = Keypair.generate();
  const outsider = Keypair.generate();
  const treasury = Keypair.generate();
  const finalizer = Keypair.generate();

  const [protocolPda] = PublicKey.findProgramAddressSync(
    [PROTOCOL_SEED],
    program.programId,
  );

  async function chainNowTs(): Promise<number> {
    const slot = await provider.connection.getSlot("confirmed");
    const ts = await provider.connection.getBlockTime(slot);
    if (ts !== null) return ts;
    return Math.floor(Date.now() / 1000);
  }

  async function waitUntilTs(targetTs: number): Promise<void> {
    for (;;) {
      const now = await chainNowTs();
      if (now >= targetTs) return;
      await sleep(500);
    }
  }

  async function airdrop(pubkey: PublicKey, sol = 10): Promise<void> {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      sol * LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  }

  async function fetchProtocol() {
    return program.account.protocolConfig.fetch(protocolPda);
  }

  async function createAssetForCreator(creator: Keypair, decimals = 0) {
    const protocol = await fetchProtocol();
    const assetId = protocol.nextAssetId as anchor.BN;

    const [assetPda] = PublicKey.findProgramAddressSync(
      [ASSET_SEED, protocolPda.toBuffer(), u64Le(assetId)],
      program.programId,
    );

    const mint = Keypair.generate();
    const creatorAta = deriveAta(creator.publicKey, mint.publicKey);

    await program.methods
      .createAsset({
        assetId,
        title: `Asset-${assetId.toString()}`,
        metadataUri: `https://example.com/assets/${assetId.toString()}`,
        realWorldRef: `RW-${assetId.toString()}`,
        verificationHash: Array.from(randomBytes(32)),
        decimals,
      })
      .accounts({
        protocol: protocolPda,
        creator: creator.publicKey,
        asset: assetPda,
        mint: mint.publicKey,
        creatorTokenAccount: creatorAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator, mint])
      .rpc();

    return { assetId, assetPda, mint: mint.publicKey, creatorAta };
  }

  async function createAuctionForAsset(
    sellerKeypair: Keypair,
    assetPda: PublicKey,
    mint: PublicKey,
    minBidLamports: anchor.BN,
    opts?: { startDelaySec?: number; commitDurationSec?: number; revealDurationSec?: number },
  ) {
    const protocol = await fetchProtocol();
    const auctionId = protocol.nextAuctionId as anchor.BN;

    const now = await chainNowTs();
    const startDelaySec = opts?.startDelaySec ?? 2;
    const commitDurationSec = opts?.commitDurationSec ?? 60;
    const revealDurationSec = opts?.revealDurationSec ?? 60;

    const startTs = new anchor.BN(now + startDelaySec);
    const commitEndTs = new anchor.BN(startTs.toNumber() + commitDurationSec);
    const revealEndTs = new anchor.BN(commitEndTs.toNumber() + revealDurationSec);

    const [auctionPda] = PublicKey.findProgramAddressSync(
      [AUCTION_SEED, assetPda.toBuffer(), u64Le(auctionId)],
      program.programId,
    );
    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [VAULT_AUTHORITY_SEED, auctionPda.toBuffer()],
      program.programId,
    );

    const sellerAssetTokenAccount = deriveAta(sellerKeypair.publicKey, mint);
    const vaultAssetTokenAccount = deriveAta(vaultAuthorityPda, mint);

    await program.methods
      .createAuction({
        auctionId,
        startTs,
        commitEndTs,
        revealEndTs,
        minBidLamports,
      })
      .accounts({
        protocol: protocolPda,
        seller: sellerKeypair.publicKey,
        asset: assetPda,
        mint,
        auction: auctionPda,
        vaultAuthority: vaultAuthorityPda,
        sellerAssetTokenAccount,
        vaultAssetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([sellerKeypair])
      .rpc();

    return {
      auctionId,
      auctionPda,
      vaultAuthorityPda,
      sellerAssetTokenAccount,
      vaultAssetTokenAccount,
      startTs: startTs.toNumber(),
      commitEndTs: commitEndTs.toNumber(),
      revealEndTs: revealEndTs.toNumber(),
    };
  }

  async function commitBid(
    auctionPda: PublicKey,
    bidder: Keypair,
    amountLamports: anchor.BN,
    salt?: Buffer,
  ) {
    const [bidCommitPda] = PublicKey.findProgramAddressSync(
      [BID_COMMIT_SEED, auctionPda.toBuffer(), bidder.publicKey.toBuffer()],
      program.programId,
    );

    const actualSalt = salt ?? randomBytes(32);
    const commitment = deriveCommitment(
      auctionPda,
      bidder.publicKey,
      amountLamports,
      actualSalt,
    );

    await program.methods
      .commitBid({
        commitment,
        committedAmountLamports: amountLamports,
      })
      .accounts({
        protocol: protocolPda,
        auction: auctionPda,
        bidder: bidder.publicKey,
        bidCommit: bidCommitPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bidder])
      .rpc();

    return { bidCommitPda, salt: actualSalt, commitment };
  }

  before(async () => {
    await Promise.all([
      airdrop(admin.publicKey, 20),
      airdrop(seller.publicKey, 20),
      airdrop(bidderA.publicKey, 20),
      airdrop(bidderB.publicKey, 20),
      airdrop(outsider.publicKey, 20),
      airdrop(treasury.publicKey, 5),
      airdrop(finalizer.publicKey, 20),
    ]);

    await expectErrorContains(
      () =>
        program.methods
          .initializeProtocol(1501)
          .accounts({
            protocol: protocolPda,
            admin: admin.publicKey,
            treasury: treasury.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([admin])
          .rpc(),
      "InvalidFeeBps",
    );

    await program.methods
      .initializeProtocol(250)
      .accounts({
        protocol: protocolPda,
        admin: admin.publicKey,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  });

  it("create_asset: creates asset and rejects non-zero decimals", async () => {
    await expectErrorContains(
      () => createAssetForCreator(seller, 1),
      "InvalidAssetDecimals",
    );

    const { assetPda } = await createAssetForCreator(seller, 0);
    const asset = await program.account.asset.fetch(assetPda);
    expect(asset.currentOwner.toBase58()).to.eq(seller.publicKey.toBase58());
    expect(asset.decimals).to.eq(0);
  });

  it("create_auction: validates sequence, ownership, timings", async () => {
    const { assetPda, mint } = await createAssetForCreator(seller, 0);

    await expectErrorContains(
      () =>
        createAuctionForAsset(seller, assetPda, mint, new anchor.BN(0)),
      "InvalidMinBid",
    );

    const protocolBefore = await fetchProtocol();
    const badAuctionId = (protocolBefore.nextAuctionId as anchor.BN).add(new anchor.BN(1));
    const now = await chainNowTs();
    const startTs = new anchor.BN(now + 2);
    const commitEndTs = new anchor.BN(now + 62);
    const revealEndTs = new anchor.BN(now + 122);

    const [badAuctionPda] = PublicKey.findProgramAddressSync(
      [AUCTION_SEED, assetPda.toBuffer(), u64Le(badAuctionId)],
      program.programId,
    );
    const [badVaultAuthority] = PublicKey.findProgramAddressSync(
      [VAULT_AUTHORITY_SEED, badAuctionPda.toBuffer()],
      program.programId,
    );

    await expectErrorContains(
      () =>
        program.methods
          .createAuction({
            auctionId: badAuctionId,
            startTs,
            commitEndTs,
            revealEndTs,
            minBidLamports: new anchor.BN(1_000_000),
          })
          .accounts({
            protocol: protocolPda,
            seller: seller.publicKey,
            asset: assetPda,
            mint,
            auction: badAuctionPda,
            vaultAuthority: badVaultAuthority,
            sellerAssetTokenAccount: deriveAta(seller.publicKey, mint),
            vaultAssetTokenAccount: deriveAta(badVaultAuthority, mint),
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([seller])
          .rpc(),
      "InvalidSequence",
    );

    await expectErrorContains(
      () =>
        createAuctionForAsset(
          outsider,
          assetPda,
          mint,
          new anchor.BN(1_000_000),
        ),
      "account: seller",
    );

    await expectErrorContains(
      () =>
        createAuctionForAsset(
          seller,
          assetPda,
          mint,
          new anchor.BN(1_000_000),
          { startDelaySec: 2, commitDurationSec: 30 * 24 * 60 * 60, revealDurationSec: 59 },
        ),
      "InvalidTimeWindow",
    );

    const created = await createAuctionForAsset(
      seller,
      assetPda,
      mint,
      new anchor.BN(1_000_000),
    );
    const auction = await program.account.auction.fetch(created.auctionPda);
    expect(auction.minBidLamports.toString()).to.eq("1000000");
  });

  it("commit_bid: enforces phase, min bid, and duplicate protection", async () => {
    const { assetPda, mint } = await createAssetForCreator(seller, 0);
    const a = await createAuctionForAsset(
      seller,
      assetPda,
      mint,
      new anchor.BN(2_000_000),
      { startDelaySec: 4, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await expectErrorContains(
      () =>
        commitBid(
          a.auctionPda,
          bidderA,
          new anchor.BN(2_500_000),
          randomBytes(32),
        ),
      "InvalidPhase",
    );

    await waitUntilTs(a.startTs + 1);

    await expectErrorContains(
      () =>
        commitBid(
          a.auctionPda,
          bidderA,
          new anchor.BN(1_000_000),
          randomBytes(32),
        ),
      "BidTooLow",
    );

    const first = await commitBid(
      a.auctionPda,
      bidderA,
      new anchor.BN(3_000_000),
      randomBytes(32),
    );

    await expectErrorContains(
      () =>
        commitBid(
          a.auctionPda,
          bidderA,
          new anchor.BN(3_500_000),
          randomBytes(32),
        ),
      "already in use",
    );

    const bid = await program.account.bidCommit.fetch(first.bidCommitPda);
    expect(bid.committedAmountLamports.toString()).to.eq("3000000");
  });

  it("reveal_bid: validates commitment preimage and double reveal", async () => {
    const { assetPda, mint } = await createAssetForCreator(seller, 0);
    const a = await createAuctionForAsset(
      seller,
      assetPda,
      mint,
      new anchor.BN(1_000_000),
      { startDelaySec: 2, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await waitUntilTs(a.startTs + 1);

    const amount = new anchor.BN(2_200_000);
    const salt = randomBytes(32);
    const { bidCommitPda } = await commitBid(a.auctionPda, bidderA, amount, salt);

    await waitUntilTs(a.commitEndTs + 1);

    await expectErrorContains(
      () =>
        program.methods
          .revealBid({
            amountLamports: amount,
            salt: Array.from(randomBytes(32)),
          })
          .accounts({
            protocol: protocolPda,
            auction: a.auctionPda,
            bidder: bidderA.publicKey,
            bidCommit: bidCommitPda,
          })
          .signers([bidderA])
          .rpc(),
      "CommitmentMismatch",
    );

    await program.methods
      .revealBid({
        amountLamports: amount,
        salt: Array.from(salt),
      })
      .accounts({
        protocol: protocolPda,
        auction: a.auctionPda,
        bidder: bidderA.publicKey,
        bidCommit: bidCommitPda,
      })
      .signers([bidderA])
      .rpc();

    await expectErrorContains(
      () =>
        program.methods
          .revealBid({
            amountLamports: amount,
            salt: Array.from(salt),
          })
          .accounts({
            protocol: protocolPda,
            auction: a.auctionPda,
            bidder: bidderA.publicKey,
            bidCommit: bidCommitPda,
          })
          .signers([bidderA])
          .rpc(),
      "BidAlreadyRevealed",
    );
  });

  it("finalize_auction: rejects early finalize and no-reveal finalize", async () => {
    const noRevealAsset = await createAssetForCreator(seller, 0);
    const noRevealAuction = await createAuctionForAsset(
      seller,
      noRevealAsset.assetPda,
      noRevealAsset.mint,
      new anchor.BN(1_000_000),
      { startDelaySec: 2, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await waitUntilTs(noRevealAuction.startTs + 1);
    await commitBid(noRevealAuction.auctionPda, bidderA, new anchor.BN(2_000_000), randomBytes(32));

    const [winnerBidCommitPda] = PublicKey.findProgramAddressSync(
      [BID_COMMIT_SEED, noRevealAuction.auctionPda.toBuffer(), bidderA.publicKey.toBuffer()],
      program.programId,
    );

    await waitUntilTs(noRevealAuction.revealEndTs + 1);
    await expectErrorContains(
      () =>
        program.methods
          .finalizeAuctionState()
          .accounts({
            protocol: protocolPda,
            auction: noRevealAuction.auctionPda,
            winningBidCommit: winnerBidCommitPda,
            seller: seller.publicKey,
            treasury: treasury.publicKey,
          })
          .rpc(),
      "account: winningBidCommit",
    );

    const withRevealAsset = await createAssetForCreator(seller, 0);
    const withRevealAuction = await createAuctionForAsset(
      seller,
      withRevealAsset.assetPda,
      withRevealAsset.mint,
      new anchor.BN(1_000_000),
      { startDelaySec: 2, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await waitUntilTs(withRevealAuction.startTs + 1);
    const committedAmount = new anchor.BN(2_000_000);
    const commit = await commitBid(withRevealAuction.auctionPda, bidderA, committedAmount, randomBytes(32));
    const [revealedWinnerBidCommitPda] = PublicKey.findProgramAddressSync(
      [BID_COMMIT_SEED, withRevealAuction.auctionPda.toBuffer(), bidderA.publicKey.toBuffer()],
      program.programId,
    );

    await waitUntilTs(withRevealAuction.commitEndTs + 1);
    await program.methods
      .revealBid({
        amountLamports: committedAmount,
        salt: Array.from(commit.salt),
      })
      .accounts({
        protocol: protocolPda,
        auction: withRevealAuction.auctionPda,
        bidder: bidderA.publicKey,
        bidCommit: commit.bidCommitPda,
      })
      .signers([bidderA])
      .rpc();

    await expectErrorContains(
      () =>
        program.methods
          .finalizeAuctionState()
          .accounts({
            protocol: protocolPda,
            auction: withRevealAuction.auctionPda,
            winningBidCommit: revealedWinnerBidCommitPda,
            seller: seller.publicKey,
            treasury: treasury.publicKey,
          })
          .rpc(),
      "NotFinalizableYet",
    );
  });

  it("full happy path: finalize + settlement + refunds + double refund protection", async () => {
    const { assetPda, mint } = await createAssetForCreator(seller, 0);
    const a = await createAuctionForAsset(
      seller,
      assetPda,
      mint,
      new anchor.BN(1_000_000),
      { startDelaySec: 2, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await waitUntilTs(a.startTs + 1);

    const amountA = new anchor.BN(2 * LAMPORTS_PER_SOL);
    const amountBCommitted = new anchor.BN(Math.floor(2.5 * LAMPORTS_PER_SOL));
    const amountBRevealed = amountBCommitted;

    const commitA = await commitBid(a.auctionPda, bidderA, amountA, randomBytes(32));
    const commitB = await commitBid(a.auctionPda, bidderB, amountBCommitted, randomBytes(32));

    await waitUntilTs(a.commitEndTs + 1);

    await program.methods
      .revealBid({ amountLamports: amountA, salt: Array.from(commitA.salt) })
      .accounts({
        protocol: protocolPda,
        auction: a.auctionPda,
        bidder: bidderA.publicKey,
        bidCommit: commitA.bidCommitPda,
      })
      .signers([bidderA])
      .rpc();

    await program.methods
      .revealBid({ amountLamports: amountBRevealed, salt: Array.from(commitB.salt) })
      .accounts({
        protocol: protocolPda,
        auction: a.auctionPda,
        bidder: bidderB.publicKey,
        bidCommit: commitB.bidCommitPda,
      })
      .signers([bidderB])
      .rpc();

    await waitUntilTs(a.revealEndTs + 1);

    const sellerBefore = await provider.connection.getBalance(seller.publicKey, "confirmed");
    const treasuryBefore = await provider.connection.getBalance(treasury.publicKey, "confirmed");

    await program.methods
      .finalizeAuctionState()
      .accounts({
        protocol: protocolPda,
        auction: a.auctionPda,
        winningBidCommit: commitB.bidCommitPda,
        seller: seller.publicKey,
        treasury: treasury.publicKey,
      })
      .rpc();

    await program.methods
      .settleWinnerAssetAndFunds()
      .accounts({
        protocol: protocolPda,
        auction: a.auctionPda,
        asset: assetPda,
        mint,
        winner: bidderB.publicKey,
        payer: finalizer.publicKey,
        vaultAuthority: a.vaultAuthorityPda,
        vaultAssetTokenAccount: a.vaultAssetTokenAccount,
        winnerAssetTokenAccount: deriveAta(bidderB.publicKey, mint),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([finalizer])
      .rpc();

    const sellerAfter = await provider.connection.getBalance(seller.publicKey, "confirmed");
    const treasuryAfter = await provider.connection.getBalance(treasury.publicKey, "confirmed");

    const protocol = await fetchProtocol();
    const feeBps = protocol.feeBps;
    const expectedFee = amountBRevealed.muln(feeBps).divn(10_000);
    const expectedSeller = amountBRevealed.sub(expectedFee);

    expect(sellerAfter - sellerBefore).to.eq(expectedSeller.toNumber());
    expect(treasuryAfter - treasuryBefore).to.eq(expectedFee.toNumber());

    const winnerAta = deriveAta(bidderB.publicKey, mint);
    const winnerTokenBal = await provider.connection.getTokenAccountBalance(winnerAta, "confirmed");
    expect(winnerTokenBal.value.amount).to.eq("1");

    await program.methods
      .refundLoser()
      .accounts({
        protocol: protocolPda,
        auction: a.auctionPda,
        bidder: bidderA.publicKey,
        bidCommit: commitA.bidCommitPda,
      })
      .signers([bidderA])
      .rpc();

    await program.methods
      .refundLoser()
      .accounts({
        protocol: protocolPda,
        auction: a.auctionPda,
        bidder: bidderB.publicKey,
        bidCommit: commitB.bidCommitPda,
      })
      .signers([bidderB])
      .rpc();

    await expectErrorContains(
      () =>
        program.methods
          .refundLoser()
          .accounts({
            protocol: protocolPda,
            auction: a.auctionPda,
            bidder: bidderA.publicKey,
            bidCommit: commitA.bidCommitPda,
          })
          .signers([bidderA])
          .rpc(),
      "BidAlreadyRefunded",
    );
  });

  it("refund_loser rejects when auction is still active", async () => {
    const { assetPda, mint } = await createAssetForCreator(seller, 0);
    const a = await createAuctionForAsset(
      seller,
      assetPda,
      mint,
      new anchor.BN(1_000_000),
      { startDelaySec: 2, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await waitUntilTs(a.startTs + 1);
    const commitA = await commitBid(a.auctionPda, bidderA, new anchor.BN(2_000_000), randomBytes(32));

    await expectErrorContains(
      () =>
        program.methods
          .refundLoser()
          .accounts({
            protocol: protocolPda,
            auction: a.auctionPda,
            bidder: bidderA.publicKey,
            bidCommit: commitA.bidCommitPda,
          })
          .signers([bidderA])
          .rpc(),
      "InvalidPhase",
    );
  });

  it("cancel_auction works with no revealed bids and rejects after reveal", async () => {
    const first = await createAssetForCreator(seller, 0);
    const a1 = await createAuctionForAsset(
      seller,
      first.assetPda,
      first.mint,
      new anchor.BN(1_000_000),
      { startDelaySec: 2, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await waitUntilTs(a1.startTs + 1);
    const commitA = await commitBid(a1.auctionPda, bidderA, new anchor.BN(2_000_000), randomBytes(32));

    await program.methods
      .cancelAuction()
      .accounts({
        protocol: protocolPda,
        auction: a1.auctionPda,
        asset: first.assetPda,
        mint: first.mint,
        seller: seller.publicKey,
        vaultAuthority: a1.vaultAuthorityPda,
        vaultAssetTokenAccount: a1.vaultAssetTokenAccount,
        sellerAssetTokenAccount: a1.sellerAssetTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([seller])
      .rpc();

    await program.methods
      .refundLoser()
      .accounts({
        protocol: protocolPda,
        auction: a1.auctionPda,
        bidder: bidderA.publicKey,
        bidCommit: commitA.bidCommitPda,
      })
      .signers([bidderA])
      .rpc();

    const second = await createAssetForCreator(seller, 0);
    const a2 = await createAuctionForAsset(
      seller,
      second.assetPda,
      second.mint,
      new anchor.BN(1_000_000),
      { startDelaySec: 2, commitDurationSec: 60, revealDurationSec: 60 },
    );

    await waitUntilTs(a2.startTs + 1);
    const commitB = await commitBid(a2.auctionPda, bidderB, new anchor.BN(3_000_000), randomBytes(32));
    await waitUntilTs(a2.commitEndTs + 1);

    await program.methods
      .revealBid({ amountLamports: new anchor.BN(3_000_000), salt: Array.from(commitB.salt) })
      .accounts({
        protocol: protocolPda,
        auction: a2.auctionPda,
        bidder: bidderB.publicKey,
        bidCommit: commitB.bidCommitPda,
      })
      .signers([bidderB])
      .rpc();

    await expectErrorContains(
      () =>
        program.methods
          .cancelAuction()
          .accounts({
            protocol: protocolPda,
            auction: a2.auctionPda,
            asset: second.assetPda,
            mint: second.mint,
            seller: seller.publicKey,
            vaultAuthority: a2.vaultAuthorityPda,
            vaultAssetTokenAccount: a2.vaultAssetTokenAccount,
            sellerAssetTokenAccount: a2.sellerAssetTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([seller])
          .rpc(),
      "CancelNotAllowed",
    );
  });

  it.skip("blocks actions when protocol paused (requires pause/unpause instruction)");
});
