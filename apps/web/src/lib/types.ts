export type UserRole = 'diretoria' | 'supervisor' | 'tecnico';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  active: boolean;
}

export type ClientKind = 'pessoa_fisica' | 'pessoa_juridica';
export type CommercialStage = 'prospeccao' | 'proposta' | 'contrato' | 'cliente_spot' | 'ex_cliente';

export interface Client {
  id: string;
  kind: ClientKind;
  name: string;
  cpf: string | null;
  cnpj: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  commercial_stage: CommercialStage;
  notes: string | null;
  created_at: string;
}

export interface ClientAddress {
  id: string;
  client_id: string;
  label: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  reference: string | null;
  is_primary: boolean;
}

export interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  default_duration_minutes: number;
  default_price: number | null;
  active: boolean;
}

export type ContractRecurrence = 'avulso' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual';
export type ContractStatus = 'ativo' | 'suspenso' | 'encerrado';

export interface Contract {
  id: string;
  client_id: string;
  service_type_id: string | null;
  recurrence: ContractRecurrence;
  start_date: string;
  end_date: string | null;
  value: number | null;
  status: ContractStatus;
  notes: string | null;
}

export type ServiceOrderStatus =
  | 'pendente'
  | 'confirmado'
  | 'em_rota'
  | 'em_execucao'
  | 'concluido'
  | 'cancelado';

export interface ServiceOrder {
  id: string;
  client_id: string;
  address_id: string | null;
  contract_id: string | null;
  quote_id: string | null;
  service_type_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: ServiceOrderStatus;
  notes: string | null;
  created_at: string;
  clients?: Client;
  client_addresses?: ClientAddress;
  service_types?: ServiceType;
  service_order_execution?: ServiceOrderExecution | ServiceOrderExecution[];
}

export interface ServiceOrderExecution {
  service_order_id: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  ppe_confirmed: boolean;
  signature_url: string | null;
  photos: string[];
  products_used: { product_id: string; product_name: string; lot_id: string | null; qty: number; unit: string }[];
  execution_notes: string | null;
  report_pdf_url: string | null;
}

export interface Employee {
  id: string;
  profile_id: string | null;
  full_name: string;
  cargo: string | null;
  admission_date: string | null;
  birth_date: string | null;
  cnh_number: string | null;
  cnh_validity: string | null;
  aso_validity: string | null;
  free_for_any_contract: boolean;
  active: boolean;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string | null;
  odometer_km: number;
  next_maintenance_km: number | null;
  next_maintenance_date: string | null;
  licensing_due_date: string | null;
  status: string;
}

export type ProductCategory = 'quimico' | 'epi' | 'equipamento' | 'outro';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: string;
  min_stock: number;
  active: boolean;
}

export interface ProductLot {
  id: string;
  product_id: string;
  lot_number: string;
  expiry_date: string | null;
  quantity_central: number;
}

export interface ComplianceLicense {
  id: string;
  name: string;
  license_type: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  notes: string | null;
}

export type QuoteStatus = 'aguardando' | 'aprovado' | 'nao_aprovado' | 'vencido';

export interface Quote {
  id: string;
  number: string;
  client_id: string | null;
  responsible_profile_id: string | null;
  city: string | null;
  state: string | null;
  issue_date: string;
  validity_date: string | null;
  validity_days: number | null;
  service_description: string | null;
  nature_of_services: string | null;
  application_locations: string | null;
  application_notes: string | null;
  pests_combated: string | null;
  payment_terms: string | null;
  observations: string | null;
  site_contact_name: string | null;
  site_contact_phone: string | null;
  value: number | null;
  status: QuoteStatus;
  pdf_url: string | null;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  position: number;
  service_name: string;
  assistance_days: number | null;
  qty: number;
  unit_price: number;
}

export interface CompanySettings {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  logo_url: string | null;
  primary_color: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
}

export type ChargeStatus = 'a_receber' | 'recebido' | 'vencido' | 'cancelado';

export interface Charge {
  id: string;
  service_order_id: string | null;
  client_id: string | null;
  description: string | null;
  value: number;
  payment_method: string | null;
  due_date: string | null;
  received_date: string | null;
  status: ChargeStatus;
  reference: string | null;
  attachment_url: string | null;
  invoice_url: string | null;
  notes: string | null;
  clients?: Client;
}
