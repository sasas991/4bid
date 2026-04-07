export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">About 4BID</h1>
      <div className="mt-5 space-y-4 text-sm leading-6 text-gray-700">
        <p>
          4BID is a decentralized auction platform on Solana. Users sign in with wallets, place bids, and settle
          transactions without traditional intermediaries.
        </p>
        <p>
          The project combines on-chain auction execution with a web interface for browsing, filtering, and profile
          management. Critical auction state is verified against blockchain data.
        </p>
        <p>
          Our goal is to make trust-minimized auctions simple: transparent lifecycle, signed actions, and clear records.
        </p>
      </div>
    </main>
  );
}
