import type { NoteKind, PaymentMethod } from "@/types/database";

export type CityOption = { id: string; name: string; state: string };

export type CustomerNoteItem = {
  id: string;
  kind: NoteKind;
  body: string;
  created_at: string;
  author_name: string | null;
};

export type PostponementItem = {
  id: string;
  installment_id: string;
  previous_date: string;
  new_date: string;
  reason: string;
  notes: string | null;
  expected_channel: PaymentMethod | null;
  needs_visit: boolean;
  created_at: string;
  author_name: string | null;
};
