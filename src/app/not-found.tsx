import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <h1>Page not found</h1>
      <p className="lead">That page isn&apos;t in Schemata. Topics live at /topics/&lt;id&gt; and questions at /questions/&lt;id&gt;.</p>
      <Link className="btn primary" href="/">
        Back to Home
      </Link>
    </div>
  );
}
