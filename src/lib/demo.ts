import type { StudioData, Appointment, Hours } from './types';
import { addDays, atTime, today } from './utils';
export const DEMO_KEY = 'Alongamentoscaratinga-demo-v1';
export const businessId = '00000000-0000-4000-8000-000000000001';
export const defaultHours: Hours = Object.fromEntries(
  Array.from({ length: 7 }, (_, i) => [
    String(i),
    { enabled: i !== 0, start: '09:00', end: '19:00', break_start: '12:00', break_end: '13:00' },
  ]),
);
const id = (group: number, n: number) =>
  `${String(group).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
export function createDemoData(): StudioData {
  const date = today();
  const professionals = [
    {
      id: id(1, 1),
      business_id: businessId,
      name: 'Marina',
      role: 'Nail designer',
      color: '#799780',
      commission: 0,
      active: true,
    },
    {
      id: id(1, 2),
      business_id: businessId,
      name: 'Júlia',
      role: 'Manicure e pedicure',
      color: '#b5a0bc',
      commission: 35,
      active: true,
    },
  ];
  const services = [
    {
      name: 'Alongamento em gel',
      category: 'Alongamento',
      duration: 120,
      price: 160,
      color: '#dbe9d8',
      description: 'Elegância e resistência com acabamento natural.',
    },
    {
      name: 'Manutenção em gel',
      category: 'Alongamento',
      duration: 90,
      price: 110,
      color: '#eee2cf',
      description: 'O cuidado que mantém suas unhas sempre lindas.',
    },
    {
      name: 'Esmaltação em gel',
      category: 'Esmaltação',
      duration: 60,
      price: 70,
      color: '#e8dfec',
      description: 'Brilho intenso e cor que acompanha sua rotina.',
    },
    {
      name: 'Manicure tradicional',
      category: 'Cuidados',
      duration: 45,
      price: 35,
      color: '#dce9e8',
      description: 'Cuidado completo para as suas mãos.',
    },
    {
      name: 'Pedicure + spa dos pés',
      category: 'Cuidados',
      duration: 60,
      price: 65,
      color: '#f3dfd6',
      description: 'Uma pausa de autocuidado para seus pés.',
    },
    {
      name: 'Nail art',
      category: 'Esmaltação',
      duration: 30,
      price: 30,
      color: '#e7e9cd',
      description: 'Pequenos detalhes, muita personalidade.',
    },
  ].map((s, i) => ({ ...s, id: id(2, i + 1), business_id: businessId, active: true }));
  const clients = [
    'Ana Clara Oliveira',
    'Beatriz Costa',
    'Camila Fernandes',
    'Larissa Almeida',
    'Sofia Martins',
    'Isabela Santos',
    'Fernanda Lima',
    'Luiza Ribeiro',
  ].map((name, i) => ({
    id: id(3, i + 1),
    business_id: businessId,
    name,
    phone: '',
    email: '',
    birthday: i === 3 ? `${date.slice(0, 4)}-${date.slice(5)}` : null,
    notes:
      i === 0
        ? 'Prefere tons nude e formato amendoado.'
        : i === 2
          ? 'Gosta de nail art delicada.'
          : '',
    created_at: `${addDays(date, -90 + i)}T12:00:00-03:00`,
  }));
  const appt = (
    n: number,
    day: string,
    time: string,
    client: number,
    service: number,
    pro = 0,
    status: Appointment['status'] = 'confirmed',
  ): Appointment => ({
    id: id(4, n),
    business_id: businessId,
    professional_id: professionals[pro].id,
    client_id: clients[client].id,
    service_id: services[service].id,
    starts_at: atTime(day, time),
    ends_at: new Date(
      new Date(atTime(day, time)).getTime() + services[service].duration * 60000,
    ).toISOString(),
    price: services[service].price,
    status,
    payment_status: status === 'completed' ? 'paid' : 'pending',
    payment_method: 'Pix',
    notes: '',
    kind: 'booking',
    source: n % 3 === 0 ? 'link' : 'panel',
    customer_package_id: null,
    reminder_sent_at: null,
  });
  const appointments = [
    appt(1, date, '09:00', 0, 0),
    appt(2, date, '11:00', 1, 2),
    appt(3, date, '13:30', 2, 1),
    appt(4, date, '15:30', 3, 0),
    appt(5, date, '10:00', 4, 3, 1),
    appt(6, date, '14:00', 5, 4, 1),
    appt(7, addDays(date, 1), '10:00', 6, 0),
    appt(8, addDays(date, 2), '14:00', 7, 2),
    ...Array.from({ length: 18 }, (_, i) =>
      appt(
        10 + i,
        addDays(date, -1 - i),
        i % 2 ? '09:00' : '14:00',
        i % 6,
        i % services.length,
        i % 2,
        'completed',
      ),
    ),
    appt(40, addDays(date, -42), '09:00', 6, 0, 0, 'completed'),
  ];
  return {
    business: {
      id: businessId,
      owner_id: '',
      name: 'AlongamentosCaratinga',
      slug: 'Alongamentoscaratinga',
      description:
        'Um momento só seu. Unhas feitas com carinho, cuidado em cada detalhe e a beleza de ser você.',
      phone: '',
      address: 'Caratinga, MG',
      instagram: 'Alongamentoscaratinga',
      hours: defaultHours,
      payment_methods: ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito'],
      booking_enabled: true,
      notice_hours: 2,
      reminder_hours: 24,
      cancellation_hours: 12,
      email_reminders: false,
    },
    professionals,
    services,
    clients,
    appointments,
    transactions: [
      {
        id: id(5, 1),
        business_id: businessId,
        type: 'expense',
        description: 'Reposição de esmaltes e gel',
        category: 'Materiais',
        amount: 185,
        date: addDays(date, -2),
        payment_method: 'Pix',
      },
      {
        id: id(5, 2),
        business_id: businessId,
        type: 'expense',
        description: 'Materiais descartáveis',
        category: 'Materiais',
        amount: 68.5,
        date: addDays(date, -5),
        payment_method: 'Pix',
      },
    ],
    packages: [
      {
        id: id(6, 1),
        business_id: businessId,
        name: 'Sempre impecável',
        service_id: services[2].id,
        sessions: 4,
        price: 240,
        validity_days: 60,
        active: true,
      },
    ],
    customer_packages: [
      {
        id: id(7, 1),
        business_id: businessId,
        client_id: clients[0].id,
        package_id: id(6, 1),
        sessions_used: 1,
        sessions_total: 4,
        price: 240,
        purchased_at: addDays(date, -7),
        expires_at: addDays(date, 53),
        paid: true,
      },
    ],
    gallery: [],
  };
}
export function emptyData(owner: string, idValue: string): StudioData {
  const demo = createDemoData();
  return {
    business: { ...demo.business, id: idValue, owner_id: owner },
    professionals: [],
    services: [],
    clients: [],
    appointments: [],
    transactions: [],
    packages: [],
    customer_packages: [],
    gallery: [],
  };
}
