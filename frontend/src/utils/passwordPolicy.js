export const passwordRequirements = [
  { label: 'Từ 8 đến 64 ký tự', test: value => Array.from(value).length >= 8 && Array.from(value).length <= 64 },
  { label: 'Có chữ hoa và chữ thường', test: value => /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value) },
  { label: 'Có ít nhất một chữ số', test: value => /\p{Nd}/u.test(value) },
  { label: 'Có ký tự đặc biệt (ví dụ: ! @ #)', test: value => /[\p{P}\p{S}]/u.test(value) },
];

export function passwordError(value) {
  if (!value) return 'Vui lòng nhập mật khẩu';
  if (passwordRequirements.some(rule => !rule.test(value)) || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
    return 'Mật khẩu cần 8–64 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt.';
  }
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^(password|qwerty|admin|administrator|welcome|letmein|abc|123456|iloveyou|changeme)[0-9]*$/.test(compact)) {
    return 'Mật khẩu quá dễ đoán. Hãy chọn một cụm từ dài, riêng biệt.';
  }
  return '';
}
