"use client";

/** Last resort: the root layout itself failed, so this renders its own document. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", margin: 0 }}>Afrikob Pay could not start this page</h1>
        <p style={{ color: "#5a6472", marginTop: "0.5rem" }}>
          Try again. If it keeps happening, quote reference {error.digest ?? "unknown"} to support.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            background: "#ee8434",
            color: "#fff",
            border: 0,
            borderRadius: "0.5rem",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
