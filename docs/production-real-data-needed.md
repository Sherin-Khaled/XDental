# Production real data needed

These footer items are intentionally left as-is (UI/design unchanged, nothing
invented) pending real business data/URLs from the client. Do not treat these
as bugs to silently fix — they are placeholders awaiting real content.

## Social links — `PENDING_REAL_URL`

`src/components/dental/Footer.tsx` — `SOCIAL` array (~line 63) renders four
icons with no `href` at all; the actual anchor is rendered at ~line 239 with
`href="#"`.

| Platform | Current state | Needed |
|---|---|---|
| Instagram | `href="#"` | Real X Dental Store Instagram URL |
| X/Twitter | `href="#"` | Real X Dental Store X/Twitter URL |
| Facebook | `href="#"` | Real X Dental Store Facebook URL |
| LinkedIn | `href="#"` | Real X Dental Store LinkedIn URL |

Once supplied, wire each into the existing `SOCIAL` array's icon entries —
no layout/design change needed, only adding a real `href`.

## "Our Partners" — `PENDING_REAL_CONTENT`

`src/components/dental/Footer.tsx` — `FOOTER_LINKS.company` (~line 39):
`{ labelKey: "footer.links.ourPartners", href: "/brands" }`.

Currently points to `/brands` (same destination as "Trusted Brands" right
above it). Needs a decision: is "Our Partners" meant to be its own page/
content (e.g. distributor/manufacturer partnerships) or intentionally the
same destination as "Trusted Brands"? If a decision is provided, only the
`href` (and, if a new page, the page itself) needs to change — no existing
link/label/design is being touched until then.

## "Blog" — `PENDING_REAL_CONTENT`

`src/components/dental/Footer.tsx` — `FOOTER_LINKS.company` (~line 40):
`{ labelKey: "footer.links.blog", href: "/about" }`.

Currently points to `/about` — there is no blog page or blog content in the
app. Needs a decision: build a real blog section, or repoint/relabel this
link to something that exists. Left untouched until real content/direction
is supplied.

---

None of the above block deployment functionally — clicking them does not
error or 404 (the anchors resolve, just not to their intended real
destination yet). They are launch-content gaps, not code defects.
