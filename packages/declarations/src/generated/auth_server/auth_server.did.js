export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'ok' : IDL.Text, 'err' : IDL.Text });
  const AuthFlowStep = IDL.Variant({
    'consent' : IDL.Null,
    'setup' : IDL.Null,
  });
  const ScopeData = IDL.Record({ 'id' : IDL.Text, 'description' : IDL.Text });
  const ConsentData = IDL.Record({
    'scopes' : IDL.Vec(ScopeData),
    'client_name' : IDL.Text,
    'logo_uri' : IDL.Text,
  });
  const LoginConfirmation = IDL.Record({
    'next_step' : AuthFlowStep,
    'accepted_payment_canisters' : IDL.Vec(IDL.Principal),
    'consent_data' : ConsentData,
  });
  const Result_5 = IDL.Variant({ 'ok' : LoginConfirmation, 'err' : IDL.Text });
  const ResourceServer = IDL.Record({
    'status' : IDL.Variant({ 'active' : IDL.Null, 'pending' : IDL.Null }),
    'resource_server_id' : IDL.Text,
    'owner' : IDL.Principal,
    'scopes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'name' : IDL.Text,
    'uris' : IDL.Vec(IDL.Text),
    'accepted_payment_canisters' : IDL.Vec(IDL.Principal),
    'logo_uri' : IDL.Text,
    'frontend_host' : IDL.Opt(IDL.Text),
    'service_principals' : IDL.Vec(IDL.Principal),
  });
  const Result_1 = IDL.Variant({ 'ok' : ResourceServer, 'err' : IDL.Text });
  const PublicResourceServer = IDL.Record({
    'resource_server_id' : IDL.Text,
    'scopes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'name' : IDL.Text,
    'uris' : IDL.Vec(IDL.Text),
    'accepted_payment_canisters' : IDL.Vec(IDL.Principal),
    'logo_uri' : IDL.Text,
    'frontend_host' : IDL.Opt(IDL.Text),
    'service_principals' : IDL.Vec(IDL.Principal),
  });
  const Result_4 = IDL.Variant({
    'ok' : PublicResourceServer,
    'err' : IDL.Text,
  });
  const SessionInfo = IDL.Record({
    'resource_server_principal' : IDL.Principal,
    'client_name' : IDL.Text,
  });
  const Result_3 = IDL.Variant({ 'ok' : SessionInfo, 'err' : IDL.Text });
  const HeaderField = IDL.Tuple(IDL.Text, IDL.Text);
  const HttpRequest = IDL.Record({
    'url' : IDL.Text,
    'method' : IDL.Text,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HeaderField),
  });
  const Token = IDL.Record({ 'arbitrary_data' : IDL.Text });
  const StreamingCallbackHttpResponse = IDL.Record({
    'token' : IDL.Opt(Token),
    'body' : IDL.Vec(IDL.Nat8),
  });
  const CallbackStrategy = IDL.Record({
    'token' : Token,
    'callback' : IDL.Func([Token], [StreamingCallbackHttpResponse], ['query']),
  });
  const StreamingStrategy = IDL.Variant({ 'Callback' : CallbackStrategy });
  const HttpResponse = IDL.Record({
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HeaderField),
    'upgrade' : IDL.Opt(IDL.Bool),
    'streaming_strategy' : IDL.Opt(StreamingStrategy),
    'status_code' : IDL.Nat16,
  });
  const Result_2 = IDL.Variant({
    'ok' : IDL.Vec(ResourceServer),
    'err' : IDL.Text,
  });
  const RegisterResourceServerArgs = IDL.Record({
    'initial_service_principal' : IDL.Principal,
    'scopes' : IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text)),
    'name' : IDL.Text,
    'uris' : IDL.Vec(IDL.Text),
    'accepted_payment_canisters' : IDL.Vec(IDL.Principal),
    'logo_uri' : IDL.Text,
    'frontend_host' : IDL.Opt(IDL.Text),
  });
  const UpdateResourceServerArgs = IDL.Record({
    'resource_server_id' : IDL.Text,
    'scopes' : IDL.Opt(IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))),
    'name' : IDL.Opt(IDL.Text),
    'uris' : IDL.Opt(IDL.Vec(IDL.Text)),
    'accepted_payment_canisters' : IDL.Opt(IDL.Vec(IDL.Principal)),
    'logo_uri' : IDL.Opt(IDL.Text),
    'frontend_host' : IDL.Opt(IDL.Text),
    'service_principals' : IDL.Opt(IDL.Vec(IDL.Principal)),
  });
  const AuthCanister = IDL.Service({
    'complete_authorize' : IDL.Func([IDL.Text], [Result], []),
    'confirm_login' : IDL.Func([IDL.Text], [Result_5], []),
    'delete_resource_server' : IDL.Func([IDL.Text], [Result], []),
    'deny_consent' : IDL.Func([IDL.Text], [Result], []),
    'get_my_grants' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'get_my_resource_server_details' : IDL.Func([IDL.Text], [Result_1], []),
    'get_public_resource_server' : IDL.Func([IDL.Text], [Result_4], ['query']),
    'get_session_info' : IDL.Func([IDL.Text], [Result_3], ['query']),
    'http_request' : IDL.Func([HttpRequest], [HttpResponse], ['query']),
    'http_request_update' : IDL.Func([HttpRequest], [HttpResponse], []),
    'list_my_resource_servers' : IDL.Func([], [Result_2], []),
    'register_resource_server' : IDL.Func(
        [RegisterResourceServerArgs],
        [Result_1],
        [],
      ),
    'revoke_grant' : IDL.Func([IDL.Text], [Result], []),
    'set_frontend_canister_id' : IDL.Func([IDL.Principal], [], ['oneway']),
    'update_resource_server' : IDL.Func(
        [UpdateResourceServerArgs],
        [Result],
        [],
      ),
  });
  return AuthCanister;
};
export const init = ({ IDL }) => { return []; };
