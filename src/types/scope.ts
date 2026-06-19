/** Authenticated request context — the data boundary for one /chat call. */
export interface Scope {
  organization_id: string;
  therapist_id: string;
  client_id: string;
}

export function scopesEqual(a: Scope, b: Scope): boolean {
  return (
    a.organization_id === b.organization_id &&
    a.therapist_id === b.therapist_id &&
    a.client_id === b.client_id
  );
}
