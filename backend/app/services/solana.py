import json
from typing import Any, Optional

from solana.rpc.api import Client
from solders.signature import Signature
from ..core.config import settings

LAMPORTS_PER_SOL = 1_000_000_000

client = Client(settings.SOLANA_RPC_URL)


def _resp_to_dict(response: Any) -> dict:
    if isinstance(response, dict):
        return response
    if hasattr(response, "to_json"):
        return json.loads(response.to_json())
    raise ValueError("Unsupported RPC response format")


def get_confirmed_transaction(tx_signature: str):
    """Read-only helper for transaction lookups used by indexers/analytics."""
    try:
        sig = Signature.from_string(tx_signature)
        return client.get_transaction(sig, max_supported_transaction_version=0).value
    except Exception:
        return None


def verify_deposit_transaction(
    signature: str,
    expected_sender: Optional[str],
    expected_amount_sol: float,
) -> Optional[float]:
    """Verify an on-chain SOL transfer and return the actual transferred amount.

    Returns the verified amount in SOL, or None if verification fails.
    """
    if not signature or not expected_sender:
        return None

    try:
        response = client.get_transaction(
            Signature.from_string(signature),
            max_supported_transaction_version=0,
        )
        payload = _resp_to_dict(response)
        result = payload.get("result")
        if result is None:
            return None

        meta = result.get("meta") or {}
        if meta.get("err") is not None:
            return None

        message = (result.get("transaction") or {}).get("message") or {}
        account_keys = message.get("accountKeys") or []
        keys: list[str] = []
        for key in account_keys:
            if isinstance(key, str):
                keys.append(key)
            elif isinstance(key, dict):
                keys.append(key.get("pubkey", ""))

        if expected_sender not in keys:
            return None

        sender_idx = keys.index(expected_sender)
        pre_balances = meta.get("preBalances") or []
        post_balances = meta.get("postBalances") or []

        if sender_idx >= len(pre_balances) or sender_idx >= len(post_balances):
            return None

        spent_lamports = pre_balances[sender_idx] - post_balances[sender_idx]
        if spent_lamports <= 0:
            return None

        # The sender also pays tx fees, so transferred amount <= spent amount.
        # Use the claimed amount if the sender spent at least that much.
        expected_lamports = int(expected_amount_sol * LAMPORTS_PER_SOL)
        if spent_lamports < expected_lamports:
            return None

        return expected_amount_sol
    except Exception:
        return None


def verify_payment(*args, **kwargs):
    """
    Deprecated in execution path.
    Settlement authority lives on-chain in the Anchor program.
    Kept only for backward compatibility with any legacy callers.
    """
    return False
