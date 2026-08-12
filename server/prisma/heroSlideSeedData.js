const supportCard = {
  title: { en: "Need Help Choosing?", ar: "تحتاج مساعدة في الاختيار؟" },
  items: [
    { en: "Chat with our support team", ar: "تواصل مع فريق الدعم" },
    { en: "Ask about products, brands, or availability", ar: "اسأل عن المنتجات أو العلامات أو التوفر" },
    { en: "Get help with quotes and clinic orders", ar: "احصل على مساعدة في عروض الأسعار وطلبات العيادة" },
    { en: "We will reply as soon as possible", ar: "سنرد في أقرب وقت ممكن" },
  ],
};

export const HERO_SLIDE_SEEDS = [
  {
    id: "hero-brand",
    slotNumber: 1,
    order: 1,
    content: {
      badgeText: { en: "Trusted Dental Supplies", ar: "مستلزمات أسنان موثوقة" },
      headline: {
        en: "Premium Dental Products for Clinics & Professionals",
        ar: "منتجات أسنان متميزة للعيادات والأطباء",
      },
      headlineHighlight: { en: "Clinics & Professionals", ar: "للعيادات والأطباء" },
      subtext: {
        en: "We provide high-quality dental instruments, clinic essentials, and trusted brands - all in one place with competitive pricing and reliable delivery.",
        ar: "نوفر أدوات أسنان عالية الجودة ومستلزمات عيادات وعلامات تجارية موثوقة في مكان واحد، بأسعار تنافسية وتوصيل يعتمد عليه.",
      },
      primaryCta: { label: { en: "Browse Products", ar: "تصفح المنتجات" }, href: "/products" },
      secondaryCta: { label: { en: "Request a Quote", ar: "اطلب عرض سعر" }, href: "/contact" },
      image: {
        src: "/hero%20section/firstslide.png",
        alt: {
          en: "Dental professional presenting dental care products",
          ar: "متخصصة تعرض منتجات العناية بالأسنان",
        },
      },
      glassCard: supportCard,
      floatingLabels: [
        { en: "Best Sellers", ar: "الأكثر مبيعًا" },
        { en: "Fast Delivery", ar: "توصيل سريع" },
      ],
      stats: [
        { value: { en: "500+", ar: "500+" }, label: { en: "Products", ar: "منتج" } },
        { value: { en: "50+", ar: "50+" }, label: { en: "Trusted Brands", ar: "علامة موثوقة" } },
        { value: { en: "1,200+", ar: "1,200+" }, label: { en: "Clinics Served", ar: "عيادة نخدمها" } },
      ],
    },
  },
  {
    id: "hero-offer",
    slotNumber: 2,
    order: 2,
    content: {
      badgeText: { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
      headline: {
        en: "Clinic Essentials, Delivered by X Dental",
        ar: "مستلزمات عيادتك، بتوصيل من فريق X Dental",
      },
      headlineHighlight: { en: "Delivered by X Dental", ar: "بتوصيل من فريق X Dental" },
      subtext: {
        en: "Order trusted dental supplies and our team will contact you to confirm availability, delivery details, and Cash on Delivery payment.",
        ar: "اطلب مستلزمات أسنان موثوقة وسيتواصل معك فريقنا لتأكيد التوفر وتفاصيل التوصيل والدفع نقدًا عند الاستلام.",
      },
      primaryCta: { label: { en: "Shop Products", ar: "تسوق المنتجات" }, href: "/products" },
      secondaryCta: { label: { en: "Contact Support", ar: "تواصل مع الدعم" }, href: "/contact" },
      image: {
        src: "/hero%20section/secondslide.png",
        alt: {
          en: "Dental supplies delivered by the X Dental team",
          ar: "مستلزمات أسنان بتوصيل من فريق X Dental",
        },
      },
      glassCard: null,
      floatingLabels: [
        { en: "Cash on Delivery", ar: "الدفع عند الاستلام" },
        { en: "Team Delivery", ar: "توصيل بواسطة فريقنا" },
      ],
    },
  },
  {
    id: "hero-equipment",
    slotNumber: 3,
    order: 3,
    content: {
      badgeText: { en: "New Arrivals", ar: "وصل حديثًا" },
      headline: {
        en: "Endo Motors & Equipment from Top Global Brands",
        ar: "أجهزة ومحركات علاج الجذور من أفضل العلامات العالمية",
      },
      headlineHighlight: {
        en: "Endo Motors & Equipment",
        ar: "أجهزة ومحركات علاج الجذور",
      },
      subtext: {
        en: "Professional endodontic equipment with warranty and fast nationwide delivery.",
        ar: "معدات علاج جذور احترافية بضمان وتوصيل سريع لجميع المحافظات.",
      },
      primaryCta: {
        label: { en: "Explore Equipment", ar: "استكشف الأجهزة" },
        href: "/products?category=machines",
      },
      secondaryCta: { label: { en: "All Brands", ar: "كل العلامات" }, href: "/brands" },
      image: {
        src: "/hero%20section/Thirdslide.png",
        alt: {
          en: "Endodontic motors and dental equipment",
          ar: "محركات علاج جذور ومعدات أسنان",
        },
      },
      glassCard: null,
      floatingLabels: [
        { en: "Warranty", ar: "ضمان" },
        { en: "Best Price", ar: "أفضل سعر" },
      ],
      stats: [
        { value: { en: "50+", ar: "50+" }, label: { en: "Trusted Brands", ar: "علامة موثوقة" } },
        { value: { en: "Warranty", ar: "ضمان" }, label: { en: "Included", ar: "مشمول" } },
        { value: { en: "Nationwide", ar: "لكل مصر" }, label: { en: "Delivery", ar: "توصيل" } },
      ],
    },
  },
];
