export const mockUser = {
  id: "usr-1",
  name: "Sherin Khaled",
  email: "sherin.khaled@example.com",
  phone: "+20 100 123 4567",
  clinicName: "",
  professionalRole: "Dental Professional",
  stats: {
    totalOrders: 12,
    totalSpent: 45200,
    points: 1250
  },
  addresses: [
    {
      id: "addr-1",
      name: "Clinic",
      line1: "45 El-Batal Ahmed Abdel Aziz St.",
      city: "Mohandeseen",
      governorate: "Giza",
      country: "Egypt",
      phone: "+20 100 123 4567",
      isDefault: true
    },
    {
      id: "addr-2",
      name: "Home",
      line1: "12 El-Gezira St.",
      city: "Zamalek",
      governorate: "Cairo",
      country: "Egypt",
      phone: "+20 100 987 6543",
      isDefault: false
    }
  ]
};
