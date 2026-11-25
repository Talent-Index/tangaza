/**
 * Structured data for search engines, as a plain <script type="application/ld+json">.
 *
 * A native script tag rather than next/script: this is data, not code to run. The
 * payload can carry text a business typed (campaign titles), and "</script>" inside a
 * string would end the tag early, so every "<" is written as its unicode escape. JSON
 * parsers read it back as the same character.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
