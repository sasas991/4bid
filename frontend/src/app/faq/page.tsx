export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">FAQ</h1>
      <div className="mt-5 space-y-5 text-sm leading-6 text-gray-700">
        <section>
          <h2 className="text-base font-semibold text-gray-900">Do I need an account?</h2>
          <p className="mt-1">You can use wallet-based sign-in. Some actions may require a linked wallet.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-gray-900">Can I bid after auction end?</h2>
          <p className="mt-1">No. Bidding is available only for active auctions before the deadline.</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-gray-900">How are files handled?</h2>
          <p className="mt-1">Uploaded files are stored with metadata records and linked to user or auction entities.</p>
        </section>
      </div>
    </main>
  );
}
