import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "/auctions", label: "Browse Auctions" },
  { href: "/create", label: "Create Auction" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
];

const COMPANY_LINKS = [
  { href: "/about", label: "About 4BID" },
  { href: "/contacts", label: "Contacts" },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t bg-white px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <h3 className="text-lg font-bold text-gray-900">4BID</h3>
            <p className="mt-2 text-sm text-gray-600">
              Decentralized auctions on Solana with wallet-based identity, signed bids, and transparent settlement.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[#3665F3]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[#3665F3]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[#3665F3]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-4 text-xs text-gray-500">
          <p>© {year} 4BID. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
