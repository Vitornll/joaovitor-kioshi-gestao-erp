import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal, StatCard, Badge, EmptyState, formatDate } from '../components/ui';
import type { Client, ClientAddress, Contract, ServiceType } from '../lib/types';

type ClientWithExtras = Client & { client_addresses: ClientAddress[]; contracts: Contract[] };

const STAGE_LABEL: Record<string, string> = {
  prospeccao: 'Prospecção',
  proposta: 'Proposta',
  contrato: 'Contrato',
  cliente_spot: 'Cliente spot',
  ex_cliente: 'Ex-cliente',
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
  const [detail, setDetail] = useState<ClientWithExtras | null>(null);
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
                  <button className="btn btn-secondary btn-sm" onClick={() => setDetail(c)}>
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
          onClose={() => setDetail(null)}
          footer={
            <button className="btn btn-secondary" onClick={() => setDetail(null)}>
              Fechar
            </button>
          }
        >
          <div className="field-row">
            <div>
              <label>Documento</label>
              <p style={{ margin: 0 }}>{detail.cpf || detail.cnpj || '—'}</p>
            </div>
            <div>
              <label>Contato</label>
              <p style={{ margin: 0 }}>{detail.contact_name || '—'}</p>
            </div>
          </div>
          <div className="field-row" style={{ marginTop: 14 }}>
            <div>
              <label>Telefone</label>
              <p style={{ margin: 0 }}>{detail.phone || '—'}</p>
            </div>
            <div>
              <label>E-mail</label>
              <p style={{ margin: 0 }}>{detail.email || '—'}</p>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <label>Endereços</label>
            {detail.client_addresses.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum endereço cadastrado.</p>}
            {detail.client_addresses.map((a) => (
              <div key={a.id} className="card" style={{ padding: 12, marginBottom: 8, fontSize: 13.5 }}>
                <strong>{a.label || 'Endereço'}</strong>
                <div style={{ color: 'var(--text-muted)' }}>
                  {[a.street, a.number, a.neighborhood, a.city, a.state].filter(Boolean).join(', ')}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <label>Contratos</label>
            {detail.contracts.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum contrato.</p>}
            {detail.contracts.map((c) => (
              <div key={c.id} className="card" style={{ padding: 12, marginBottom: 8, fontSize: 13.5, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {c.recurrence} · desde {formatDate(c.start_date)}
                </span>
                <Badge tone={c.status === 'ativo' ? 'success' : 'neutral'}>{c.status}</Badge>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
