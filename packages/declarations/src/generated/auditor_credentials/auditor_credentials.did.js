export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const AuditorCredentials = IDL.Service({
    'get_credentials_for_auditor' : IDL.Func(
        [IDL.Principal],
        [IDL.Vec(IDL.Text)],
        ['query'],
      ),
    'get_owner' : IDL.Func([], [IDL.Principal], ['query']),
    'issue_credential' : IDL.Func([IDL.Principal, IDL.Text], [Result], []),
    'revoke_credential' : IDL.Func([IDL.Principal, IDL.Text], [Result], []),
    'transfer_ownership' : IDL.Func([IDL.Principal], [Result], []),
    'verify_credential' : IDL.Func(
        [IDL.Principal, IDL.Text],
        [IDL.Bool],
        ['query'],
      ),
  });
  return AuditorCredentials;
};
export const init = ({ IDL }) => { return []; };
