// Only the Funded service's federated ticket is allowed to populate this field.
// A user-editable profile field or account code must never be used as an email fallback.
export function fundedSupportEmail(principal) {
  if (principal?.authMethod !== 'FEDERATED') return null;
  const email = String(principal?.fundedCustomerEmail || '').trim().toLowerCase();
  return email.length <= 200 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) ? email : null;
}
