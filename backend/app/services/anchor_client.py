from __future__ import annotations

import base64
import hashlib
import json
import struct
from dataclasses import dataclass
from typing import Any, Optional

from solana.rpc.api import Client
from solders.pubkey import Pubkey

from ..core.config import settings

PROGRAM_ID = "BLt6gcTzkeyZ5ygxem5AZSFQ3TyanAzkmRVDnyRNHHC2"
DEFAULT_PUBKEY = str(Pubkey.default())

AUCTION_DISCRIMINATOR = hashlib.sha256(b"account:Auction").digest()[:8]
ASSET_DISCRIMINATOR = hashlib.sha256(b"account:Asset").digest()[:8]

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


anchor_chain_client = AnchorChainClient()
