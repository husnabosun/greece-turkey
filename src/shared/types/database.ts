/**
 * Hand-written Supabase Database types for Phase 2.
 * Replace/augment with `supabase gen types typescript` once a project is linked.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "farmer" | "processor";
export type LocaleCode = "el" | "tr" | "en";
export type CountryCode = "GR" | "TR";
export type ProofLevel = "self_reported" | "evidence_based" | "lab_verified";
export type ScanMode = "leaf" | "fruit" | "trap" | "label";
export type TreeStatus = "healthy" | "suspicious" | "diseased";
export type LotUse = "oil" | "table";
export type LotStatus = "draft" | "listed" | "reserved" | "sold" | "withdrawn";
export type OfferStatus = "pending" | "accepted" | "rejected" | "countered" | "withdrawn";
export type DeliveryStatus = "scheduled" | "weighed" | "lab_checked" | "paid" | "cancelled";
export type LabResult = "passed" | "failed";
export type TaskKind = "photo" | "spray" | "recheck" | "plain";
export type LogbookKind = "spray" | "fertilizer" | "other";

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  role: UserRole;
  display_name: string | null;
  company_name: string | null;
  locale: LocaleCode;
  country: CountryCode | null;
  phone: string | null;
  place: string | null;
  avatar_url: string | null;
} & Timestamps;

export type Field = {
  id: string;
  farmer_id: string;
  name: string;
  variety: string | null;
  irrigated: boolean;
  tree_count: number | null;
  proof_level: ProofLevel;
  /** GeoJSON-compatible WKT/EWKT string from PostGIS, or parsed client-side. */
  geom: unknown | null;
  centroid: unknown | null;
  area_ha: number | null;
  lat: number | null;
  lon: number | null;
  pruned_at: string | null;
  notes: string | null;
} & Timestamps;

export type FieldTree = {
  id: string;
  field_id: string;
  x_pct: number | null;
  y_pct: number | null;
  geom: unknown | null;
  status: TreeStatus;
  issue: string | null;
  last_photo_at: string | null;
  last_spray_at: string | null;
} & Timestamps;

export type Scan = {
  id: string;
  field_id: string;
  farmer_id: string;
  tree_id: string | null;
  mode: ScanMode;
  storage_path: string | null;
  title: string | null;
  latin_name: string | null;
  diagnosis: Json;
  confidence: number | null;
  fly_count: number | null;
  spot_count: number | null;
  model_version: string | null;
  source: "gemini" | "model" | "demo";
  captured_at: string;
  created_at: string;
};

export type LogbookEntry = {
  id: string;
  field_id: string;
  farmer_id: string;
  kind: LogbookKind;
  product_name: string;
  active_substances: string[];
  dose: string | null;
  licence: string | null;
  pre_harvest_days: number | null;
  protection_days: number | null;
  targets: string[];
  eu_banned: boolean;
  eu_hits: string[];
  applied_at: string;
  area_label: string | null;
  label_storage_path: string | null;
  from_label_scan: boolean;
  notes: string | null;
} & Timestamps;

export type QualityScore = {
  id: string;
  field_id: string;
  farmer_id: string;
  score: number;
  breakdown: Json;
  plan: Json;
  engine_version: string;
  computed_at: string;
  created_at: string;
};

export type Task = {
  id: string;
  field_id: string;
  farmer_id: string;
  tree_id: string | null;
  title: string;
  meta: string | null;
  kind: TaskKind;
  why: string | null;
  urgent: boolean;
  due_on: string | null;
  done: boolean;
  completed_at: string | null;
} & Timestamps;

export type RiskSnapshot = {
  id: string;
  field_id: string;
  farmer_id: string;
  engine_version: string;
  assessments: Json;
  weather: Json | null;
  assessed_on: string;
  created_at: string;
};

export type Lot = {
  id: string;
  farmer_id: string;
  field_id: string | null;
  status: LotStatus;
  use_type: LotUse;
  variety: string;
  tons: number;
  price_per_kg: number | null;
  negotiable: boolean;
  delivery_mode: "pickup" | "deliver" | null;
  town: string | null;
  region: string;
  country: CountryCode | null;
  harvest_start: string | null;
  harvest_end: string | null;
  quality_score: number | null;
  quality_breakdown: Json;
  spray_snapshot: Json;
  has_banned_spray: boolean;
  lab_result: LabResult | null;
  lab_acidity: number | null;
  lab_tested_at: string | null;
  identity_unlocked_for: string[];
  listed_at: string | null;
} & Timestamps;

export type BuyRequest = {
  id: string;
  processor_id: string;
  variety: string;
  tons: number;
  filled_tons: number;
  min_score: number;
  region: string | null;
  window_label: string | null;
  no_banned: boolean;
  shared_with_farmers: boolean;
  active: boolean;
} & Timestamps;

export type Offer = {
  id: string;
  lot_id: string;
  farmer_id: string;
  processor_id: string;
  initiated_by: UserRole;
  status: OfferStatus;
  tons: number;
  price_per_kg: number;
  delivery_in_days: number | null;
  counter_of: string | null;
  message: string | null;
} & Timestamps;

export type Delivery = {
  id: string;
  offer_id: string;
  lot_id: string;
  farmer_id: string;
  processor_id: string;
  status: DeliveryStatus;
  tons: number;
  price_per_kg: number;
  scheduled_for: string | null;
  actual_kg: number | null;
  weighed_at: string | null;
  lab_result: LabResult | null;
  lab_checked_at: string | null;
  paid_at: string | null;
  quality_score_snapshot: number | null;
  banned_free: boolean | null;
  notes: string | null;
} & Timestamps;

export type MarketplaceLot = {
  id: string;
  status: LotStatus;
  use_type: LotUse;
  variety: string;
  tons: number;
  price_per_kg: number | null;
  negotiable: boolean;
  delivery_mode: "pickup" | "deliver" | null;
  town: string | null;
  region: string;
  country: CountryCode | null;
  harvest_start: string | null;
  harvest_end: string | null;
  quality_score: number | null;
  quality_breakdown: Json;
  spray_snapshot: Json;
  has_banned_spray: boolean;
  lab_result: LabResult | null;
  lab_acidity: number | null;
  lab_tested_at: string | null;
  listed_at: string | null;
  created_at: string;
  field_id: string | null;
  farmer_id: string | null;
  farmer_display_name: string | null;
};

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile, Omit<Profile, "created_at" | "updated_at"> & { created_at?: string; updated_at?: string }>;
      fields: TableDef<Field>;
      field_trees: TableDef<FieldTree>;
      scans: TableDef<Scan, Omit<Scan, "id" | "created_at"> & { id?: string; created_at?: string }>;
      logbook_entries: TableDef<LogbookEntry>;
      quality_scores: TableDef<QualityScore, Omit<QualityScore, "id" | "created_at"> & { id?: string; created_at?: string }>;
      tasks: TableDef<Task>;
      risk_snapshots: TableDef<RiskSnapshot, Omit<RiskSnapshot, "id" | "created_at"> & { id?: string; created_at?: string }>;
      lots: TableDef<Lot>;
      buy_requests: TableDef<BuyRequest>;
      offers: TableDef<Offer>;
      deliveries: TableDef<Delivery>;
    };
    Views: {
      marketplace_lots: {
        Row: MarketplaceLot;
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole };
      is_farmer: { Args: Record<string, never>; Returns: boolean };
      is_processor: { Args: Record<string, never>; Returns: boolean };
      create_field_from_geojson: {
        Args: { p_name: string; p_geojson: string; p_variety?: string | null };
        Returns: Field;
      };
    };
    Enums: {
      user_role: UserRole;
      locale_code: LocaleCode;
      country_code: CountryCode;
      proof_level: ProofLevel;
      scan_mode: ScanMode;
      tree_status: TreeStatus;
      lot_use: LotUse;
      lot_status: LotStatus;
      offer_status: OfferStatus;
      delivery_status: DeliveryStatus;
      lab_result: LabResult;
      task_kind: TaskKind;
      logbook_kind: LogbookKind;
    };
  };
};
