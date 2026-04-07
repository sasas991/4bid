"""Tests for Solana transaction verification service."""

from app.services.solana import verify_deposit_transaction


def test_verify_returns_none_for_empty_signature():
    result = verify_deposit_transaction(
        signature="",
        expected_sender="SomeWallet123",
        expected_amount_sol=1.0,
    )
    assert result is None


def test_verify_returns_none_for_empty_sender():
    result = verify_deposit_transaction(
        signature="some_sig",
        expected_sender="",
        expected_amount_sol=1.0,
    )
    assert result is None


def test_verify_returns_none_for_none_sender():
    result = verify_deposit_transaction(
        signature="some_sig",
        expected_sender=None,
        expected_amount_sol=1.0,
    )
    assert result is None


def test_verify_returns_none_for_none_signature():
    result = verify_deposit_transaction(
        signature=None,
        expected_sender="SomeWallet",
        expected_amount_sol=1.0,
    )
    assert result is None
