import Result "mo:base/Result";

// This module defines the necessary types and the actor interface for the McpRegistry canister,
// allowing the orchestrator to make type-safe calls without a direct import.
module {

  // --- TYPE DEFINITIONS (Translated from Candid) ---
  public type ResourceServer = {
    resource_server_id : Text;
    owner : Principal;
    name : Text;
    logo_uri : Text; // Optional logo URI for the resource server
    service_principals : [Principal]; // List of trusted backend server identities.
    uris : [Text]; // List of URIs for the resource server.
    status : {
      #active;
      #pending;
    };
    // A map of supported scopes to their human-readable descriptions.
    // Example: { "read:files" -> "Allows the app to read your files.",
    //            "write:files" -> "Allows the app to create and modify your files." }
    scopes : [(Text, Text)];
    accepted_payment_canisters : [Principal]; // List of icrc2 canisters that this server accepts.
    frontend_host : ?Text; // Optional custom frontend host for login redirects.
  };

  public type RegisterResourceServerArgs = {
    name : Text;
    logo_uri : Text; // Optional logo URI
    uris : [Text]; // The URIs for the resource server
    initial_service_principal : Principal;
    scopes : [(Text, Text)]; // A map of supported scopes to their descriptions
    accepted_payment_canisters : [Principal]; // List of icrc2 canisters that this server accepts.
    frontend_host : ?Text; // Optional custom frontend host for login redirects.
  };

  // --- ACTOR SERVICE INTERFACE ---
  public type Service = actor {
    register_resource_server : (args : RegisterResourceServerArgs) -> async Result.Result<ResourceServer, Text>;
  };
};
