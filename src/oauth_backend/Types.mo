import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Server "mo:server";
import Map "mo:map/Map";

module {
  // Represents a registered backend service that provides paid tools.
  public type ResourceServer = {
    resource_server_id : Text;
    owner : Principal;
    name : Text;
    payout_principal : Principal; // CRITICAL: Where the money goes.
    service_principals : [Principal]; // List of trusted backend server identities.
    uris : [Text]; // List of URIs for the resource server.
    status : {
      #active;
      #pending;
    };
  };

  // Represents a registered application (a resource server).
  public type Client = {
    client_id : Text;
    owner : Principal;
    client_secret_hash : Text;
    client_name : Text;
    logo_uri : Text;
    redirect_uris : [Text];
    status : {
      #active; // The client is fully registered and can be used.
      #pending_activation; // The client is registered but not yet activated.
    };
  };

  // Represents a temporary code used to get a real token.
  public type AuthorizationCode = {
    code : Text;
    user_principal : Principal;
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    expires_at : Time.Time;
    code_challenge : Text;
    code_challenge_method : Text;
    audience : Text; // The resource server this code is for.
  };

  // Represents the temporary state during the II login flow.
  public type AuthorizeSession = {
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    state : ?Text;
    expires_at : Time.Time;
    code_challenge : Text;
    code_challenge_method : Text;
    audience : Text; // The resource server this session is for.
  };

  // A type to hold the validated and cleaned-up request parameters.
  public type ValidatedAuthRequest = {
    client : Client;
    redirect_uri : Text;
    scope : Text;
    state : ?Text;
  };

  // The data returned to a developer after successful client registration.
  public type RegistrationResponse = {
    client_id : Text;
    client_secret : Text; // This is the only time the raw secret is ever revealed.
    client_name : Text;
    redirect_uris : [Text];
    grant_types : [Text];
  };

  // The Context object that bundles all application state.
  public type Context = {
    self : Principal; // The canister's own principal
    creator : Principal;
    var frontend_canister_id : Principal;
    var signing_key_bytes : Blob;
    icrc2_ledger_id : Principal;
    registration_fee : Nat; // The fee in PMP tokens for client registration
    clients : Map.Map<Text, Client>;
    resource_servers : Map.Map<Text, ResourceServer>;
    auth_codes : Map.Map<Text, AuthorizationCode>;
    authorize_sessions : Map.Map<Text, AuthorizeSession>;
    uri_to_rs_id : Map.Map<Text, Text>; // Maps resource server URIs to their IDs
  };

  // Re-export server types for convenience.
  public type Request = Server.Request;
  public type Response = Server.Response;
  public type ResponseClass = Server.ResponseClass;
};
