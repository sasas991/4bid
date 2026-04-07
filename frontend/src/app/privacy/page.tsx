export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <div className="mt-5 space-y-4 text-sm leading-6 text-gray-700">
        <p>This page is a placeholder privacy notice for the 4BID interface.</p>
        <p>
          The application may process wallet addresses, profile metadata, and auction-related data required to operate
          core functionality.
        </p>
        <p>Never share your private keys or seed phrases. Wallet signatures are performed client-side.</p>
      </div>
    </main>
  );
}
