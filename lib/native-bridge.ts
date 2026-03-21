import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function normalizePhoneDigits(value: string | null | undefined) {
  return (value ?? '').replace(/\D+/g, '');
}

export function normalizeWhatsappPhone(value: string | null | undefined) {
  const digits = normalizePhoneDigits(value);
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function openSmsComposer(phone: string, body: string) {
  if (typeof window === 'undefined') {
    throw new Error('SMS action is only available in browser/native runtime.');
  }

  const separator = Capacitor.getPlatform() === 'ios' ? '&' : '?';
  const smsUrl = `sms:${phone}${body ? `${separator}body=${encodeURIComponent(body)}` : ''}`;
  window.location.href = smsUrl;
}

export async function openWhatsAppChat(phone: string, text: string) {
  if (typeof window === 'undefined') {
    throw new Error('WhatsApp action is only available in browser/native runtime.');
  }

  const encodedText = encodeURIComponent(text);
  const universalUrl = `https://wa.me/${phone}?text=${encodedText}`;

  if (isNativeApp()) {
    window.location.href = universalUrl;
    return;
  }

  window.open(universalUrl, '_blank', 'noopener,noreferrer');
}
