// The registered business identity shown on /contact and in the site footer. Payment processors
// check both against the account, so use the registered values exactly. While either field is
// empty nothing is rendered: never fill in a placeholder.
export type BusinessIdentity = { legalName: string; addressLines: string[] };

export const BUSINESS: BusinessIdentity = {
  legalName: "",
  addressLines: []
};

export function businessIdentity(value: BusinessIdentity = BUSINESS): BusinessIdentity | null {
  const legalName = value.legalName.trim();
  const addressLines = value.addressLines.map((line) => line.trim()).filter(Boolean);
  return legalName && addressLines.length ? { legalName, addressLines } : null;
}
