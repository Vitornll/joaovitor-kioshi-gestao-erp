import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Modal } from './ui';
import type { Client, ClientAddress, Profile, ServiceOrder, ServiceType } from '../lib/types';

// Modal de agendamento reutilizável — usado na Agenda (agendamento avulso),
// no cadastro do cliente (novo agendamento para um cliente já aberto) e no
// CRM (quando o cliente aceita um orçamento, já nasce ligado a ele via
// `initialQuoteId`, o que atualiza o orçamento para "aprovado").
export default function ScheduleModal({
  initialClientId,
  initialQuoteId,
  initialServiceTypeId,
  initialNotes,
  lockClient,
  onClose,
  onSaved,
}: {
  initialClientId?: string;
  initialQuoteId?: string;
  initialServiceTypeId?: string;
  initialNotes?: string;
  lockClient?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [technicians, setTechnicians] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);

  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(initialClientId ?? '');
  const [addresses, setAddresses] = useState<ClientAddress[]>([]);
  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([]);
  const [newAddressStreet, setNewAddressStreet] = useState('');
  const [serviceTypeId, setServiceTypeId] = useState(initialServiceTypeId ?? '');
  const [datetime, setDatetime] = useState('');
  const [duration, setDuration] = useState(60);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [status, setStatus] = useState<ServiceOrder['status']>('confirmado');
  const [selectedTechs, setSelectedTechs] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [c, s, p] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('service_types').select('*').eq('active', true).order('name'),
        supabase.from('profiles').select('*').eq('role', 'tecnico').eq('active', true),
      ]);
      setClients(c.data ?? []);
      setServiceTypes(s.data ?? []);
      setTechnicians(p.data ?? []);
    })();
  }, []);

  const matches = !lockClient && clientQuery.length > 0 ? clients.filter((c) => c.name.toLowerCase().includes(clientQuery.toLowerCase())).slice(0, 6) : [];
  const selectedClient = clients.find((c) => c.id === selectedClientId) ?? null;

  useEffect(() => {
    if (!selectedClientId) {
      setAddresses([]);
      return;
    }
    supabase
      .from('client_addresses')
      .select('*')
      .eq('client_id', selectedClientId)
      .then(({ data }) => {
        setAddresses(data ?? []);
        setSelectedAddressIds(data && data.length ? [data[0].id] : []);
      });
  }, [selectedClientId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!datetime) return;
    setSaving(true);

    let clientId = selectedClientId;
    let addressIds = selectedAddressIds;

    if (!clientId) {
      const { data: newClient } = await supabase
        .from('clients')
        .insert({ name: clientQuery, phone: phone || null, email: email || null, commercial_stage: 'cliente_spot' })
        .select()
        .single();
      if (newClient) {
        clientId = newClient.id;
        if (newAddressStreet) {
          const { data: addr } = await supabase
            .from('client_addresses')
            .insert({ client_id: clientId, street: newAddressStreet, is_primary: true })
            .select()
            .single();
          addressIds = addr ? [addr.id] : [];
        } else {
          addressIds = [];
        }
      }
    }

    if (!clientId) {
      setSaving(false);
      return;
    }

    const targets = addressIds.length ? addressIds : [null];
    for (const addressId of targets) {
      const { data: order } = await supabase
        .from('service_orders')
        .insert({
          client_id: clientId,
          address_id: addressId,
          service_type_id: serviceTypeId || null,
          quote_id: initialQuoteId || null,
          scheduled_at: new Date(datetime).toISOString(),
          duration_minutes: duration,
          status,
          notes: notes || null,
        })
        .select()
        .single();
      if (order && selectedTechs.length) {
        await supabase.from('service_order_assignees').insert(selectedTechs.map((employee_id) => ({ service_order_id: order.id, employee_id })));
      }
    }

    if (initialQuoteId) {
      await supabase.from('quotes').update({ status: 'aprovado' }).eq('id', initialQuoteId);
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      eyebrow="Agendamento"
      title="Agendar serviço"
      description={
        initialQuoteId
          ? 'O cliente aceitou o orçamento — ao salvar, o orçamento é marcado como aprovado e a atividade entra na agenda e no app do técnico.'
          : 'Clientes já cadastrados serão identificados pelo nome. O atendimento entra no mesmo histórico, sem duplicar o cadastro.'
      }
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" form="schedule-form" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar agendamento'}
          </button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={handleSave}>
        <div className="field" style={{ position: 'relative' }}>
          <label>Cliente cadastrado</label>
          <input
            placeholder="Pesquise por nome"
            disabled={!!lockClient}
            value={selectedClient ? selectedClient.name : clientQuery}
            onChange={(e) => {
              setSelectedClientId('');
              setClientQuery(e.target.value);
            }}
          />
          {!selectedClient && matches.length > 0 && (
            <div className="card" style={{ position: 'absolute', zIndex: 5, width: '100%', marginTop: 4 }}>
              {matches.map((c) => (
                <div
                  key={c.id}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13.5 }}
                  onClick={() => {
                    setSelectedClientId(c.id);
                    setClientQuery('');
                  }}
                >
                  {c.name}
                </div>
              ))}
            </div>
          )}
          {!lockClient && !selectedClient && clientQuery && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Nenhum cadastro encontrado — ao salvar, um novo cliente será criado automaticamente com esse nome.
            </p>
          )}
        </div>

        <div className="field">
          <label>Serviço solicitado</label>
          <select value={serviceTypeId} onChange={(e) => setServiceTypeId(e.target.value)}>
            <option value="">Selecione</option>
            {serviceTypes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Data e horário</label>
            <input type="datetime-local" required value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          </div>
          <div className="field">
            <label>Duração estimada (min)</label>
            <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>

        {selectedClient ? (
          <div className="field">
            <label>Endereços de atendimento</label>
            {addresses.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Este cliente não possui endereço cadastrado.</p>}
            {addresses.map((a) => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, textTransform: 'none', fontSize: 13.5, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={selectedAddressIds.includes(a.id)}
                  onChange={(e) =>
                    setSelectedAddressIds(e.target.checked ? [...selectedAddressIds, a.id] : selectedAddressIds.filter((id) => id !== a.id))
                  }
                />
                {a.label || a.street || 'Endereço'}
              </label>
            ))}
          </div>
        ) : (
          <div className="field">
            <label>Endereço de atendimento</label>
            <input placeholder="Rua, número, bairro" value={newAddressStreet} onChange={(e) => setNewAddressStreet(e.target.value)} />
          </div>
        )}

        <div className="field-row">
          <div className="field">
            <label>Telefone do contato</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>E-mail para documentos</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Observações do agendamento</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="field">
          <label>Operador(es) que atenderá(ão)</label>
          {technicians.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Cadastre técnicos em Recursos Humanos.</p>}
          {technicians.map((t) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, textTransform: 'none', fontSize: 13.5, marginBottom: 6 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={selectedTechs.includes(t.id)}
                onChange={(e) => setSelectedTechs(e.target.checked ? [...selectedTechs, t.id] : selectedTechs.filter((id) => id !== t.id))}
              />
              {t.full_name}
            </label>
          ))}
        </div>

        <div className="field">
          <label>Situação do serviço</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as ServiceOrder['status'])}>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="em_rota">Em rota</option>
            <option value="em_execucao">Em execução</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
