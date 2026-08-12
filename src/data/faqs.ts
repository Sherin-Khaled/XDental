// Single source of FAQ metadata, shared by the Contact page teaser
// ("Answers before you contact us") and the full FAQs page. The actual
// question/answer strings live in the locale files under
// `faqsPage.categories.*` so English and Arabic stay translated in one place —
// components resolve the keys with `t()`.

export type FaqCategoryKey =
  | "ordersQuotes"
  | "supplyLists"
  | "productRequests"
  | "accountSupport";

export type FaqItem = {
  id: string;
  category: FaqCategoryKey;
  questionKey: string;
  answerKey: string;
};

const faq = (category: FaqCategoryKey, id: string): FaqItem => ({
  id,
  category,
  questionKey: `faqsPage.categories.${category}.items.${id}.question`,
  answerKey: `faqsPage.categories.${category}.items.${id}.answer`,
});

// Ordered by importance: the first HOME_FAQ_COUNT items are the teaser shown
// before the contact form; the FAQs page lists all of them in this order.
export const FAQS: FaqItem[] = [
  faq("ordersQuotes", "quoteBeforeOrdering"),
  faq("supplyLists", "saveRepeatedLists"),
  faq("productRequests", "unlistedProduct"),
  faq("ordersQuotes", "orderVsQuote"),
  faq("ordersQuotes", "trackQuotes"),
  faq("supplyLists", "whatIsSupplyList"),
  faq("supplyLists", "cartToSupplyList"),
  faq("productRequests", "unavailableProduct"),
  faq("productRequests", "requestsInAccount"),
  faq("accountSupport", "accountRequired"),
  faq("accountSupport", "contactSupport"),
];

export const HOME_FAQ_COUNT = 3;

export const HOME_FAQS = FAQS.slice(0, HOME_FAQ_COUNT);
