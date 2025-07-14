import Principal "mo:base/Principal";
import Time "mo:base/Time";
import Server "mo:server";
import Map "mo:map/Map";

module {
  // Represents a registered application (a resource server).
  public type Client = {
    client_id : Text;
    owner : Principal;
    client_secret_hash : Text;
    client_name : Text;
    logo_uri : Text;
    redirect_uris : [Text];
  };

  // Represents a temporary code used to get a real token.
  public type AuthorizationCode = {
    code : Text;
    user_principal : Principal;
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    expires_at : Time.Time;
  };

  // Represents a user's active subscription.
  public type Subscription = {
    user_principal : Principal;
    tier : Text;
    expires_at : Time.Time;
  };

  // Represents the temporary state during the II login flow.
  public type AuthorizeSession = {
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    state : ?Text;
    expires_at : Time.Time;
  };

  // A type to hold the validated and cleaned-up request parameters.
  public type ValidatedAuthRequest = {
    client : Client;
    redirect_uri : Text;
    scope : Text;
    state : ?Text;
  };

  // The Context object that bundles all application state.
  public type Context = {
    self : Principal; // The canister's own principal
    creator : Principal;
    var frontend_canister_id : Principal;
    var signing_key_bytes : Blob;
    clients : Map.Map<Text, Client>;
    auth_codes : Map.Map<Text, AuthorizationCode>;
    subscriptions : Map.Map<Principal, Subscription>;
    authorize_sessions : Map.Map<Text, AuthorizeSession>;
  };

  // Re-export server types for convenience.
  public type Request = Server.Request;
  public type Response = Server.Response;
  public type ResponseClass = Server.ResponseClass;
};
