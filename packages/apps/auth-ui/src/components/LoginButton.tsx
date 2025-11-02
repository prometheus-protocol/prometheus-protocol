import { useInternetIdentity } from 'ic-use-internet-identity';

export function LoginButton() {
  const { login, status } = useInternetIdentity();

  const disabled = status === 'logging-in' || status === 'success';
  const text = status === 'logging-in' ? 'Logging in...' : 'Login';

  return (
    <button onClick={login} disabled={disabled}>
      {status}
    </button>
  );
}
