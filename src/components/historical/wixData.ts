export const WIX_MONTHLY_DATA = [
  { year: 2024, month: 1,  bookings: 5,   revenue: 180,   cancelled: 0,  customers: 3 },
  { year: 2024, month: 3,  bookings: 25,  revenue: 240,   cancelled: 10, customers: 19 },
  { year: 2024, month: 4,  bookings: 42,  revenue: 86,    cancelled: 10, customers: 37 },
  { year: 2024, month: 5,  bookings: 75,  revenue: 450,   cancelled: 16, customers: 62 },
  { year: 2024, month: 6,  bookings: 72,  revenue: 2039,  cancelled: 12, customers: 56 },
  { year: 2024, month: 7,  bookings: 100, revenue: 3710,  cancelled: 16, customers: 77 },
  { year: 2024, month: 8,  bookings: 135, revenue: 5386,  cancelled: 33, customers: 93 },
  { year: 2024, month: 9,  bookings: 115, revenue: 3991,  cancelled: 40, customers: 80 },
  { year: 2024, month: 10, bookings: 155, revenue: 6886,  cancelled: 41, customers: 84 },
  { year: 2024, month: 11, bookings: 119, revenue: 5995,  cancelled: 22, customers: 78 },
  { year: 2024, month: 12, bookings: 189, revenue: 10277, cancelled: 26, customers: 108 },
  { year: 2025, month: 1,  bookings: 105, revenue: 3825,  cancelled: 32, customers: 79 },
  { year: 2025, month: 2,  bookings: 118, revenue: 5126,  cancelled: 18, customers: 88 },
  { year: 2025, month: 3,  bookings: 131, revenue: 5050,  cancelled: 19, customers: 94 },
  { year: 2025, month: 4,  bookings: 141, revenue: 4833,  cancelled: 40, customers: 101 },
  { year: 2025, month: 5,  bookings: 136, revenue: 6099,  cancelled: 27, customers: 111 },
  { year: 2025, month: 6,  bookings: 139, revenue: 6542,  cancelled: 21, customers: 100 },
  { year: 2025, month: 7,  bookings: 193, revenue: 9331,  cancelled: 23, customers: 152 },
  { year: 2025, month: 8,  bookings: 164, revenue: 6369,  cancelled: 26, customers: 134 },
  { year: 2025, month: 9,  bookings: 170, revenue: 7403,  cancelled: 29, customers: 131 },
  { year: 2025, month: 10, bookings: 181, revenue: 9022,  cancelled: 26, customers: 140 },
  { year: 2025, month: 11, bookings: 157, revenue: 6219,  cancelled: 19, customers: 124 },
  { year: 2025, month: 12, bookings: 194, revenue: 9039,  cancelled: 23, customers: 151 },
  { year: 2026, month: 1,  bookings: 147, revenue: 6837,  cancelled: 12, customers: 109 },
  { year: 2026, month: 2,  bookings: 135, revenue: 6364,  cancelled: 12, customers: 112 },
  { year: 2026, month: 3,  bookings: 87,  revenue: 4332,  cancelled: 3,  customers: 71 },
];

export const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export interface WixCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  appointments: WixAppointment[];
}

export interface WixAppointment {
  date: string;
  service: string;
  groomer: string;
  status: string;
  payment: string;
  amount: number;
  dogName?: string;
  dogBreed?: string;
  dogAge?: string;
}

// Representative Wix customer dataset for lookup
export const WIX_CUSTOMERS: WixCustomer[] = [
  {
    firstName: "Sarah", lastName: "Mitchell", email: "sarah.m@email.com", phone: "07700 100001",
    appointments: [
      { date: "2024-12-15", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 55, dogName: "Biscuit", dogBreed: "Cockapoo", dogAge: "3 years" },
      { date: "2024-10-20", service: "Bath & Brush", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 35, dogName: "Biscuit", dogBreed: "Cockapoo" },
      { date: "2024-08-05", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 55, dogName: "Biscuit", dogBreed: "Cockapoo" },
    ]
  },
  {
    firstName: "James", lastName: "Cooper", email: "james.cooper@outlook.com", phone: "07700 100002",
    appointments: [
      { date: "2025-03-10", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 65, dogName: "Duke", dogBreed: "Golden Retriever", dogAge: "5 years" },
      { date: "2025-01-15", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 65, dogName: "Duke", dogBreed: "Golden Retriever" },
      { date: "2024-11-22", service: "Bath & Brush", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 40, dogName: "Duke", dogBreed: "Golden Retriever" },
    ]
  },
  {
    firstName: "Lisa", lastName: "Patel", email: "lisa.patel@gmail.com", phone: "07700 100003",
    appointments: [
      { date: "2024-09-12", service: "Puppy Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 30, dogName: "Mochi", dogBreed: "Shih Tzu", dogAge: "8 months" },
      { date: "2024-07-18", service: "Puppy Groom", groomer: "Emma", status: "Canceled", payment: "Not Paid", amount: 30, dogName: "Mochi", dogBreed: "Shih Tzu" },
    ]
  },
  {
    firstName: "Tom", lastName: "Wilson", email: "tomw@hotmail.com", phone: "07700 100004",
    appointments: [
      { date: "2025-02-28", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 50, dogName: "Charlie", dogBreed: "Cavapoo", dogAge: "2 years" },
      { date: "2024-12-01", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 50, dogName: "Charlie", dogBreed: "Cavapoo" },
      { date: "2024-10-05", service: "Nail Trim", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 15, dogName: "Charlie", dogBreed: "Cavapoo" },
      { date: "2024-08-14", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 50, dogName: "Charlie", dogBreed: "Cavapoo" },
    ]
  },
  {
    firstName: "Rachel", lastName: "Green", email: "rachelg@yahoo.co.uk", phone: "07700 100005",
    appointments: [
      { date: "2024-06-20", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 45, dogName: "Pepper", dogBreed: "Miniature Schnauzer", dogAge: "4 years" },
      { date: "2024-04-10", service: "Bath & Brush", groomer: "Jade", status: "Canceled", payment: "Not Paid", amount: 30, dogName: "Pepper", dogBreed: "Miniature Schnauzer" },
    ]
  },
  {
    firstName: "David", lastName: "Thompson", email: "david.t@email.com", phone: "07700 100006",
    appointments: [
      { date: "2025-03-05", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 60, dogName: "Bear", dogBreed: "Labradoodle", dogAge: "3 years" },
      { date: "2025-01-20", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 60, dogName: "Bear", dogBreed: "Labradoodle" },
      { date: "2024-11-15", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 60, dogName: "Bear", dogBreed: "Labradoodle" },
      { date: "2024-09-08", service: "Bath & Brush", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 40, dogName: "Bear", dogBreed: "Labradoodle" },
      { date: "2024-07-01", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 60, dogName: "Bear", dogBreed: "Labradoodle" },
    ]
  },
  {
    firstName: "Emma", lastName: "Clarke", email: "emma.clarke@icloud.com", phone: "07700 100007",
    appointments: [
      { date: "2024-11-30", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 55, dogName: "Teddy", dogBreed: "Toy Poodle", dogAge: "6 years" },
      { date: "2024-09-22", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Partially Paid", amount: 55, dogName: "Teddy", dogBreed: "Toy Poodle" },
    ]
  },
  {
    firstName: "Mark", lastName: "Johnson", email: "markj@gmail.com", phone: "07700 100008",
    appointments: [
      { date: "2025-02-10", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 70, dogName: "Rex", dogBreed: "German Shepherd", dogAge: "4 years" },
      { date: "2024-12-18", service: "Bath & Brush", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 45, dogName: "Rex", dogBreed: "German Shepherd" },
      { date: "2024-10-25", service: "Full Groom", groomer: "Emma", status: "Canceled", payment: "Not Paid", amount: 70, dogName: "Rex", dogBreed: "German Shepherd" },
    ]
  },
  {
    firstName: "Sophie", lastName: "Brown", email: "sophie.b@outlook.com", phone: "07700 100009",
    appointments: [
      { date: "2025-01-08", service: "Puppy Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 35, dogName: "Luna", dogBreed: "French Bulldog", dogAge: "10 months" },
      { date: "2024-11-05", service: "Puppy Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 35, dogName: "Luna", dogBreed: "French Bulldog" },
    ]
  },
  {
    firstName: "Chris", lastName: "Taylor", email: "chris.taylor@live.com", phone: "07700 100010",
    appointments: [
      { date: "2024-05-15", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 50, dogName: "Buddy", dogBreed: "Cocker Spaniel", dogAge: "7 years" },
      { date: "2024-03-20", service: "Bath & Brush", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 30, dogName: "Buddy", dogBreed: "Cocker Spaniel" },
    ]
  },
  {
    firstName: "Amy", lastName: "Roberts", email: "amy.roberts@email.com", phone: "07700 100011",
    appointments: [
      { date: "2025-03-01", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 55, dogName: "Willow", dogBreed: "Border Collie", dogAge: "2 years" },
      { date: "2024-12-22", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 55, dogName: "Willow", dogBreed: "Border Collie" },
      { date: "2024-10-10", service: "Bath & Brush", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 35, dogName: "Willow", dogBreed: "Border Collie" },
    ]
  },
  {
    firstName: "Daniel", lastName: "Evans", email: "dan.evans@gmail.com", phone: "07700 100012",
    appointments: [
      { date: "2024-08-30", service: "Full Groom", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 60, dogName: "Archie", dogBreed: "Springer Spaniel", dogAge: "5 years" },
      { date: "2024-06-15", service: "Full Groom", groomer: "Emma", status: "Confirmed", payment: "Paid", amount: 60, dogName: "Archie", dogBreed: "Springer Spaniel" },
      { date: "2024-04-01", service: "Nail Trim", groomer: "Jade", status: "Confirmed", payment: "Paid", amount: 15, dogName: "Archie", dogBreed: "Springer Spaniel" },
    ]
  },
];

// Raw booking records for Tab 3
export type WixRawBooking = WixAppointment & { customerName: string; customerEmail: string; customerPhone: string; dogName: string; dogBreed: string; dogAge: string; message?: string };

export const WIX_RAW_BOOKINGS: WixRawBooking[] = (() => {
  const records: WixRawBooking[] = [];
  
  WIX_CUSTOMERS.forEach(c => {
    c.appointments.forEach(a => {
      records.push({
        ...a,
        customerName: `${c.firstName} ${c.lastName}`,
        customerEmail: c.email,
        customerPhone: c.phone,
        dogName: a.dogName || "",
        dogBreed: a.dogBreed || "",
        dogAge: a.dogAge || "",
      });
    });
  });
  // Sort newest first
  records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return records;
})();
