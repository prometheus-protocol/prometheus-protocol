import { useInternetIdentity } from 'ic-use-internet-identity';

export function LoginButton() {
  const { login, loginStatus } = useInternetIdentity();

  const disabled = loginStatus === 'logging-in' || loginStatus === 'success';
  const text = loginStatus === 'logging-in' ? 'Logging in...' : 'Login';

  return (
    <button onClick={login} disabled={disabled}>
      {loginStatus}
    </button>
  );
}
