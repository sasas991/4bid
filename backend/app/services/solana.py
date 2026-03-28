from solana.rpc.api import Client
from solders.signature import Signature
from solders.pubkey import Pubkey
from ..core.config import settings
import time

client = Client(settings.SOLANA_RPC_URL)

def verify_payment(tx_signature: str, expected_amount_sol: float, expected_sender: str, expected_receiver: str):
    """
    Verifies a SOL payment on the Solana network.
    Note: amount is in SOL, but on-chain it's in Lamports (1 SOL = 10^9 Lamports).
    """
    try:
        sig = Signature.from_string(tx_signature)
        # Get transaction details
        response = client.get_transaction(sig, max_supported_transaction_version=0)
        
        if response.value is None:
            # Transaction might not be confirmed yet, wait and retry or return False
            return False
        
        tx = response.value.transaction
        meta = response.value.meta
        
        if meta.err is not None:
            # Transaction failed
            return False

        # Check amount and participants
        # This is a simplified check. A robust check would look at preBalances and postBalances
        # or parse the instruction data.
        
        pre_balances = meta.pre_balances
        post_balances = meta.post_balances
        account_keys = tx.transaction.message.account_keys
        
        sender_pubkey = Pubkey.from_string(expected_sender)
        receiver_pubkey = Pubkey.from_string(expected_receiver)
        
        sender_index = -1
        receiver_index = -1
        
        for i, key in enumerate(account_keys):
            if key == sender_pubkey:
                sender_index = i
            if key == receiver_pubkey:
                receiver_index = i
        
        if sender_index == -1 or receiver_index == -1:
            return False
            
        amount_lamports = pre_balances[receiver_index] - post_balances[receiver_index]
        # Wait, if receiver got money, post should be > pre
        actual_received_lamports = post_balances[receiver_index] - pre_balances[receiver_index]
        expected_lamports = int(expected_amount_sol * 1_000_000_000)
        
        # Allow some small difference due to fees if paid by receiver (unlikely) or just check >=
        if actual_received_lamports >= expected_lamports:
            return True
            
        return False
    except Exception as e:
        print(f"Error verifying payment: {e}")
        return False
