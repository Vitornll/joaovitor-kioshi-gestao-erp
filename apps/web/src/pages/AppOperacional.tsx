import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Badge, EmptyState, formatDateTime } from '../components/ui';
import type { ServiceOrder, Product, ProductLot } from '../lib/types';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  pendente: 'warning',
  confirmado: 'info',
  em_rota: 'info',
  em_execucao: 'info',
  concluido: 'success',
  cancelado: 'danger',
};

interface ProductRow {
  product_id: string;
  lot_id: string;
  qty: string;
}

export default function AppOperacional() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [products, setProducts] = useState<(Product & { product_lots: ProductLot[] })[]>([]);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ServiceOrder | null>(null);
  const [ppe, setPpe] = useState(false);
  const [notes, setNotes] = useState('');
  const [productRows, setProductRows] = useState<ProductRow[]>([{ product_id: '', lot_id: '', qty: '' }]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) load();
  }, [profile]);

  async function load() {
    setLoading(true);
    const [{ data: assignments }, { data: productsData }, { data: employeeRow }] = await Promise.all([
      supabase.from('service_order_assignees').select('service_order_id').eq('employee_id', profile!.id),
      supabase.from('products').select('*, product_lots(*)').eq('active', true).order('name'),
      supabase.from('employees').select('id').eq('profile_id', profile!.id).maybeSingle(),
    ]);
    setProducts((productsData as any) ?? []);
    setEmployeeId(employeeRow?.id ?? null);

    const ids = (assignments ?? []).map((a) => a.service_order_id);
    if (!ids.length) {
      setOrders([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('service_orders')
      .select('*, clients(*), client_addresses(*), service_types(*)')
      .in('id', ids)
      .order('scheduled_at');
    setOrders((data as ServiceOrder[]) ?? []);
    setLoading(false);
  }

  async function checkIn(order: ServiceOrder) {
    await supabase.from('service_order_execution').upsert({ service_order_id: order.id, checked_in_at: new Date().toISOString() });
    await supabase.from('service_orders').update({ status: 'em_execucao' }).eq('id', order.id);
    load();
  }

  function openOrder(order: ServiceOrder) {
    setActive(order);
    setPpe(false);
    setNotes('');
    setProductRows([{ product_id: '', lot_id: '', qty: '' }]);
    setPhotoFiles([]);
  }

  function updateProductRow(index: number, patch: Partial<ProductRow>) {
    setProductRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addProductRow() {
    setProductRows((prev) => [...prev, { product_id: '', lot_id: '', qty: '' }]);
  }

  function removeProductRow(index: number) {
    setProductRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handlePickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function finish() {
    if (!active) return;
    setSaving(true);

    // 1) Sobe as fotos anexadas para o bucket privado "photos".
    const photoPaths: string[] = [];
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const path = `${active.id}/${Date.now()}-${i}-${file.name}`;
      const { error } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type });
      if (!error) photoPaths.push(path);
    }

    // 2) Monta o registro de produtos usados (guarda nome/unidade já resolvidos).
    const validRows = productRows.filter((r) => r.product_id && Number(r.qty) > 0);
    const productsUsed = validRows.map((r) => {
      const product = products.find((p) => p.id === r.product_id);
      return {
        product_id: r.product_id,
        product_name: product?.name ?? '—',
        lot_id: r.lot_id || null,
        qty: Number(r.qty),
        unit: product?.unit ?? 'un',
      };
    });

    await supabase.from('service_order_execution').upsert({
      service_order_id: active.id,
      checked_out_at: new Date().toISOString(),
      ppe_confirmed: ppe,
      execution_notes: notes || null,
      photos: photoPaths,
      products_used: productsUsed,
    });

    // 3) Dá baixa real no estoque (se este login estiver vinculado a um
    // colaborador em Recursos Humanos — senão, fica só registrado acima).
    if (employeeId) {
      for (const row of validRows) {
        if (!row.lot_id) continue;
        await supabase.from('stock_movements').insert({
          product_id: row.product_id,
          lot_id: row.lot_id,
          employee_id: employeeId,
          service_order_id: active.id,
          movement_type: 'uso_em_servico',
          quantity: Number(row.qty),
          created_by: profile!.id,
        });
      }
    }

    await supabase.from('service_orders').update({ status: 'concluido' }).eq('id', active.id);
    setSaving(false);
    setActive(null);
    load();
  }

  const today = orders.filter((o) => new Date(o.scheduled_at).toDateString() === new Date().toDateString());
  const upcoming = orders.filter((o) => new Date(o.scheduled_at).toDateString() !== new Date().toDateString());
  const activeLots = (productId: string) => products.find((p) => p.id === productId)?.product_lots ?? [];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="content-eyebrow">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' }).toUpperCase()}</div>
      <h1 className="content-title">Olá, {profile?.full_name?.split(' ')[0]}</h1>
      <div className="card" style={{ background: 'var(--brand)', color: '#fff', padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>{today.length} serviço(s) para hoje</strong>
        <span>↗</span>
      </div>
      {!employeeId && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Seu login ainda não está vinculado a um colaborador em Recursos Humanos — os produtos informados ficam registrados no serviço, mas não baixam do estoque automaticamente.
        </p>
      )}

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : orders.length === 0 ? (
        <EmptyState>Nenhum serviço designado para você no momento.</EmptyState>
      ) : (
        <>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>Próximo serviço</h3>
          {today.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>Nenhum serviço hoje.</p>}
          {today.map((o) => (
            <div key={o.id} className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <Badge tone={STATUS_TONE[o.status]}>
                  {new Date(o.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {o.status.replace('_', ' ')}
                </Badge>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{o.duration_minutes} min</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' }}>{o.clients?.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                {o.client_addresses ? [o.client_addresses.street, o.client_addresses.city].filter(Boolean).join(', ') : 'Endereço a definir'}
              </div>
              <div style={{ fontSize: 13, marginBottom: 12 }}>{o.service_types?.name}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {o.status !== 'concluido' && o.status !== 'em_execucao' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => checkIn(o)}>
                    + Fazer check-in
                  </button>
                )}
                {o.status !== 'concluido' && (
                  <button className="btn btn-primary btn-sm" onClick={() => openOrder(o)}>
                    Abrir OS →
                  </button>
                )}
              </div>
            </div>
          ))}

          {upcoming.length > 0 && (
            <>
              <h3 style={{ fontSize: 15, margin: '20px 0 10px' }}>Depois</h3>
              {upcoming.slice(0, 5).map((o) => (
                <div key={o.id} className="card" style={{ padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{o.clients?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.service_types?.name}</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{formatDateTime(o.scheduled_at)}</div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {active && (
        <Modal
          eyebrow="Execução do serviço"
          title={active.clients?.name ?? 'Ordem de serviço'}
          description="Confirme os EPIs obrigatórios, registre os produtos usados e finalize com fotos e comentários."
          onClose={() => setActive(null)}
          wide
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setActive(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={finish} disabled={saving}>
                {saving ? 'Enviando…' : 'Finalizar e enviar'}
              </button>
            </>
          }
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400, textTransform: 'none', fontSize: 14, marginBottom: 16 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={ppe} onChange={(e) => setPpe(e.target.checked)} />
            Confirmo o uso dos EPIs obrigatórios
          </label>

          <div className="field">
            <label>Produtos utilizados</label>
          </div>
          <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
            {productRows.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px auto', gap: 8, alignItems: 'center' }}>
                <select value={row.product_id} onChange={(e) => updateProductRow(i, { product_id: e.target.value, lot_id: '' })}>
                  <option value="">Produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select value={row.lot_id} onChange={(e) => updateProductRow(i, { lot_id: e.target.value })} disabled={!row.product_id}>
                  <option value="">Lote</option>
                  {activeLots(row.product_id).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lot_number} ({l.quantity_central})
                    </option>
                  ))}
                </select>
                <input type="number" step="0.01" placeholder="Qtd." value={row.qty} onChange={(e) => updateProductRow(i, { qty: e.target.value })} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeProductRow(i)} disabled={productRows.length === 1}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addProductRow}>
            + Produto
          </button>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Tempo de serviço (min)</label>
            <input readOnly value={String(active.duration_minutes)} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>O tempo real é calculado pelo check-in e pela finalização.</p>
          </div>

          <div className="field">
            <label>Fotos do serviço</label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handlePickPhotos} />
            {photoFiles.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
                {photoFiles.map((f, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={URL.createObjectURL(f)} style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 11, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="field">
            <label>Comentários do técnico</label>
            <textarea rows={4} placeholder="Pontos de atenção, recomendações ao cliente…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>A assinatura do cliente fica disponível em uma próxima etapa.</p>
        </Modal>
      )}
    </div>
  );
}
