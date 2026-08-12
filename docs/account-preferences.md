# Account preferences and notification policy

Account preferences belong to the authenticated customer identified by the
HttpOnly JWT cookie. The account API never accepts a `userId`.

## Notification categories

Optional customer notification types are mapped as follows:

- `ORDER_UPDATE` → `orderUpdates`
- `QUOTE_UPDATE` → `quoteUpdates`
- `PRODUCT_REQUEST` → `productRequestUpdates`
- `PRODUCT_AVAILABLE` → `backInStockUpdates`
- `SUPPORT_MESSAGE` → `supportReplyUpdates`

`ACCOUNT` notifications and notifications explicitly marked `mandatory` are
security or critical account messages and are never suppressed. Staff
notifications are also not affected by customer preferences. Disabling an
optional category prevents future database and push notifications; existing
notification history is retained.

## Marketing consent

Weekly offers, new arrivals, clinic supply offers, and marketing back-in-stock
messages default to off. An explicit account preference opt-in synchronizes the
existing newsletter subscriber record. Turning all marketing choices off marks
that subscriber as unsubscribed. This synchronization stores consent only and
does not send email, so `MAIL_ENABLED=false` remains safe.

Transactional order, quote, product-request, support, and security messages are
not marketing messages and do not use newsletter consent.

## Privacy choices

Privacy/data-use choices default to off and are persisted now. The current
catalog recommendation rows are generic merchandising data and do not use
customer browsing or order history. Any future personalized recommendation,
browsing-history, or reorder-suggestion service must read the recipient's
`AccountPreference` before collecting or using that data:

- require `personalizedRecommendations` for personalized ranking;
- require `saveBrowsingActivity` before persisting browsing activity;
- require `useOrderHistoryForSuggestions` before using order history for
  recommendation or reorder ranking.

The UI deliberately does not claim that personalization is already active.

## Session compatibility

New registrations and logins receive a signed JWT containing a server-tracked
session identifier. Production rejects legacy JWTs without that identifier, so
deployment requires one controlled sign-in. Local development temporarily
accepts legacy JWTs to avoid disrupting current work, but a legacy session must
sign in again before it can use "sign out other devices."
