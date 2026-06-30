import { mockProducts } from './products';

export const mockOrders = [
  {
    id: "ord-1",
    orderNumber: "ORD-2023-1042",
    date: "2023-10-24T14:30:00Z",
    status: "Delivered",
    paymentStatus: "Paid",
    deliveryStatus: "Delivered",
    items: [
      { product: mockProducts[0], quantity: 2, price: 150, selectedOptions: "21mm" },
      { product: mockProducts[3], quantity: 1, price: 650, selectedOptions: "1:100,000" }
    ],
    itemCount: 3,
    subtotal: 950,
    shipping: 50,
    discount: 0,
    total: 1000,
    shippingAddress: {
      name: "Sherin Khaled",
      line1: "45 El-Batal Ahmed Abdel Aziz St.",
      city: "Mohandeseen",
      governorate: "Giza",
      country: "Egypt",
      phone: "+20 100 123 4567"
    },
    paymentMethod: "Credit Card (Visa ending in 4242)",
    deliveryMethod: "Standard Delivery",
    trackingSteps: [
      { label: "Order Placed", status: "completed", date: "2023-10-24T14:30:00Z" },
      { label: "Processing", status: "completed", date: "2023-10-24T16:00:00Z" },
      { label: "Shipped", status: "completed", date: "2023-10-25T09:15:00Z" },
      { label: "Delivered", status: "completed", date: "2023-10-26T11:45:00Z" }
    ],
    invoiceAvailable: true
  },
  {
    id: "ord-2",
    orderNumber: "ORD-2023-1089",
    date: "2023-11-05T09:15:00Z",
    status: "Shipped",
    paymentStatus: "Paid",
    deliveryStatus: "In Transit",
    items: [
      { product: mockProducts[2], quantity: 5, price: 850, selectedOptions: "A2" }
    ],
    itemCount: 5,
    subtotal: 4250,
    shipping: 0,
    discount: 425,
    total: 3825,
    shippingAddress: {
      name: "Sherin Khaled",
      line1: "45 El-Batal Ahmed Abdel Aziz St.",
      city: "Mohandeseen",
      governorate: "Giza",
      country: "Egypt",
      phone: "+20 100 123 4567"
    },
    paymentMethod: "Cash on Delivery",
    deliveryMethod: "Fast Delivery",
    trackingSteps: [
      { label: "Order Placed", status: "completed", date: "2023-11-05T09:15:00Z" },
      { label: "Processing", status: "completed", date: "2023-11-05T10:30:00Z" },
      { label: "Shipped", status: "completed", date: "2023-11-05T18:20:00Z" },
      { label: "Delivered", status: "pending", date: null }
    ],
    invoiceAvailable: false
  },
  {
    id: "ord-3",
    orderNumber: "ORD-2023-1102",
    date: "2023-11-12T16:45:00Z",
    status: "Processing",
    paymentStatus: "Pending",
    deliveryStatus: "Awaiting Shipment",
    items: [
      { product: mockProducts[5], quantity: 1, price: 780, selectedOptions: "Standard" },
      { product: mockProducts[4], quantity: 2, price: 1450, selectedOptions: "Light Body" }
    ],
    itemCount: 3,
    subtotal: 3680,
    shipping: 50,
    discount: 0,
    total: 3730,
    shippingAddress: {
      name: "Sherin Khaled",
      line1: "45 El-Batal Ahmed Abdel Aziz St.",
      city: "Mohandeseen",
      governorate: "Giza",
      country: "Egypt",
      phone: "+20 100 123 4567"
    },
    paymentMethod: "Bank Transfer",
    deliveryMethod: "Standard Delivery",
    trackingSteps: [
      { label: "Order Placed", status: "completed", date: "2023-11-12T16:45:00Z" },
      { label: "Processing", status: "current", date: null },
      { label: "Shipped", status: "pending", date: null },
      { label: "Delivered", status: "pending", date: null }
    ],
    invoiceAvailable: false
  }
];
