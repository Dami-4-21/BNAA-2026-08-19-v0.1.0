export function getCurrentTimestamp() {
  return new Date().toISOString();
}

export function getCurrentDateIso() {
  return getCurrentTimestamp().slice(0, 10);
}

export function getCurrentDate() {
  return new Date(getCurrentTimestamp());
}
