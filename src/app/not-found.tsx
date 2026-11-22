import Link from "next/link";

/** Root fallback when a request is outside a locale segment. */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 48, fontWeight: 800, margin: 0 }}>404</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Page not found</h1>
          <p style={{ maxWidth: 360, color: "#666", margin: 0 }}>
            This link does not exist or the page has moved.
          </p>
          <Link
            href="/"
            style={{
              marginTop: 12,
              display: "inline-flex",
              height: 44,
              alignItems: "center",
              padding: "0 20px",
              borderRadius: 999,
              background: "#111",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Back to home
          </Link>
        </div>
      </body>
    </html>
  );
}
