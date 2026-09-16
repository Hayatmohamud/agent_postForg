import Link from "next/link";

/**
 * Shared chrome for the public auth screens (sign-in / sign-up): a minimal
 * header with just the logo (back to the marketing landing) and a centered,
 * single-column layout — per DESIGN_PROMPT.md screen 2 ("Clean, minimal,
 * single-column card").
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-gray-50">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-gray-900">
            PostForge
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        {children}
      </main>
    </div>
  );
}
