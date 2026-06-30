import { Link } from "wouter";
import * as Icons from "lucide-react";
import { GlassCard } from "./GlassCard";

interface CategoryCardProps {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  productCount?: number | null;
}

export function CategoryCard({ id, name, slug, icon, productCount }: CategoryCardProps) {
  const IconComponent = icon && (Icons as any)[icon] ? (Icons as any)[icon] : Icons.Package;

  return (
    <Link href={`/products?category=${slug}`} className="group block outline-none" data-testid={`link-category-${id}`}>
      <GlassCard hoverEffect className="p-6 h-full flex flex-col items-center justify-center text-center gap-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--xd-gold-active)]">
        <div className="w-16 h-16 rounded-full bg-[#EFE8D8]/50 flex items-center justify-center text-[var(--xd-gold-text)] transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <IconComponent size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="font-display font-semibold text-[#050505] leading-tight mb-1">{name}</h3>
          {productCount !== null && (
            <p className="text-sm text-[#7A7A7A]">{productCount} Products</p>
          )}
        </div>
      </GlassCard>
    </Link>
  );
}
