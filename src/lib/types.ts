export type Hours = Record<
  string,
  { enabled: boolean; start: string; end: string; break_start: string; break_end: string }
>;
export type Business = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  phone: string;
  address: string;
  instagram: string;
  hours: Hours;
  payment_methods: string[];
  booking_enabled: boolean;
  notice_hours: number;
  reminder_hours: number;
  cancellation_hours: number;
  email_reminders: boolean;
};
export type Professional = {
  id: string;
  business_id: string;
  name: string;
  role: string;
  color: string;
  commission: number;
  active: boolean;
};
export type Service = {
  id: string;
  business_id: string;
  name: string;
  category: string;
  description: string;
  duration: number;
  price: number;
  color: string;
  active: boolean;
  photo_url?: string;
};
export type Client = {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string | null;
  notes: string;
  created_at: string;
};
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type Appointment = {
  id: string;
  business_id: string;
  professional_id: string;
  client_id: string | null;
  service_id: string | null;
  starts_at: string;
  ends_at: string;
  price: number;
  status: AppointmentStatus;
  payment_status: 'pending' | 'paid';
  payment_method: string;
  notes: string;
  kind: 'booking' | 'block';
  source: 'panel' | 'link';
  customer_package_id: string | null;
  reminder_sent_at: string | null;
};
export type Transaction = {
  id: string;
  business_id: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  amount: number;
  date: string;
  payment_method: string;
};
export type Package = {
  id: string;
  business_id: string;
  name: string;
  service_id: string;
  sessions: number;
  price: number;
  validity_days: number;
  active: boolean;
};
export type CustomerPackage = {
  id: string;
  business_id: string;
  client_id: string;
  package_id: string;
  sessions_used: number;
  sessions_total: number;
  price: number;
  purchased_at: string;
  expires_at: string;
  paid: boolean;
};
export type GalleryImage = { id: string; business_id: string; url: string; caption: string };
export type TableMap = {
  professionals: Professional;
  services: Service;
  clients: Client;
  appointments: Appointment;
  transactions: Transaction;
  packages: Package;
  customer_packages: CustomerPackage;
  gallery: GalleryImage;
};
export type TableName = keyof TableMap;
export type StudioData = { business: Business } & { [K in TableName]: TableMap[K][] };
export type PublicStudio = {
  business: Omit<Business, 'owner_id' | 'email_reminders'>;
  services: Service[];
  professionals: Professional[];
  gallery: GalleryImage[];
};
