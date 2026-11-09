import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, StatCard, Badge, EmptyState, money, formatDate } from '../components/ui';
import { downloadQuotePdf } from '../lib/quotePdf';
import type { Client, ClientAddress, CommercialStage, CompanySettings, Profile, Quote } from '../lib/types';

const STAGES: { key: CommercialStage; label: string }[] = [
  { key: 'prospeccao', label: 'Prospecção' },
  { key: 'proposta', label: 'Propostas' },
  { key: 'contrato', label: 'Contratos' },
  { key: 'cliente_spot', label: 'Clientes spot' },
  { key: 'ex_cliente', label: 'Ex-clientes' },
];

const QUOTE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  aguardando: 'warning',
  aprovado: 'success',
  nao_aprovado: 'danger',
  vencido: 'danger',
};

interface ItemForm {
  service_name: string;
  assistance_days: string;
  qty: string;
  unit_price: string;
}

const EMPTY_ITEM: ItemForm = { service_name: '', assistance_days: '', qty: '1', unit_price: '' };

const EMPTY_FORM = {
  client_id: '',
  number: '',
  city: '',
  state: '',
  validity_days: '60',
  nature_of_services: '',
  application_locations: '',
  application_notes: '',
  pests_combated: '',
  payment_terms: 'Após a execução do serviço.',
  observations: '',
  site_contact_name: '',
  site_contact_phone: '',
  responsible_profile_id: '',
};

export default function CRM() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState<ItemForm[]>([{ ...EMPTY_ITEM }]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [c, q, p] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('quotes').select('*, clients(name)').order('issue_date', { ascending: false }),
      supabase.from('profiles').select('*').order('full_name'),
    ]);
    setClients(c.data ?? []);
    setQuotes((q.data as any) ?? []);
    setProfiles(p.data ?? []);
    setLoading(false);
  }

  async function openNewQuote() {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .gte('issue_date', `${year}-01-01`)
      .lte('issue_date', `${year}-12-31`);
    setForm({
      ...EMPTY_FORM,
      number: `${year}-${(count ?? 0) + 1}`,
      responsible_profile_id: profile?.id || '',
    });
    setItems([{ ...EMPTY_ITEM }]);
    setShowModal(true);
  }

  function updateItem(index: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const itemsTotal = items.reduce((sum, it) => sum + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);

  async function saveQuote(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const issueDate = new Date();
    const validityDate = new Date(issueDate);
    validityDate.setDate(validityDate.getDate() + (Number(form.validity_days) || 60));

    const { data: inserted, error } = await supabase
      .from('quotes')
      .insert({
        client_id: form.client_id || null,
        number: form.number,
        city: form.city || null,
        state: form.state || null,
        validity_days: Number(form.validity_days) || 60,
        validity_date: validityDate.toISOString().slice(0, 10),
        nature_of_services: form.nature_of_services || null,
        application_locations: form.application_locations || null,
        application_notes: form.application_notes || null,
        pests_combated: form.pests_combated || null,
        payment_terms: form.payment_terms || null,
        observations: form.observations || null,
        site_contact_name: form.site_contact_name || null,
        site_contact_phone: form.site_contact_phone || null,
        responsible_profile_id: form.responsible_profile_id || null,
        value: itemsTotal,
      })
      .select('id')
      .single();

    if (!error && inserted) {
      const validItems = items.filter((it) => it.service_name.trim());
      if (validItems.length) {
        await supabase.from('quote_items').insert(
          validItems.map((it, i) => ({
            quote_id: inserted.id,
            position: i,
            service_name: it.service_name,
            assistance_days: it.assistance_days ? Number(it.assistance_days) : null,
            qty: Number(it.qty) || 1,
            unit_price: Number(it.unit_price) || 0,
          })),
        );
      }
    }

    setSaving(false);
    setShowModal(false);
    load();
  }

  async function handleGeneratePdf(quoteId: string) {
    setGeneratingId(quoteId);
    try {
      const [{ data: quote }, { data: quoteItems }, { data: company }] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).single(),
        supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('position'),
        supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      ]);
      if (!quote) return;

      let client: Client | null = null;
      let address: ClientAddress | null = null;
      let responsible: Profile | null = null;

      if (quote.client_id) {
        const { data: c } = await supabase.from('clients').select('*').eq('id', quote.client_id).single();
        client = c;
        const { data: a } = await supabase
          .from('client_addresses')
          .select('*')
          .eq('client_id', quote.client_id)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle();
        address = a;
      }
      if (quote.responsible_profile_id) {
        const { data: r } = await supabase.from('profiles').select('*').eq('id', quote.responsible_profile_id).single();
        responsible = r;
      }

      downloadQuotePdf({
        quote,
        items: quoteItems ?? [],
        client,
        address,
        company: (company as CompanySettings) ?? null,
        responsible,
      });
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div>
      <div className="section-row">
        <p className="content-subtitle" style={{ margin: 0 }}>
          Prospecção, propostas, contratos e relacionamento em uma única visão comercial.
        </p>
        <button className="btn btn-primary" onClick={openNewQuote}>
          + Registrar orçamento
        </button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {STAGES.map((s) => (
          <StatCard key={s.key} label={s.label} value={clients.filter((c) => c.commercial_stage === s.key).length} hint="Clientes nesta etapa" />
        ))}
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="modal-eyebrow">Desempenho comercial</div>
          <h3>Orçamentos e propostas</h3>
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : quotes.length === 0 ? (
          <EmptyState>Nenhum orçamento registrado ainda.</EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente / serviço</th>
                <th>Emissão</th>
                <th>Validade</th>
                <th>Valor</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => (
                <tr key={q.id}>
                  <td>{q.number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{q.clients?.name ?? '—'}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{q.nature_of_services || q.service_description || '—'}</div>
                  </td>
                  <td>{formatDate(q.issue_date)}</td>
                  <td>{formatDate(q.validity_date)}</td>
                  <td>{money(q.value)}</td>
                  <td>
                    <Badge tone={QUOTE_TONE[q.status]}>{q.status.replace('_', ' ')}</Badge>
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={generatingId === q.id} onClick={() => handleGeneratePdf(q.id)}>
                      {generatingId === q.id ? 'Gerando…' : 'Baixar PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <Modal
          wide
          eyebrow="Controle comercial"
          title="Registrar orçamento"
          description="Preencha os dados da proposta comercial. Depois de salvar, use “Baixar PDF” para gerar o documento no modelo oficial da Kioshi."
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="quote-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar orçamento'}
              </button>
            </>
          }
        >
          <form id="quote-form" onSubmit={saveQuote}>
            <div className="field-row">
              <div className="field">
                <label>Número do orçamento</label>
                <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </div>
              <div className="field">
                <label>Cliente</label>
                <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-row" style={{ gridTemplateColumns: '1fr 70px 110px' }}>
              <div className="field">
                <label>Cidade</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="field">
                <label>UF</label>
                <input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
              </div>
              <div className="field">
                <label>Validade (dias)</label>
                <input type="number" min={1} value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <label>Natureza dos serviços</label>
              <textarea rows={2} placeholder="Ex.: Dedetização e descupinização preventiva" value={form.nature_of_services} onChange={(e) => setForm({ ...form, nature_of_services: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Locais de aplicação</label>
                <textarea rows={2} value={form.application_locations} onChange={(e) => setForm({ ...form, application_locations: e.target.value })} />
              </div>
              <div className="field">
                <label>Observações sobre a assistência</label>
                <textarea rows={2} value={form.application_notes} onChange={(e) => setForm({ ...form, application_notes: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Pragas combatidas</label>
              <input value={form.pests_combated} onChange={(e) => setForm({ ...form, pests_combated: e.target.value })} />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Contato no local</label>
                <input value={form.site_contact_name} onChange={(e) => setForm({ ...form, site_contact_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Telefone do contato no local</label>
                <input value={form.site_contact_phone} onChange={(e) => setForm({ ...form, site_contact_phone: e.target.value })} />
              </div>
            </div>

            <div className="field" style={{ margin: '14px 0 6px' }}>
              <label>Serviços e valores</label>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 70px 110px auto', gap: 8, alignItems: 'center' }}>
                  <input placeholder="Serviço" value={it.service_name} onChange={(e) => updateItem(i, { service_name: e.target.value })} />
                  <input type="number" placeholder="Assistência (dias)" title="Assistência (dias)" value={it.assistance_days} onChange={(e) => updateItem(i, { assistance_days: e.target.value })} />
                  <input type="number" min={1} placeholder="Qtd." value={it.qty} onChange={(e) => updateItem(i, { qty: e.target.value })} />
                  <input type="number" step="0.01" placeholder="Unitário (R$)" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} />
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px 10px' }} onClick={() => removeItem(i)} disabled={items.length === 1}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={addItem}>
              + Adicionar serviço
            </button>
            <div style={{ textAlign: 'right', marginTop: 10, fontWeight: 700, color: 'var(--brand)' }}>
              Total do orçamento: {money(itemsTotal)}
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Condições de pagamento</label>
              <input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
            </div>
            <div className="field">
              <label>Responsável pela proposta</label>
              <select value={form.responsible_profile_id} onChange={(e) => setForm({ ...form, responsible_profile_id: e.target.value })}>
                <option value="">Selecione</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
