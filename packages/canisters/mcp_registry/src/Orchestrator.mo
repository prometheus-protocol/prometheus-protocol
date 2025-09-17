module {
  // --- ACTOR SERVICE INTERFACE ---

  public type InternalDeployRequest = {
    namespace : Text;
    hash : Blob;
    owner : Principal;
  };

  public type Service = actor {
    internal_deploy_or_upgrade : (request : InternalDeployRequest) -> async ();
  };
};
