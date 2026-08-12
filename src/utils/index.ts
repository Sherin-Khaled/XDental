export const formatCurrency = (price: number): string => {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price).replace('EGP', 'EGP ');
};

export const calculateDiscount = (oldPrice: number | undefined, currentPrice: number): number => {
  if (!oldPrice || oldPrice <= currentPrice) return 0;
  return Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
};

export const getOrderStatusStyle = (status: string) => {
  switch (status.toLowerCase()) {
    case 'delivered':
    case 'confirmed':
    case 'verified':
      return { bg: 'bg-[#16803C]/10', text: 'text-[#16803C]', border: 'border-[#16803C]/20' };
    case 'processing':
    case 'pending':
    case 'pending review':
    case 'pending collection':
    case 'preparing':
      return { bg: 'bg-[var(--xd-gold-bg-soft)]', text: 'text-[var(--xd-gold-text)]', border: 'border-[var(--xd-gold-border-soft)]' };
    case 'shipped':
    case 'sent to supplier/system':
    case 'out for delivery':
      return { bg: 'bg-[#25B8C7]/10', text: 'text-[#178A96]', border: 'border-[#25B8C7]/20' };
    case 'cancelled':
    case 'canceled':
    case 'rejected':
      return { bg: 'bg-[#B42318]/10', text: 'text-[#B42318]', border: 'border-[#B42318]/20' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
  }
};
