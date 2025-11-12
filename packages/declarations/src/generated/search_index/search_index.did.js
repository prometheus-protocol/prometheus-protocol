export const idlFactory = ({ IDL }) => {
  const EnvDependency = IDL.Record({
    'key' : IDL.Text,
    'setter' : IDL.Text,
    'required' : IDL.Bool,
    'canister_name' : IDL.Text,
    'current_value' : IDL.Opt(IDL.Principal),
  });
  const EnvConfig = IDL.Record({
    'key' : IDL.Text,
    'value_type' : IDL.Text,
    'setter' : IDL.Text,
    'required' : IDL.Bool,
    'current_value' : IDL.Opt(IDL.Text),
  });
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Indexer = IDL.Service({
    'get_env_requirements' : IDL.Func(
        [],
        [
          IDL.Variant({
            'v1' : IDL.Record({
              'dependencies' : IDL.Vec(EnvDependency),
              'configuration' : IDL.Vec(EnvConfig),
            }),
          }),
        ],
        ['query'],
      ),
    'search' : IDL.Func([IDL.Text], [IDL.Vec(IDL.Text)], ['query']),
    'set_registry_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'update_index' : IDL.Func([IDL.Text, IDL.Text], [], []),
  });
  return Indexer;
};
export const init = ({ IDL }) => { return []; };
