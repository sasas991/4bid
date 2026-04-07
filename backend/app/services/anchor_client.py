from __future__ import annotations

import base64
import hashlib
import json
import os
import struct
import time
from dataclasses import dataclass
from typing import Any, Optional

from solana.rpc.api import Client
from solders.keypair import Keypair
from solders.instruction import Instruction, AccountMeta
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solders.transaction import VersionedTransaction

from ..core.config import settings

PROGRAM_ID = "2KQUuKgA5QXLgUdzRDCDEM1kgAfRnKucgAp6N38iihYa"
PROGRAM_PUBKEY = Pubkey.from_string(PROGRAM_ID)
DEFAULT_PUBKEY = str(Pubkey.default())

TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")

AUCTION_DISCRIMINATOR = hashlib.sha256(b"account:Auction").digest()[:8]
ASSET_DISCRIMINATOR = hashlib.sha256(b"account:Asset").digest()[:8]

# Instruction discriminators (Anchor convention: sha256("global:<method_name>")[0..8])
CREATE_ASSET_DISC = hashlib.sha256(b"global:create_asset").digest()[:8]
CREATE_AUCTION_DISC = hashlib.sha256(b"global:create_auction").digest()[:8]
COMMIT_BID_DISC = hashlib.sha256(b"global:commit_bid").digest()[:8]
CANCEL_AUCTION_DISC = hashlib.sha256(b"global:cancel_auction").digest()[:8]
FINALIZE_AUCTION_STATE_DISC = hashlib.sha256(b"global:finalize_auction_state").digest()[:8]

PROTOCOL_SEED = b"protocol"
ASSET_SEED = b"asset"
AUCTION_SEED = b"auction"
VAULT_AUTHORITY_SEED = b"vault_authority"
BID_COMMIT_SEED = b"bid_commit"

TREASURY_ADDRESS = "2vMHvc2ChZtYXhN4vBQ9KDRj98jsJpW9ctHMx3Bfv1JL"

AUCTION_STATUS_DRAFT = 0
AUCTION_STATUS_COMMIT_PHASE = 1
AUCTION_STATUS_REVEAL_PHASE = 2
AUCTION_STATUS_FINALIZED = 3
AUCTION_STATUS_CANCELLED = 4


@dataclass
class DecodedAuctionAccount:
    auction_pubkey: str
    protocol_pubkey: str
    asset_pubkey: str
    mint_pubkey: str
    seller_pubkey: str
    winner_pubkey: str
    highest_bidder_pubkey: str
    start_ts: int
    commit_end_ts: int
    reveal_end_ts: int
    min_bid_lamports: int
    highest_revealed_bid_lamports: int
    status_code: int
    settled: bool
    slot: int


@dataclass
class DecodedAssetAccount:
    asset_pubkey: str
    protocol_pubkey: str
    mint_pubkey: str
    current_owner_pubkey: str
    slot: int


@dataclass
class TxVerificationResult:
    ok: bool
    slot: Optional[int] = None


@dataclass
class CreateOnChainResult:
    auction_pubkey: str
    asset_pubkey: str
    mint_pubkey: str
    seller_pubkey: str
    slot: int


@dataclass
class CommitBidOnChainResult:
    signature: str
    bid_commit_pubkey: str
    salt_hex: str
    slot: int


@dataclass
class CancelAuctionOnChainResult:
    signature: str
    slot: int


@dataclass
class FinalizeAuctionOnChainResult:
    signature: str
    slot: int


class AnchorChainClient:
    """Lightweight RPC client for account-level reads used by backend projections."""

    def __init__(self, rpc_url: Optional[str] = None):
        self.client = Client(rpc_url or settings.SOLANA_RPC_URL)

    def _resp_to_dict(self, response: Any) -> dict:
        if isinstance(response, dict):
            return response
        if hasattr(response, "to_json"):
            return json.loads(response.to_json())
        raise ValueError("Unsupported RPC response format")

    def _get_account_and_slot(self, pubkey: str) -> tuple[dict, int]:
        key = Pubkey.from_string(pubkey)
        response = self.client.get_account_info(key, encoding="base64")
        payload = self._resp_to_dict(response)
        result = payload.get("result") or {}
        value = result.get("value")
        if value is None:
            raise ValueError(f"Account not found: {pubkey}")
        slot = ((result.get("context") or {}).get("slot")) or 0
        return value, int(slot)

    def get_account(self, pubkey: str) -> Optional[dict]:
        try:
            value, _ = self._get_account_and_slot(pubkey)
            return value
        except ValueError:
            return None

    def get_slot(self) -> int:
        response = self.client.get_slot()
        payload = self._resp_to_dict(response)
        result = payload.get("result")
        if result is None:
            raise ValueError("Unable to fetch current slot")
        return int(result)

    def get_block_time(self) -> int:
        """Get the current Solana cluster timestamp (Unix seconds)."""
        slot = self.get_slot()
        response = self.client.get_block_time(slot)
        payload = self._resp_to_dict(response)
        result = payload.get("result")
        if result is None:
            # Fallback: use server time
            return int(time.time())
        return int(result)

    # ------------------------------------------------------------------ #
    #  Helpers for building on-chain transactions                          #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _derive_ata(owner: Pubkey, mint: Pubkey) -> Pubkey:
        """Derive Associated Token Account address."""
        return Pubkey.find_program_address(
            [bytes(owner), bytes(TOKEN_PROGRAM_ID), bytes(mint)],
            ASSOCIATED_TOKEN_PROGRAM_ID,
        )[0]

    @staticmethod
    def _borsh_string(s: str) -> bytes:
        encoded = s.encode("utf-8")
        return struct.pack("<I", len(encoded)) + encoded

    @staticmethod
    def _load_platform_keypair() -> Keypair:
        secret = settings.DEV_SIGNER_KEYPAIR
        if not secret:
            raise ValueError("DEV_SIGNER_KEYPAIR is not configured")
        return Keypair.from_base58_string(secret)

    def _read_protocol_state(self, protocol_pda: Pubkey) -> tuple[int, int]:
        """Read next_asset_id and next_auction_id from the Protocol PDA."""
        account_value, _ = self._get_account_and_slot(str(protocol_pda))
        data = self._decode_data(account_value)
        # Layout: 8 (disc) + 32 (admin) + 32 (treasury) + 2 (fee_bps) + 1 (paused)
        offset = 8 + 32 + 32 + 2 + 1
        next_asset_id = struct.unpack_from("<Q", data, offset)[0]
        next_auction_id = struct.unpack_from("<Q", data, offset + 8)[0]
        return next_asset_id, next_auction_id

    def _build_create_asset_ix(
        self,
        creator: Pubkey,
        protocol_pda: Pubkey,
        asset_pda: Pubkey,
        mint_pubkey: Pubkey,
        creator_ata: Pubkey,
        asset_id: int,
        title: str,
        metadata_uri: str,
        real_world_ref: str,
        verification_hash: bytes,
        decimals: int,
    ) -> Instruction:
        # Borsh-serialize CreateAssetParams
        data = bytearray(CREATE_ASSET_DISC)
        data += struct.pack("<Q", asset_id)
        data += self._borsh_string(title)
        data += self._borsh_string(metadata_uri)
        data += self._borsh_string(real_world_ref)
        data += verification_hash[:32]
        data += struct.pack("B", decimals)

        accounts = [
            AccountMeta(protocol_pda, is_signer=False, is_writable=True),
            AccountMeta(creator, is_signer=True, is_writable=True),
            AccountMeta(asset_pda, is_signer=False, is_writable=True),
            AccountMeta(mint_pubkey, is_signer=True, is_writable=True),
            AccountMeta(creator_ata, is_signer=False, is_writable=True),
            AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]
        return Instruction(PROGRAM_PUBKEY, bytes(data), accounts)

    def _build_create_auction_ix(
        self,
        seller: Pubkey,
        protocol_pda: Pubkey,
        asset_pda: Pubkey,
        mint_pubkey: Pubkey,
        auction_pda: Pubkey,
        vault_authority: Pubkey,
        seller_ata: Pubkey,
        vault_ata: Pubkey,
        auction_id: int,
        start_ts: int,
        commit_end_ts: int,
        reveal_end_ts: int,
        min_bid_lamports: int,
    ) -> Instruction:
        # Borsh-serialize CreateAuctionParams
        data = bytearray(CREATE_AUCTION_DISC)
        data += struct.pack("<Q", auction_id)
        data += struct.pack("<q", start_ts)
        data += struct.pack("<q", commit_end_ts)
        data += struct.pack("<q", reveal_end_ts)
        data += struct.pack("<Q", min_bid_lamports)

        accounts = [
            AccountMeta(protocol_pda, is_signer=False, is_writable=True),
            AccountMeta(seller, is_signer=True, is_writable=True),
            AccountMeta(asset_pda, is_signer=False, is_writable=True),
            AccountMeta(mint_pubkey, is_signer=False, is_writable=False),
            AccountMeta(auction_pda, is_signer=False, is_writable=True),
            AccountMeta(vault_authority, is_signer=False, is_writable=False),
            AccountMeta(seller_ata, is_signer=False, is_writable=True),
            AccountMeta(vault_ata, is_signer=False, is_writable=True),
            AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]
        return Instruction(PROGRAM_PUBKEY, bytes(data), accounts)

    def _send_versioned_tx(self, ixs: list[Instruction], signers: list[Keypair]) -> str:
        """Build, sign, send, and confirm a v0 transaction. Returns the signature string."""
        from solana.rpc.commitment import Confirmed
        from solders.hash import Hash as SolderHash
        from solders.signature import Signature

        blockhash_resp = self.client.get_latest_blockhash()
        payload = self._resp_to_dict(blockhash_resp)
        blockhash_str = payload["result"]["value"]["blockhash"]
        recent_blockhash = SolderHash.from_string(blockhash_str)

        msg = MessageV0.try_compile(
            payer=signers[0].pubkey(),
            instructions=ixs,
            address_lookup_table_accounts=[],
            recent_blockhash=recent_blockhash,
        )
        tx = VersionedTransaction(msg, signers)
        try:
            resp = self.client.send_transaction(tx)
        except Exception as e:
            raise ValueError(f"Transaction send failed: {e}") from e
        resp_dict = self._resp_to_dict(resp)
        error = resp_dict.get("error")
        if error:
            raise ValueError(f"Transaction failed: {error}")
        sig = resp_dict.get("result")
        if not sig:
            raise ValueError(f"No signature returned from RPC: {resp_dict}")

        # Wait for confirmation and verify success
        sig_obj = Signature.from_string(sig)
        confirm_resp = self.client.confirm_transaction(sig_obj, commitment=Confirmed)
        confirm_dict = self._resp_to_dict(confirm_resp)
        # Check if the transaction had an error
        statuses = (confirm_dict.get("result", {}) or {}).get("value", []) or []
        for status in (statuses if isinstance(statuses, list) else [statuses]):
            if status and isinstance(status, dict) and status.get("err"):
                raise ValueError(f"Transaction confirmed but failed: {status['err']}")

        # Poll until account changes are visible (devnet propagation delay)
        for _ in range(10):
            tx_resp = self.client.get_transaction(sig_obj, max_supported_transaction_version=0)
            tx_dict = self._resp_to_dict(tx_resp)
            tx_result = tx_dict.get("result")
            if tx_result is not None:
                meta = (tx_result.get("meta") or {})
                if meta.get("err"):
                    raise ValueError(f"Transaction failed on-chain: {meta['err']}")
                break
            time.sleep(1)

        return sig

    def create_auction_on_chain(
        self,
        title: str,
        metadata_uri: str,
        real_world_ref: str,
        min_bid_lamports: int,
        commit_duration_secs: int = 120,
        reveal_duration_secs: int = 60,
    ) -> CreateOnChainResult:
        """
        Create asset + auction on-chain using the platform keypair.
        Timestamps are computed right before the auction tx using the Solana clock.
        """
        platform_kp = self._load_platform_keypair()
        creator = platform_kp.pubkey()

        # Derive protocol PDA
        protocol_pda, _ = Pubkey.find_program_address([PROTOCOL_SEED], PROGRAM_PUBKEY)

        # Read next IDs from on-chain protocol state
        next_asset_id, next_auction_id = self._read_protocol_state(protocol_pda)

        # Derive Asset PDA
        asset_pda, _ = Pubkey.find_program_address(
            [ASSET_SEED, bytes(protocol_pda), struct.pack("<Q", next_asset_id)],
            PROGRAM_PUBKEY,
        )

        # Generate a new mint keypair
        mint_kp = Keypair()
        mint_pubkey = mint_kp.pubkey()

        # Derive ATAs
        creator_ata = self._derive_ata(creator, mint_pubkey)

        # Generate verification hash (random 32 bytes)
        verification_hash = os.urandom(32)

        # --- TX 1: create_asset ---
        create_asset_ix = self._build_create_asset_ix(
            creator=creator,
            protocol_pda=protocol_pda,
            asset_pda=asset_pda,
            mint_pubkey=mint_pubkey,
            creator_ata=creator_ata,
            asset_id=next_asset_id,
            title=title,
            metadata_uri=metadata_uri,
            real_world_ref=real_world_ref,
            verification_hash=verification_hash,
            decimals=0,
        )
        self._send_versioned_tx([create_asset_ix], [platform_kp, mint_kp])

        # Wait until the asset account is visible on-chain before proceeding
        for _ in range(30):
            try:
                self._get_account_and_slot(str(asset_pda))
                break
            except ValueError:
                time.sleep(1)
        else:
            raise ValueError("Asset account not found on-chain after createAsset tx confirmed")

        # --- TX 2: create_auction ---
        # Derive Auction PDA
        auction_pda, _ = Pubkey.find_program_address(
            [AUCTION_SEED, bytes(asset_pda), struct.pack("<Q", next_auction_id)],
            PROGRAM_PUBKEY,
        )

        # Derive vault authority
        vault_authority, _ = Pubkey.find_program_address(
            [VAULT_AUTHORITY_SEED, bytes(auction_pda)],
            PROGRAM_PUBKEY,
        )

        seller_ata = self._derive_ata(creator, mint_pubkey)
        vault_ata = self._derive_ata(vault_authority, mint_pubkey)

        # Compute timestamps RIGHT before sending, using fresh Solana clock
        fresh_solana_now = self.get_block_time()
        start_ts = fresh_solana_now + 30  # buffer for tx propagation on devnet
        commit_end_ts = start_ts + max(commit_duration_secs, 60)
        reveal_end_ts = commit_end_ts + max(reveal_duration_secs, 60)

        create_auction_ix = self._build_create_auction_ix(
            seller=creator,
            protocol_pda=protocol_pda,
            asset_pda=asset_pda,
            mint_pubkey=mint_pubkey,
            auction_pda=auction_pda,
            vault_authority=vault_authority,
            seller_ata=seller_ata,
            vault_ata=vault_ata,
            auction_id=next_auction_id,
            start_ts=start_ts,
            commit_end_ts=commit_end_ts,
            reveal_end_ts=reveal_end_ts,
            min_bid_lamports=min_bid_lamports,
        )
        self._send_versioned_tx([create_auction_ix], [platform_kp])

        # Get current slot for the projection
        slot = self.get_slot()

        return CreateOnChainResult(
            auction_pubkey=str(auction_pda),
            asset_pubkey=str(asset_pda),
            mint_pubkey=str(mint_pubkey),
            seller_pubkey=str(creator),
            slot=slot,
        )

    # ------------------------------------------------------------------ #
    #  On-chain bid / cancel / finalize                                   #
    # ------------------------------------------------------------------ #

    def commit_bid_on_chain(
        self,
        auction_pubkey: str,
        amount_lamports: int,
    ) -> CommitBidOnChainResult:
        """
        Submit a commit_bid instruction using the platform keypair as bidder.
        Returns the signature, bid_commit PDA, and the salt used for the commitment hash.
        """
        platform_kp = self._load_platform_keypair()
        bidder = platform_kp.pubkey()

        auction_pk = Pubkey.from_string(auction_pubkey)
        protocol_pda, _ = Pubkey.find_program_address([PROTOCOL_SEED], PROGRAM_PUBKEY)

        # Derive bid_commit PDA
        bid_commit_pda, _ = Pubkey.find_program_address(
            [BID_COMMIT_SEED, bytes(auction_pk), bytes(bidder)],
            PROGRAM_PUBKEY,
        )

        # Generate salt and compute commitment hash
        salt = os.urandom(32)
        commitment_preimage = bytes(auction_pk) + bytes(bidder) + struct.pack("<Q", amount_lamports) + salt
        commitment = hashlib.sha256(commitment_preimage).digest()

        # Borsh-serialize CommitBidParams: commitment([u8;32]) + committed_amount_lamports(u64)
        data = bytearray(COMMIT_BID_DISC)
        data += commitment
        data += struct.pack("<Q", amount_lamports)

        accounts = [
            AccountMeta(protocol_pda, is_signer=False, is_writable=False),
            AccountMeta(auction_pk, is_signer=False, is_writable=True),
            AccountMeta(bidder, is_signer=True, is_writable=True),
            AccountMeta(bid_commit_pda, is_signer=False, is_writable=True),
            AccountMeta(SYSTEM_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_PUBKEY, bytes(data), accounts)
        sig = self._send_versioned_tx([ix], [platform_kp])
        slot = self.get_slot()

        return CommitBidOnChainResult(
            signature=sig,
            bid_commit_pubkey=str(bid_commit_pda),
            salt_hex=salt.hex(),
            slot=slot,
        )

    def cancel_auction_on_chain(
        self,
        auction_pubkey: str,
        asset_pubkey: str,
        mint_pubkey: str,
    ) -> CancelAuctionOnChainResult:
        """
        Submit a cancel_auction instruction using the platform keypair as seller.
        """
        platform_kp = self._load_platform_keypair()
        seller = platform_kp.pubkey()

        auction_pk = Pubkey.from_string(auction_pubkey)
        asset_pk = Pubkey.from_string(asset_pubkey)
        mint_pk = Pubkey.from_string(mint_pubkey)
        protocol_pda, _ = Pubkey.find_program_address([PROTOCOL_SEED], PROGRAM_PUBKEY)

        # Derive vault authority PDA
        vault_authority, _ = Pubkey.find_program_address(
            [VAULT_AUTHORITY_SEED, bytes(auction_pk)],
            PROGRAM_PUBKEY,
        )

        # Derive ATAs
        vault_ata = self._derive_ata(vault_authority, mint_pk)
        seller_ata = self._derive_ata(seller, mint_pk)

        data = bytearray(CANCEL_AUCTION_DISC)

        accounts = [
            AccountMeta(protocol_pda, is_signer=False, is_writable=False),
            AccountMeta(auction_pk, is_signer=False, is_writable=True),
            AccountMeta(asset_pk, is_signer=False, is_writable=True),
            AccountMeta(mint_pk, is_signer=False, is_writable=False),
            AccountMeta(seller, is_signer=True, is_writable=True),
            AccountMeta(vault_authority, is_signer=False, is_writable=False),
            AccountMeta(vault_ata, is_signer=False, is_writable=True),
            AccountMeta(seller_ata, is_signer=False, is_writable=True),
            AccountMeta(TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
            AccountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, is_signer=False, is_writable=False),
        ]

        ix = Instruction(PROGRAM_PUBKEY, bytes(data), accounts)
        sig = self._send_versioned_tx([ix], [platform_kp])
        slot = self.get_slot()

        return CancelAuctionOnChainResult(signature=sig, slot=slot)

    def finalize_auction_on_chain(
        self,
        auction_pubkey: str,
        seller_pubkey: str,
        treasury_pubkey: str,
    ) -> FinalizeAuctionOnChainResult:
        """
        Submit a finalize_auction_state instruction using the platform keypair.
        The winning bidder is read from the on-chain auction account (highest_bidder).
        """
        platform_kp = self._load_platform_keypair()

        auction_pk = Pubkey.from_string(auction_pubkey)
        seller_pk = Pubkey.from_string(seller_pubkey)
        treasury_pk = Pubkey.from_string(treasury_pubkey)
        protocol_pda, _ = Pubkey.find_program_address([PROTOCOL_SEED], PROGRAM_PUBKEY)

        # Read on-chain auction to get highest_bidder for PDA derivation
        decoded = self.get_decoded_auction(auction_pubkey)
        highest_bidder_pk = Pubkey.from_string(decoded.highest_bidder_pubkey)

        # Derive winning bid_commit PDA
        winning_bid_commit_pda, _ = Pubkey.find_program_address(
            [BID_COMMIT_SEED, bytes(auction_pk), bytes(highest_bidder_pk)],
            PROGRAM_PUBKEY,
        )

        data = bytearray(FINALIZE_AUCTION_STATE_DISC)

        accounts = [
            AccountMeta(protocol_pda, is_signer=False, is_writable=False),
            AccountMeta(auction_pk, is_signer=False, is_writable=True),
            AccountMeta(winning_bid_commit_pda, is_signer=False, is_writable=True),
            AccountMeta(seller_pk, is_signer=False, is_writable=True),
            AccountMeta(treasury_pk, is_signer=False, is_writable=True),
        ]

        ix = Instruction(PROGRAM_PUBKEY, bytes(data), accounts)
        sig = self._send_versioned_tx([ix], [platform_kp])
        slot = self.get_slot()

        return FinalizeAuctionOnChainResult(signature=sig, slot=slot)

    # ------------------------------------------------------------------ #

    def _decode_data(self, account_value: dict) -> bytes:
        data = account_value.get("data")
        if not isinstance(data, list) or not data:
            raise ValueError("Invalid account data encoding")
        return base64.b64decode(data[0])

    def _read_pubkey(self, data: bytes, offset: int) -> tuple[str, int]:
        end = offset + 32
        if end > len(data):
            raise ValueError("Unexpected account data length while reading pubkey")
        return str(Pubkey.from_bytes(data[offset:end])), end

    def _read_u64(self, data: bytes, offset: int) -> tuple[int, int]:
        end = offset + 8
        if end > len(data):
            raise ValueError("Unexpected account data length while reading u64")
        return struct.unpack_from("<Q", data, offset)[0], end

    def _read_i64(self, data: bytes, offset: int) -> tuple[int, int]:
        end = offset + 8
        if end > len(data):
            raise ValueError("Unexpected account data length while reading i64")
        return struct.unpack_from("<q", data, offset)[0], end

    def _read_u8(self, data: bytes, offset: int) -> tuple[int, int]:
        end = offset + 1
        if end > len(data):
            raise ValueError("Unexpected account data length while reading u8")
        return data[offset], end

    def _read_anchor_string(self, data: bytes, offset: int) -> tuple[str, int]:
        end_len = offset + 4
        if end_len > len(data):
            raise ValueError("Unexpected account data length while reading string length")
        length = struct.unpack_from("<I", data, offset)[0]
        start = end_len
        end = start + length
        if end > len(data):
            raise ValueError("Unexpected account data length while reading string bytes")
        return data[start:end].decode("utf-8"), end

    def _validate_owner_and_discriminator(
        self,
        pubkey: str,
        account_value: dict,
        expected_discriminator: bytes,
    ) -> bytes:
        owner = account_value.get("owner")
        if owner != PROGRAM_ID:
            raise ValueError(f"Account {pubkey} is not owned by the auction program")
        raw_data = self._decode_data(account_value)
        if len(raw_data) < 8 or raw_data[:8] != expected_discriminator:
            raise ValueError(f"Account {pubkey} does not match expected discriminator")
        return raw_data

    def get_decoded_auction(self, auction_pubkey: str) -> DecodedAuctionAccount:
        account_value, slot = self._get_account_and_slot(auction_pubkey)
        data = self._validate_owner_and_discriminator(
            auction_pubkey,
            account_value,
            AUCTION_DISCRIMINATOR,
        )
        offset = 8

        protocol_pubkey, offset = self._read_pubkey(data, offset)
        _, offset = self._read_u64(data, offset)  # auction_id
        asset_pubkey, offset = self._read_pubkey(data, offset)
        mint_pubkey, offset = self._read_pubkey(data, offset)
        seller_pubkey, offset = self._read_pubkey(data, offset)
        winner_pubkey, offset = self._read_pubkey(data, offset)
        highest_bidder_pubkey, offset = self._read_pubkey(data, offset)
        start_ts, offset = self._read_i64(data, offset)
        commit_end_ts, offset = self._read_i64(data, offset)
        reveal_end_ts, offset = self._read_i64(data, offset)
        min_bid_lamports, offset = self._read_u64(data, offset)
        highest_revealed_bid_lamports, offset = self._read_u64(data, offset)
        status_code, offset = self._read_u8(data, offset)
        settled_raw, offset = self._read_u8(data, offset)
        _, offset = self._read_u8(data, offset)  # bump
        _, offset = self._read_u8(data, offset)  # vault_bump

        if status_code not in {
            AUCTION_STATUS_DRAFT,
            AUCTION_STATUS_COMMIT_PHASE,
            AUCTION_STATUS_REVEAL_PHASE,
            AUCTION_STATUS_FINALIZED,
            AUCTION_STATUS_CANCELLED,
        }:
            raise ValueError(f"Invalid auction status code: {status_code}")

        return DecodedAuctionAccount(
            auction_pubkey=auction_pubkey,
            protocol_pubkey=protocol_pubkey,
            asset_pubkey=asset_pubkey,
            mint_pubkey=mint_pubkey,
            seller_pubkey=seller_pubkey,
            winner_pubkey=winner_pubkey,
            highest_bidder_pubkey=highest_bidder_pubkey,
            start_ts=start_ts,
            commit_end_ts=commit_end_ts,
            reveal_end_ts=reveal_end_ts,
            min_bid_lamports=min_bid_lamports,
            highest_revealed_bid_lamports=highest_revealed_bid_lamports,
            status_code=status_code,
            settled=bool(settled_raw),
            slot=slot,
        )

    def get_decoded_asset(self, asset_pubkey: str) -> DecodedAssetAccount:
        account_value, slot = self._get_account_and_slot(asset_pubkey)
        data = self._validate_owner_and_discriminator(
            asset_pubkey,
            account_value,
            ASSET_DISCRIMINATOR,
        )
        offset = 8

        protocol_pubkey, offset = self._read_pubkey(data, offset)
        _, offset = self._read_u64(data, offset)  # asset_id
        mint_pubkey, offset = self._read_pubkey(data, offset)
        _, offset = self._read_pubkey(data, offset)  # creator
        current_owner_pubkey, offset = self._read_pubkey(data, offset)
        _, offset = self._read_anchor_string(data, offset)  # title
        _, offset = self._read_anchor_string(data, offset)  # metadata_uri
        _, offset = self._read_anchor_string(data, offset)  # real_world_ref

        if offset + 34 > len(data):
            raise ValueError("Invalid asset account data length")

        return DecodedAssetAccount(
            asset_pubkey=asset_pubkey,
            protocol_pubkey=protocol_pubkey,
            mint_pubkey=mint_pubkey,
            current_owner_pubkey=current_owner_pubkey,
            slot=slot,
        )

    def verify_tx_hint_for_auction(
        self,
        signature: str,
        auction_pubkey: str,
    ) -> TxVerificationResult:
        if not signature:
            return TxVerificationResult(ok=False, slot=None)

        try:
            response = self.client.get_transaction(
                signature,
                encoding="json",
                max_supported_transaction_version=0,
            )
        except TypeError:
            response = self.client.get_transaction(
                signature,
                max_supported_transaction_version=0,
            )

        payload = self._resp_to_dict(response)
        result = payload.get("result")
        if result is None:
            return TxVerificationResult(ok=False, slot=None)

        meta = result.get("meta") or {}
        if meta.get("err") is not None:
            return TxVerificationResult(ok=False, slot=result.get("slot"))

        message = ((result.get("transaction") or {}).get("message") or {})
        account_keys = message.get("accountKeys") or []
        keys: list[str] = []
        for key in account_keys:
            if isinstance(key, str):
                keys.append(key)
            elif isinstance(key, dict):
                pubkey = key.get("pubkey")
                if pubkey:
                    keys.append(pubkey)

        ok = auction_pubkey in keys and PROGRAM_ID in keys
        return TxVerificationResult(ok=ok, slot=result.get("slot"))


class MockAnchorChainClient:
    """In-memory mock used when DEV_AUTH_BYPASS=true or in unit tests.

    All methods return plausible-looking data without touching the RPC.
    Tests can further monkeypatch individual methods for fine-grained control.
    """

    def get_account(self, pubkey: str) -> Optional[dict]:
        return {"mock": True, "pubkey": pubkey}

    def get_slot(self) -> int:
        return 1

    def get_decoded_auction(self, auction_pubkey: str) -> DecodedAuctionAccount:
        import time
        now = int(time.time())
        return DecodedAuctionAccount(
            auction_pubkey=auction_pubkey,
            protocol_pubkey=DEFAULT_PUBKEY,
            asset_pubkey=DEFAULT_PUBKEY,
            mint_pubkey=DEFAULT_PUBKEY,
            seller_pubkey=DEFAULT_PUBKEY,
            winner_pubkey=DEFAULT_PUBKEY,
            highest_bidder_pubkey=DEFAULT_PUBKEY,
            start_ts=now - 3600,
            commit_end_ts=now + 3600,
            reveal_end_ts=now + 7200,
            min_bid_lamports=1_000_000_000,
            highest_revealed_bid_lamports=0,
            status_code=AUCTION_STATUS_COMMIT_PHASE,
            settled=False,
            slot=1,
        )

    def get_decoded_asset(self, asset_pubkey: str) -> DecodedAssetAccount:
        return DecodedAssetAccount(
            asset_pubkey=asset_pubkey,
            protocol_pubkey=DEFAULT_PUBKEY,
            mint_pubkey=DEFAULT_PUBKEY,
            current_owner_pubkey=DEFAULT_PUBKEY,
            slot=1,
        )

    def verify_tx_hint_for_auction(
        self, signature: str, auction_pubkey: str
    ) -> TxVerificationResult:
        if not signature:
            return TxVerificationResult(ok=False, slot=None)
        return TxVerificationResult(ok=True, slot=1)

    def create_auction_on_chain(
        self,
        title: str,
        metadata_uri: str,
        real_world_ref: str,
        min_bid_lamports: int,
        commit_duration_secs: int = 120,
        reveal_duration_secs: int = 60,
    ) -> CreateOnChainResult:
        return CreateOnChainResult(
            auction_pubkey=DEFAULT_PUBKEY,
            asset_pubkey=DEFAULT_PUBKEY,
            mint_pubkey=DEFAULT_PUBKEY,
            seller_pubkey=DEFAULT_PUBKEY,
            slot=1,
        )

    def commit_bid_on_chain(
        self,
        auction_pubkey: str,
        amount_lamports: int,
    ) -> CommitBidOnChainResult:
        return CommitBidOnChainResult(
            signature="mock_bid_sig",
            bid_commit_pubkey=DEFAULT_PUBKEY,
            salt_hex="00" * 32,
            slot=1,
        )

    def cancel_auction_on_chain(
        self,
        auction_pubkey: str,
        asset_pubkey: str,
        mint_pubkey: str,
    ) -> CancelAuctionOnChainResult:
        return CancelAuctionOnChainResult(signature="mock_cancel_sig", slot=1)

    def finalize_auction_on_chain(
        self,
        auction_pubkey: str,
        seller_pubkey: str,
        treasury_pubkey: str,
    ) -> FinalizeAuctionOnChainResult:
        return FinalizeAuctionOnChainResult(signature="mock_finalize_sig", slot=1)


anchor_chain_client: AnchorChainClient = AnchorChainClient()
