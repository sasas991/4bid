from solana.rpc.api import Client
from solders.signature import Signature
from ..core.config import settings

client = Client(settings.SOLANA_RPC_URL)


def get_confirmed_transaction(tx_signature: str):
    """Read-only helper for transaction lookups used by indexers/analytics."""
    try:
        sig = Signature.from_string(tx_signature)
        return client.get_transaction(sig, max_supported_transaction_version=0).value
    except Exception:
        return None


def verify_payment(*args, **kwargs):
    """
    Deprecated in execution path.
    Settlement authority lives on-chain in the Anchor program.
    Kept only for backward compatibility with any legacy callers.
    """
    return False
