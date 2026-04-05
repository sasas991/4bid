from __future__ import annotations

from typing import Any, Optional

from solana.rpc.api import Client
from solders.pubkey import Pubkey

from ..core.config import settings

PROGRAM_ID = "BLt6gcTzkeyZ5ygxem5AZSFQ3TyanAzkmRVDnyRNHHC2"


class AnchorChainClient:
    """Lightweight RPC client for account-level reads used by backend projections."""

    def __init__(self, rpc_url: Optional[str] = None):
        self.client = Client(rpc_url or settings.SOLANA_RPC_URL)

    def get_account(self, pubkey: str) -> Optional[Any]:
        key = Pubkey.from_string(pubkey)
        result = self.client.get_account_info(key)
        return result.value

    def get_slot(self) -> int:
        return self.client.get_slot().value


anchor_chain_client = AnchorChainClient()
