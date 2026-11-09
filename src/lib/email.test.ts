import assert from "node:assert/strict";
import { test } from "node:test";
import { composeEmail } from "@/lib/email";

const base = { to: "name@example.com", subject: "Subject", heading: "Heading", paragraphs: [] };

test("escapes everything it puts in the HTML", () => {
  const { html } = composeEmail({
    ...base,
    heading: `<script>alert("x")</script>`,
    paragraphs: [`Tom & Jerry's <b>coat</b>`],
    action: { label: "<i>View</i>", url: `https://shop.example/a?b=1&c="><img src=x>` },
    footnote: "<hr>",
  });
  for (const raw of ["<script>", "<b>", "<i>", `"><img`, "<hr>"]) {
    assert.equal(html.includes(raw), false, raw);
  }
  assert.ok(html.includes("Tom &#38; Jerry&#39;s &#60;b&#62;coat&#60;/b&#62;"));
  assert.ok(html.includes(`href="https://shop.example/a?b=1&#38;c=&#34;&#62;&#60;img src=x&#62;"`));
});

test("the text version keeps the words and the link as typed", () => {
  const { text } = composeEmail({
    ...base,
    paragraphs: ["First", "Second"],
    action: { label: "View", url: "https://shop.example/o?x=1&y=2" },
  });
  assert.equal(
    text,
    "Heading\n\nFirst\n\nSecond\n\nView: https://shop.example/o?x=1&y=2\n\nAtelier client services",
  );
});
