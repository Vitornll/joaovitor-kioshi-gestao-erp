import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, formatDate, formatDateTime, money } from '../components/ui';
import ScheduleModal from '../components/ScheduleModal';
import { downloadQuotePdf } from '../lib/quotePdf';
import type { Client, ClientAddress, Contract, Quote, ServiceOrder, ServiceType } from '../lib/types';

type ClientWithExtras = Client & { client_addresses: ClientAddress[]; contracts: Contract[] };

const STAGE_LABEL: Record<string, string> = {
  prospeccao: 'Prospecção',
  proposta: 'Proposta',
  contrato: 'Contrato',
  cliente_spot: 'Cliente spot',
  ex_cliente: 'Ex-cliente',
};

const QUOTE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  aguardando: 'warning',
  aprovado: 'success',
  nao_aprovado: 'danger',
  vencido: 'danger',
};

const ORDER_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pendente: 'warning',
  confirmado: 'info',
  em_rota: 'info',
  em_execucao: 'info',
  concluido: 'success',
  cancelado: 'danger',
};

const emptyAddress = (): Partial<ClientAddress> => ({
  label: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip: '',
  reference: '',
});

export default function Clientes() {
  const [clients, setClients] = useState<ClientWithExtras[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [visitCount, setVisitCount] = useState(0);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState<ClientWithExtras | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    kind: 'pessoa_fisica' as Client['kind'],
    name: '',
    cpf: '',
    cnpj: '',
    contact_name: '',
    phone: '',
    email: '',
    commercial_stage: 'prospeccao' as Client['commercial_stage'],
    notes: '',
  });
  const [addresses, setAddresses] = useState<Partial<ClientAddress>[]>([emptyAddress()]);

  const [contractForm, setContractForm] = useState({
    service_type_id: '',
    recurrence: 'mensal' as Contract['recurrence'],
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    value: '',
    notes: '',
  });

  // --- Painel de detalhe / edição do cliente -----------------------------
  const [detail, setDetail] = useState<ClientWithExtras | null>(null);
  const [detailForm, setDetailForm] = useState(form);
  const [detailAddresses, setDetailAddresses] = useState<Partial<ClientAddress>[]>([]);
  const [removedAddressIds, setRemovedAddressIds] = useState<string[]>([]);
  const [savingDetail, setSavingDetail] = useState(false);
  const [detailQuotes, setDetailQuotes] = useState<Quote[]>([]);
  const [detailOrders, setDetailOrders] = useState<ServiceOrder[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [scheduleForClient, setScheduleForClient] = useState<ClientWithExtras | null>(null);
  const [viewOrder, setViewOrder] = useState<ServiceOrder | null>(null);
  const [viewPhotoUrls, setViewPhotoUrls] = useState<string[]>([]);
  const [generatingQuoteId, setGeneratingQuoteId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [clientsRes, typesRes, visitsRes] = await Promise.all([
      supabase.from('clients').select('*, client_addresses(*), contracts(*)').order('created_at', { ascending: false }),
      supabase.from('service_types').select('*').eq('active', true).order('name'),
      supabase.from('service_orders').select('id', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()),
    ]);
    setClients((clientsRes.data as ClientWithExtras[]) ?? []);
    setServiceTypes(typesRes.data ?? []);
    setVisitCount(visitsRes.count ?? 0);
    setLoading(false);
  }

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.cpf ?? '').includes(q) ||
      (c.cnpj ?? '').includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.contact_name ?? '').toLowerCase().includes(q)
    );
  });

  function resetForm() {
    setForm({
      kind: 'pessoa_fisica',
      name: '',
      cpf: '',
      cnpj: '',
      contact_name: '',
      phone: '',
      email: '',
      commercial_stage: 'prospeccao',
      notes: '',
    });
    setAddresses([emptyAddress()]);
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        kind: form.kind,
        name: form.name,
        cpf: form.cpf || null,
        cnpj: form.cnpj || null,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        email: form.email || null,
        commercial_stage: form.commercial_stage,
        notes: form.notes || null,
      })
      .select()
      .single();

    if (!error && client) {
      const validAddresses = addresses.filter((a) => a.street || a.neighborhood || a.city);
      if (validAddresses.length) {
        await supabase.from('client_addresses').insert(
          validAddresses.map((a, idx) => ({ ...a, client_id: client.id, is_primary: idx === 0 }))
        );
      }
      resetForm();
      setShowClientModal(false);
      load();
    }
    setSaving(false);
  }

  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    if (!showContractModal) return;
    setSaving(true);
    await supabase.from('contracts').insert({
      client_id: showContractModal.id,
      service_type_id: contractForm.service_type_id || null,
      recurrence: contractForm.recurrence,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date || null,
      value: contractForm.value ? Number(contractForm.value) : null,
      notes: contractForm.notes || null,
    });
    await supabase.from('clients').update({ commercial_stage: 'contrato' }).eq('id', showContractModal.id);
    setShowContractModal(null);
    setSaving(false);
    load();
  }

  // --- Abrir / editar cadastro --------------------------------------------
  async function openDetail(c: ClientWithExtras) {
    setDetail(c);
    setDetailForm({
      kind: c.kind,
      name: c.name,
      cpf: c.cpf ?? '',
      cnpj: c.cnpj ?? '',
      contact_name: c.contact_name ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      commercial_stage: c.commercial_stage,
      notes: c.notes ?? '',
    });
    setDetailAddresses(c.client_addresses.length ? c.client_addresses.map((a) => ({ ...a })) : [emptyAddress()]);
    setRemovedAddressIds([]);
    setLoadingDetail(true);
    const [{ data: quotes }, { data: orders }] = await Promise.all([
      supabase.from('quotes').select('*').eq('client_id', c.id).order('issue_date', { ascending: false }),
      supabase
        .from('service_orders')
        .select('*, service_types(*), client_addresses(*), service_order_execution(*)')
        .eq('client_id', c.id)
        .order('scheduled_at', { ascending: false }),
    ]);
    setDetailQuotes(quotes ?? []);
    setDetailOrders((orders as ServiceOrder[]) ?? []);
    setLoadingDetail(false);
  }

  function closeDetail() {
    setDetail(null);
    setDetailQuotes([]);
    setDetailOrders([]);
  }

  async function saveDetail(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setSavingDetail(true);

    await supabase
      .from('clients')
      .update({
        kind: detailForm.kind,
        name: detailForm.name,
        cpf: detailForm.cpf || null,
        cnpj: detailForm.cnpj || null,
        contact_name: detailForm.contact_name || null,
        phone: detailForm.phone || null,
        email: detailForm.email || null,
        commercial_stage: detailForm.commercial_stage,
        notes: detailForm.notes || null,
      })
      .eq('id', detail.id);

    if (removedAddressIds.length) {
      await supabase.from('client_addresses').delete().in('id', removedAddressIds);
    }
    for (let idx = 0; idx < detailAddresses.length; idx++) {
      const a = detailAddresses[idx];
      if (!a.street && !a.neighborhood && !a.city && !a.label) continue;
      if (a.id) {
        await supabase
          .from('client_addresses')
          .update({
            label: a.label || null,
            street: a.street || null,
            number: a.number || null,
            complement: a.complement || null,
            neighborhood: a.neighborhood || null,
            city: a.city || null,
            state: a.state || null,
            zip: a.zip || null,
            reference: a.reference || null,
          })
          .eq('id', a.id);
      } else {
        await supabase.from('client_addresses').insert({ ...a, client_id: detail.id, is_primary: idx === 0 });
      }
    }

    setSavingDetail(false);
    closeDetail();
    load();
  }

  async function handleGenerateQuotePdf(quoteId: string) {
    setGeneratingQuoteId(quoteId);
    try {
      const [{ data: quote }, { data: quoteItems }, { data: company }] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).single(),
        supabase.from('quote_items').select('*').eq('quote_id', quoteId).order('position'),
        supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      ]);
      if (!quote) return;
      const { data: address } = detail
        ? await supabase.from('client_addresses').select('*').eq('client_id', detail.id).order('is_primary', { ascending: false }).limit(1).maybeSingle()
        : { data: null };
      let responsible = null;
      if (quote.responsible_profile_id) {
        const { data: r } = await supabase.from('profiles').select('*').eq('id', quote.responsible_profile_id).single();
        responsible = r;
      }
      downloadQuotePdf({ quote, items: quoteItems ?? [], client: detail, address: address ?? null, company: company ?? null, responsible });
    } finally {
      setGeneratingQuoteId(null);
    }
  }

  async function openExecution(order: ServiceOrder) {
    setViewOrder(order);
    const exec = Array.isArray(order.service_order_execution) ? order.service_order_execution[0] : order.service_order_execution;
    const photos = exec?.photos ?? [];
    if (photos.length) {
      const urls = await Promise.all(
        photos.map(async (path) => {
          const { data } = await supabase.storage.from('photos').createSignedUrl(path, 3600);
          return data?.signedUrl ?? '';
        })
      );
      setViewPhotoUrls(urls.filter(Boolean));
    } else {
      setViewPhotoUrls([]);
    }
  }

  return (
    <div>
      <div className="section-row">
        <div>
          <p className="content-subtitle" style={{ marginBottom: 0 }}>
            Centralize dados, documentos de identificação e as visitas previstas em contrato.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => setShowContractModal(clients[0] ?? null)} disabled={!clients.length}>
            + Novo contrato
          </button>
          <button className="btn btn-primary" onClick={() => setShowClientModal(true)}>
            + Cadastrar cliente
          </button>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Clientes cadastrados" value={clients.length} hint="Pessoas físicas e empresas" accent="brand" />
        <StatCard label="Contratos cadastrados" value={clients.reduce((s, c) => s + c.contracts.length, 0)} hint="Vinculados aos clientes" />
        <StatCard label="Visitas programadas" value={visitCount} hint="Datas futuras na agenda" />
      </div>

      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="modal-eyebrow">Base de clientes</div>
            <h3>Clientes e contratos</h3>
          </div>
          <input style={{ maxWidth: 280 }} placeholder="Nome, CPF, CNPJ, contato ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <EmptyState>Carregando…</EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState>Nenhum cliente cadastrado ainda.</EmptyState>
        ) : (
          <div>
            {filtered.map((c) => (
              <div key={c.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <div className="sidebar-avatar" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                      {c.contracts.length > 0 && <Badge tone="success">Contrato</Badge>}
                      <span style={{ fontWeight: 700 }}>{c.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.kind === 'pessoa_fisica' ? 'Pessoa física' : 'Pessoa jurídica'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {c.cpf || c.cnpj || '—'} · {c.contact_name || 'sem contato'} · {c.phone || 'sem telefone'}
                    </div>
                    {c.client_addresses[0] && (
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                        {[c.client_addresses[0].street, c.client_addresses[0].neighborhood, c.client_addresses[0].city].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Badge tone="info">{STAGE_LABEL[c.commercial_stage]}</Badge>
                  <button className="btn btn-secondary btn-sm" onClick={() => openDetail(c)}>
                    Abrir cadastro
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showClientModal && (
        <Modal
          eyebrow="Cadastro"
          title="Cadastrar cliente"
          description="Informe o nome completo ou razão social. Cadastre os endereços de atendimento do cliente."
          onClose={() => setShowClientModal(false)}
          wide
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowClientModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="client-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar cliente'}
              </button>
            </>
          }
        >
          <form id="client-form" onSubmit={saveClient}>
            <div className="field-row">
              <div className="field">
                <label>Etapa comercial</label>
                <select value={form.commercial_stage} onChange={(e) => setForm({ ...form, commercial_stage: e.target.value as Client['commercial_stage'] })}>
                  {Object.entries(STAGE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tipo de cadastro</label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Client['kind'] })}>
                  <option value="pessoa_fisica">Pessoa física</option>
                  <option value="pessoa_juridica">Pessoa jurídica</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Nome completo ou razão social</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>CPF</label>
                <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
              <div className="field">
                <label>CNPJ</label>
                <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Contato responsável</label>
                <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Telefone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 6 }}>
              <div className="section-row">
                <strong style={{ fontSize: 14 }}>Endereços do cliente</strong>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddresses([...addresses, emptyAddress()])}>
                  + Endereço
                </button>
              </div>
              {addresses.map((addr, idx) => (
                <div key={idx} className="card" style={{ padding: 14, marginBottom: 10 }}>
                  <div className="field-row">
                    <div className="field">
                      <label>Identificação</label>
                      <input
                        placeholder="Ex.: Matriz, residência"
                        value={addr.label ?? ''}
                        onChange={(e) => setAddresses(addresses.map((a, i) => (i === idx ? { ...a, label: e.target.value } : a)))}
                      />
                    </div>
                    <div className="field">
                      <label>Rua / avenida</label>
                      <input
                        value={addr.street ?? ''}
                        onChange={(e) => setAddresses(addresses.map((a, i) => (i === idx ? { ...a, street: e.target.value } : a)))}
                      />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Bairro</label>
                      <input
                        value={addr.neighborhood ?? ''}
                        onChange={(e) => setAddresses(addresses.map((a, i) => (i === idx ? { ...a, neighborhood: e.target.value } : a)))}
                      />
                    </div>
                    <div className="field">
                      <label>Cidade / UF</label>
                      <input
                        placeholder="Cidade - UF"
                        value={addr.city ?? ''}
                        onChange={(e) => setAddresses(addresses.map((a, i) => (i === idx ? { ...a, city: e.target.value } : a)))}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Referência</label>
                    <input
                      value={addr.reference ?? ''}
                      onChange={(e) => setAddresses(addresses.map((a, i) => (i === idx ? { ...a, reference: e.target.value } : a)))}
                    />
                  </div>
                </div>
              ))}
            </div>
          </form>
        </Modal>
      )}

      {showContractModal && (
        <Modal
          eyebrow="Controle comercial"
          title="Novo contrato"
          onClose={() => setShowContractModal(null)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowContractModal(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" form="contract-form" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar contrato'}
              </button>
            </>
          }
        >
          <form id="contract-form" onSubmit={saveContract}>
            <div className="field">
              <label>Cliente</label>
              <select value={showContractModal.id} onChange={(e) => setShowContractModal(clients.find((c) => c.id === e.target.value) ?? null)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Serviço contratado</label>
                <select value={contractForm.service_type_id} onChange={(e) => setContractForm({ ...contractForm, service_type_id: e.target.value })}>
                  <option value="">Selecione</option>
                  {serviceTypes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Recorrência</label>
                <select value={contractForm.recurrence} onChange={(e) => setContractForm({ ...contractForm, recurrence: e.target.value as Contract['recurrence'] })}>
                  <option value="avulso">Avulso</option>
                  <option value="mensal">Mensal</option>
                  <option value="bimestral">Bimestral</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Início</label>
                <input type="date" value={contractForm.start_date} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} />
              </div>
              <div className="field">
                <label>Término (opcional)</label>
                <input type="date" value={contractForm.end_date} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Valor (R$)</label>
              <input type="number" step="0.01" value={contractForm.value} onChange={(e) => setContractForm({ ...contractForm, value: e.target.value })} />
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={2} value={contractForm.notes} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal
          eyebrow={detail.kind === 'pessoa_fisica' ? 'Pessoa física' : 'Pessoa jurídica'}
          title={detail.name}
          onClose={closeDetail}
          wide
          footer={
            <>
              <button className="btn btn-secondary" onClick={closeDetail}>
                Fechar
              </button>
              <button className="btn btn-primary" form="detail-form" disabled={savingDetail}>
                {savingDetail ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </>
          }
        >
          <form id="detail-form" onSubmit={saveDetail}>
            <div className="field-row">
              <div className="field">
                <label>Etapa comercial</label>
                <select value={detailForm.commercial_stage} onChange={(e) => setDetailForm({ ...detailForm, commercial_stage: e.target.value as Client['commercial_stage'] })}>
                  {Object.entries(STAGE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tipo de cadastro</label>
                <select value={detailForm.kind} onChange={(e) => setDetailForm({ ...detailForm, kind: e.target.value as Client['kind'] })}>
                  <option value="pessoa_fisica">Pessoa física</option>
                  <option value="pessoa_juridica">Pessoa jurídica</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Nome completo ou razão social</label>
              <input required value={detailForm.name} onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })} />
            </div>
            <div className="field-row">
              <div className="field">
                <label>CPF</label>
                <input value={detailForm.cpf} onChange={(e) => setDetailForm({ ...detailForm, cpf: e.target.value })} />
              </div>
              <div className="field">
                <label>CNPJ</label>
                <input value={detailForm.cnpj} onChange={(e) => setDetailForm({ ...detailForm, cnpj: e.target.value })} />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Contato responsável</label>
                <input value={detailForm.contact_name} onChange={(e) => setDetailForm({ ...detailForm, contact_name: e.target.value })} />
              </div>
              <div className="field">
                <label>Telefone</label>
                <input value={detailForm.phone} onChange={(e) => setDetailForm({ ...detailForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>E-mail</label>
              <input type="email" value={detailForm.email} onChange={(e) => setDetailForm({ ...detailForm, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Observações</label>
              <textarea rows={2} value={detailForm.notes} onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })} />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 6 }}>
              <div className="section-row">
                <strong style={{ fontSize: 14 }}>Endereços</strong>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetailAddresses([...detailAddresses, emptyAddress()])}>
                  + Endereço
                </button>
              </div>
              {detailAddresses.map((addr, idx) => (
                <div key={addr.id ?? idx} className="card" style={{ padding: 14, marginBottom: 10 }}>
                  <div className="field-row">
                    <div className="field">
                      <label>Identificação</label>
                      <input
                        placeholder="Ex.: Matriz, residência"
                        value={addr.label ?? ''}
                        onChange={(e) => setDetailAddresses(detailAddresses.map((a, i) => (i === idx ? { ...a, label: e.target.value } : a)))}
                      />
                    </div>
                    <div className="field">
                      <label>Rua / avenida</label>
                      <input value={addr.street ?? ''} onChange={(e) => setDetailAddresses(detailAddresses.map((a, i) => (i === idx ? { ...a, street: e.target.value } : a)))} />
                    </div>
                  </div>
                  <div className="field-row">
                    <div className="field">
                      <label>Bairro</label>
                      <input value={addr.neighborhood ?? ''} onChange={(e) => setDetailAddresses(detailAddresses.map((a, i) => (i === idx ? { ...a, neighborhood: e.target.value } : a)))} />
                    </div>
                    <div className="field">
                      <label>Cidade / UF</label>
                      <input
                        placeholder="Cidade - UF"
                        value={addr.city ?? ''}
                        onChange={(e) => setDetailAddresses(detailAddresses.map((a, i) => (i === idx ? { ...a, city: e.target.value } : a)))}
                      />
                    </div>
                  </div>
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label>Referência</label>
                    <input value={addr.reference ?? ''} onChange={(e) => setDetailAddresses(detailAddresses.map((a, i) => (i === idx ? { ...a, reference: e.target.value } : a)))} />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (addr.id) setRemovedAddressIds((prev) => [...prev, addr.id as string]);
                      setDetailAddresses(detailAddresses.filter((_, i) => i !== idx));
                    }}
                  >
                    Remover endereço
                  </button>
                </div>
              ))}
            </div>
          </form>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 16 }}>
            <div className="section-row">
              <strong style={{ fontSize: 14 }}>Orçamentos</strong>
            </div>
            {loadingDetail ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</p>
            ) : detailQuotes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum orçamento para este cliente.</p>
            ) : (
              detailQuotes.map((q) => (
                <div key={q.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>Orçamento {q.number}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {formatDate(q.issue_date)} · {money(q.value)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge tone={QUOTE_TONE[q.status]}>{q.status.replace('_', ' ')}</Badge>
                    <button className="btn btn-secondary btn-sm" disabled={generatingQuoteId === q.id} onClick={() => handleGenerateQuotePdf(q.id)}>
                      {generatingQuoteId === q.id ? 'Gerando…' : 'PDF'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
            <div className="section-row">
              <strong style={{ fontSize: 14 }}>Agendamentos e histórico de serviços</strong>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScheduleForClient(detail)}>
                + Novo agendamento
              </button>
            </div>
            {loadingDetail ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando…</p>
            ) : detailOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum agendamento para este cliente ainda.</p>
            ) : (
              detailOrders.map((o) => (
                <div key={o.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{formatDateTime(o.scheduled_at)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {o.service_types?.name || 'Serviço'} {o.quote_id && '· originado de orçamento'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Badge tone={ORDER_TONE[o.status]}>{o.status.replace('_', ' ')}</Badge>
                    {o.status === 'concluido' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => openExecution(o)}>
                        Ver execução
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {scheduleForClient && (
        <ScheduleModal
          initialClientId={scheduleForClient.id}
          lockClient
          onClose={() => setScheduleForClient(null)}
          onSaved={() => {
            setScheduleForClient(null);
            if (detail) openDetail(detail);
            load();
          }}
        />
      )}

      {viewOrder && (
        <Modal
          eyebrow="Histórico de atendimento"
          title={formatDateTime(viewOrder.scheduled_at)}
          onClose={() => setViewOrder(null)}
          footer={
            <button className="btn btn-secondary" onClick={() => setViewOrder(null)}>
              Fechar
            </button>
          }
        >
          {(() => {
            const exec = Array.isArray(viewOrder.service_order_execution) ? viewOrder.service_order_execution[0] : viewOrder.service_order_execution;
            if (!exec) return <p style={{ color: 'var(--text-muted)' }}>Sem registro de execução.</p>;
            const minutes = exec.checked_in_at && exec.checked_out_at ? Math.round((new Date(exec.checked_out_at).getTime() - new Date(exec.checked_in_at).getTime()) / 60000) : null;
            return (
              <div>
                <div className="field-row">
                  <div>
                    <label>Tempo de serviço</label>
                    <p style={{ margin: 0 }}>{minutes != null ? `${minutes} min` : '—'}</p>
                  </div>
                  <div>
                    <label>EPIs confirmados</label>
                    <p style={{ margin: 0 }}>{exec.ppe_confirmed ? 'Sim' : 'Não informado'}</p>
                  </div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <label>Produtos utilizados</label>
                  {!exec.products_used?.length ? (
                    <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nenhum produto registrado.</p>
                  ) : (
                    exec.products_used.map((p, i) => (
                      <div key={i} style={{ fontSize: 13.5 }}>
                        {p.product_name} — {p.qty} {p.unit}
                      </div>
                    ))
                  )}
                </div>
                <div style={{ marginTop: 14 }}>
                  <label>Comentários do técnico</label>
                  <p style={{ margin: 0 }}>{exec.execution_notes || '—'}</p>
                </div>
                {viewPhotoUrls.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <label>Fotos do serviço</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 6 }}>
                      {viewPhotoUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
