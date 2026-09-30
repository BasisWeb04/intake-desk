import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-panel">
      <div className="bg-accent-soft text-ink">
        <p className="mx-auto max-w-6xl px-4 py-1.5 text-xs">
          <strong>Demo with fictional data.</strong> Copperline Plumbing &amp; Drain, its neighborhoods and every ticket are
          invented. Built by{" "}
          <a className="font-medium text-accent underline underline-offset-2" href="https://ethanchacko.com">
            Ethan Chacko
          </a>
          .
        </p>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-base font-semibold tracking-tight">Intake Desk</p>
          <p className="text-xs text-muted">Copperline Plumbing &amp; Drain (fictional), Port Calloway</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 text-sm">
          <Link className="rounded px-3 py-1.5 hover:bg-accent-soft" href="/">
            Customer intake
          </Link>
          <Link className="rounded px-3 py-1.5 hover:bg-accent-soft" href="/dispatch">
            Dispatch board
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-muted">
        <p>Demo with fictional data. Not a real business; do not use for real emergencies.</p>
        <p>
          Built by{" "}
          <a className="text-accent underline underline-offset-2" href="https://ethanchacko.com">
            Ethan Chacko
          </a>
          . MIT licensed.
        </p>
      </div>
    </footer>
  );
}
