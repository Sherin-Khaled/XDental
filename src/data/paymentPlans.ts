export type PaymentPlanPartner = {
  id: string;
  name: string;
  logo: string;
  logoWidth: number;
  logoHeight: number;
  titleKey: string;
  highlightKey: string;
  descriptionKey: string;
};

export const PAYMENT_PLAN_PARTNERS: PaymentPlanPartner[] = [
  {
    id: "valu",
    name: "valU",
    logo: "payment-logos/valu.png",
    logoWidth: 49,
    logoHeight: 28,
    titleKey: "home.paymentPlans.partners.valu.title",
    highlightKey: "home.paymentPlans.partners.valu.highlight",
    descriptionKey: "home.paymentPlans.partners.valu.description",
  },
  {
    id: "seven",
    name: "seven",
    logo: "payment-logos/seven.png",
    logoWidth: 82,
    logoHeight: 51,
    titleKey: "home.paymentPlans.partners.seven.title",
    highlightKey: "home.paymentPlans.partners.seven.highlight",
    descriptionKey: "home.paymentPlans.partners.seven.description",
  },
  {
    id: "tru",
    name: "TRU",
    logo: "payment-logos/tru.svg",
    logoWidth: 64,
    logoHeight: 64,
    titleKey: "home.paymentPlans.partners.tru.title",
    highlightKey: "home.paymentPlans.partners.tru.highlight",
    descriptionKey: "home.paymentPlans.partners.tru.description",
  },
  {
    id: "fawry",
    name: "Fawry",
    logo: "payment-logos/fawry.png",
    logoWidth: 158,
    logoHeight: 51,
    titleKey: "home.paymentPlans.partners.fawry.title",
    highlightKey: "home.paymentPlans.partners.fawry.highlight",
    descriptionKey: "home.paymentPlans.partners.fawry.description",
  },
  {
    id: "paymob",
    name: "Paymob",
    logo: "payment-logos/paymob.png",
    logoWidth: 320,
    logoHeight: 74,
    titleKey: "home.paymentPlans.partners.paymob.title",
    highlightKey: "home.paymentPlans.partners.paymob.highlight",
    descriptionKey: "home.paymentPlans.partners.paymob.description",
  },
];
