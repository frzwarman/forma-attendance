// Mirrors public.guestbook_phone_key: digits only, country code 62 becomes the local 0.
export function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("62") && digits.length > 8 ? `0${digits.slice(2)}` : digits;
}

// Keeps the first four and last two digits so a projected winner stays reachable but private.
export function maskPhone(value: string): string {
  const digits = phoneDigits(value);
  if (digits.length <= 6) return digits.slice(0, 2) + "*".repeat(Math.max(0, digits.length - 2));
  return digits.slice(0, 4) + "*".repeat(digits.length - 6) + digits.slice(-2);
}

export function whatsappLink(value: string): string {
  const digits = phoneDigits(value);
  return `https://wa.me/${digits.startsWith("0") ? `62${digits.slice(1)}` : digits}`;
}
