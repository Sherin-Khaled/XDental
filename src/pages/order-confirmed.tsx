import { useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/context/LanguageContext";

export default function OrderConfirmed() {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/cart?checkout=unavailable", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[var(--xd-bg)] px-5 text-center">
      <p role="status" className="text-[14px] font-semibold text-[#717182]">
        {t("cart.checkoutUnavailable")}
      </p>
    </div>
  );
}
