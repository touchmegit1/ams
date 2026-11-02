import { passwordRequirements } from '../../utils/passwordPolicy.js';

export default function PasswordRequirements({ value }) {
  return <ul className="password-requirements" id="password-requirements" aria-label="Yêu cầu mật khẩu">
    {passwordRequirements.map(rule => <li key={rule.label} className={rule.test(value) ? 'is-met' : ''}>
      <span aria-hidden="true">{rule.test(value) ? '✓' : '○'}</span> {rule.label}
    </li>)}
  </ul>;
}
