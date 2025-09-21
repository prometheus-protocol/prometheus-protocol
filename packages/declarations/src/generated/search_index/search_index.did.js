export const idlFactory = ({ IDL }) => {
  const Result = IDL.Variant({ 'ok' : IDL.Null, 'err' : IDL.Text });
  const Indexer = IDL.Service({
    'search' : IDL.Func([IDL.Text], [IDL.Vec(IDL.Text)], ['query']),
    'set_registry_canister_id' : IDL.Func([IDL.Principal], [Result], []),
    'update_index' : IDL.Func([IDL.Text, IDL.Text], [], []),
  });
  return Indexer;
};
export const init = ({ IDL }) => { return []; };
