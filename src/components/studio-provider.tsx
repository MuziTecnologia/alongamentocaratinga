'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createDemoData, DEMO_KEY } from '@/lib/demo';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Business, StudioData, TableMap, TableName } from '@/lib/types';
import { validateAppointment } from '@/lib/domain';
type ContextValue = {
  data: StudioData;
  ready: boolean;
  demo: boolean;
  error: string;
  busy: boolean;
  toast: string;
  save: <K extends TableName>(table: K, value: TableMap[K]) => Promise<boolean>;
  saveMany: <K extends TableName>(table: K, values: TableMap[K][]) => Promise<boolean>;
  remove: (table: TableName, id: string) => Promise<boolean>;
  saveBusiness: (business: Business) => Promise<boolean>;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  resetDemo: () => void;
};
const Context = createContext<ContextValue | null>(null);
const tables: TableName[] = [
  'professionals',
  'services',
  'clients',
  'appointments',
  'transactions',
  'packages',
  'customer_packages',
  'gallery',
];
function humanError(error: unknown): string {
  const err = error as { message?: string; code?: string };
  if (err?.code === '23P01') return 'Esse horário acabou de ser ocupado. Escolha outro horário.';
  if (err?.code === '23503')
    return 'Este registro possui histórico vinculado. Desative-o para preservar os atendimentos.';
  if (err?.code === '23505') return 'Já existe um registro com esses dados.';
  if (err?.code === 'PGRST204' && err.message?.includes('photo_url'))
    return 'O banco precisa da atualização das fotos. Execute supabase/migrations/002_service_photos.sql no SQL Editor.';
  if (err?.code === 'PGRST205' || err?.code === '42883')
    return 'Banco ainda não preparado. Execute a migration Supabase indicada no README.';
  return err?.message || 'Não foi possível salvar. Tente novamente.';
}
export function StudioProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StudioData>(createDemoData);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState('');
  const dataRef = useRef(data),
    saving = useRef(false);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  const replace = useCallback((value: StudioData) => {
    dataRef.current = value;
    setData(value);
  }, []);
  const persist = useCallback(
    (value: StudioData) => {
      localStorage.setItem(DEMO_KEY, JSON.stringify(value));
      replace(value);
    },
    [replace],
  );
  const refresh = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setReady(true);
      return;
    }
    const { data: businessId, error: initError } = await supabase.rpc('bootstrap_studio');
    if (initError) throw initError;
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    if (businessError) throw businessError;
    const results = await Promise.all(
      tables.map((table) =>
        supabase.from(table).select('*').eq('business_id', businessId).order('id'),
      ),
    );
    for (const result of results) if (result.error) throw result.error;
    const next = {
      business,
      ...Object.fromEntries(tables.map((table, i) => [table, results[i].data || []])),
    } as StudioData;
    replace(next);
    setError('');
    setReady(true);
  }, [replace]);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      try {
        const saved = localStorage.getItem(DEMO_KEY);
        if (saved) {
          const value = JSON.parse(saved);
          if (!value.business || !Array.isArray(value.appointments)) throw new Error();
          replace(value);
        }
      } catch {
        setError(
          'Os dados de demonstração estavam inválidos. Uma nova demonstração foi carregada.',
        );
      }
      setReady(true);
      const sync = (event: StorageEvent) => {
        if (event.key === DEMO_KEY && event.newValue) {
          try {
            replace(JSON.parse(event.newValue));
          } catch {
            /* Ignore malformed cross-tab data. */
          }
        }
      };
      window.addEventListener('storage', sync);
      return () => window.removeEventListener('storage', sync);
    }
    let active = true;
    const loadingTimeout = setTimeout(() => {
      if (active) {
        setError(
          'A conexão com o Supabase demorou mais que o esperado. Confira sua conexão e tente novamente.',
        );
        setReady(true);
      }
    }, 15000);
    refresh()
      .catch((err) => {
        if (active) {
          setError(humanError(err));
          setReady(true);
        }
      })
      .finally(() => clearTimeout(loadingTimeout));
    const supabase = getSupabase()!;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_OUT' &&
        (location.pathname === '/' || location.pathname.startsWith('/painel'))
      )
        location.assign('/entrar');
    });
    return () => {
      active = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [refresh, replace]);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !data.business.owner_id) return;
    const channel = supabase
      .channel(`studio-${data.business.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `business_id=eq.${data.business.id}`,
        },
        () => {
          refresh().catch(() => undefined);
        },
      )
      .subscribe();
    const onFocus = () => refresh().catch(() => undefined);
    window.addEventListener('focus', onFocus);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [data.business.id, data.business.owner_id, refresh]);
  async function mutation(operation: () => Promise<void>) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      await operation();
      notify('Tudo salvo com carinho.');
      return true;
    } catch (err) {
      notify(humanError(err));
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function saveMany<K extends TableName>(table: K, values: TableMap[K][]) {
    return mutation(async () => {
      let next = structuredClone(dataRef.current);
      for (const value of values) {
        if (value.business_id !== next.business.id) throw new Error('Negócio inválido.');
        if (table === 'appointments') {
          const appointment = value as TableMap['appointments'];
          validateAppointment(next, appointment);
          const old = next.appointments.find((a) => a.id === appointment.id);
          if (old && old.starts_at !== appointment.starts_at) appointment.reminder_sent_at = null;
          if (old?.customer_package_id && old.status === 'completed') {
            const p = next.customer_packages.find((p) => p.id === old.customer_package_id);
            if (p) p.sessions_used = Math.max(0, p.sessions_used - 1);
          }
          if (appointment.customer_package_id && appointment.status === 'completed') {
            const p = next.customer_packages.find((p) => p.id === appointment.customer_package_id);
            if (p) p.sessions_used++;
          }
        }
        (next[table] as TableMap[K][]) = [
          ...(next[table] as TableMap[K][]).filter((row) => row.id !== value.id),
          value,
        ];
      }
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from(table).upsert(values);
        if (error) throw error;
        await refresh();
      } else persist(next);
    });
  }
  async function remove(table: TableName, id: string) {
    return mutation(async () => {
      const next = structuredClone(dataRef.current);
      const inUse =
        table === 'clients'
          ? next.appointments.some((a) => a.client_id === id) ||
            next.customer_packages.some((p) => p.client_id === id)
          : table === 'services'
            ? next.appointments.some((a) => a.service_id === id) ||
              next.packages.some((p) => p.service_id === id)
            : table === 'professionals'
              ? next.appointments.some((a) => a.professional_id === id)
              : table === 'packages'
                ? next.customer_packages.some((p) => p.package_id === id)
                : false;
      if (inUse)
        throw new Error(
          'Este registro possui histórico. Edite ou desative para preservar os atendimentos.',
        );
      if (table === 'appointments') {
        const old = next.appointments.find((a) => a.id === id);
        if (old?.customer_package_id && old.status === 'completed') {
          const pack = next.customer_packages.find((p) => p.id === old.customer_package_id);
          if (pack) pack.sessions_used = Math.max(0, pack.sessions_used - 1);
        }
      }
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
        await refresh();
      } else {
        (next[table] as { id: string }[]) = next[table].filter((row) => row.id !== id);
        persist(next);
      }
    });
  }
  async function saveBusiness(business: Business) {
    return mutation(async () => {
      const supabase = getSupabase();
      if (supabase) {
        const { error } = await supabase.from('businesses').update(business).eq('id', business.id);
        if (error) throw error;
        await refresh();
      } else persist({ ...dataRef.current, business });
    });
  }
  const resetDemo = () => {
    if (!isSupabaseConfigured) {
      persist(createDemoData());
      notify('Demonstração restaurada.');
    }
  };
  return (
    <Context.Provider
      value={{
        data,
        ready,
        demo: !isSupabaseConfigured,
        error,
        busy,
        toast,
        save: (table, value) => saveMany(table, [value]),
        saveMany,
        remove,
        saveBusiness,
        notify,
        refresh,
        resetDemo,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-dot" />
          {toast}
          <button aria-label="Fechar aviso" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useStudio() {
  const value = useContext(Context);
  if (!value) throw new Error('StudioProvider ausente.');
  return value;
}
