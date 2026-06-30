import React from "react";
import { Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantitySelector({
  quantity,
  onQuantityChange,
  min = 1,
  max = 99,
  className
}: QuantitySelectorProps) {
  const handleDecrease = () => {
    if (quantity > min) onQuantityChange(quantity - 1);
  };

  const handleIncrease = () => {
    if (quantity < max) onQuantityChange(quantity + 1);
  };

  return (
    <div className={cn("flex items-center border border-gray-200 rounded-full h-10 w-fit", className)}>
      <button
        type="button"
        onClick={handleDecrease}
        disabled={quantity <= min}
        className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-gray-900 disabled:opacity-50 transition-colors"
        data-testid="button-decrease-qty"
      >
        <Minus size={16} />
      </button>
      <div className="w-10 text-center font-medium text-sm select-none" data-testid="text-qty-value">
        {quantity}
      </div>
      <button
        type="button"
        onClick={handleIncrease}
        disabled={quantity >= max}
        className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-gray-900 disabled:opacity-50 transition-colors"
        data-testid="button-increase-qty"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
