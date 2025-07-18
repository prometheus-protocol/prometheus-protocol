import Principal "mo:base/Principal";
import Time "mo:base/Time";
import TrieMap "mo:base/TrieMap";
import Buffer "mo:base/Buffer";
import Server "../server";
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

  public type ValidatedAuthorizeRequest = {
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    state : Text;
    code_challenge : Text;
    code_challenge_method : Text;
    audience : Text;
    resource : ?Text; // Optional resource URI, if specified.
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
    resource : ?Text; // Optional resource URI, if specified.
  };

  public type AuthorizeSessionStatus = {
    #awaiting_login;
    #awaiting_payment_setup;
    #awaiting_consent;
  };

  // Represents the temporary state during the II login flow.
  public type AuthorizeSession = {
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    state : Text;
    expires_at : Time.Time;
    code_challenge : Text;
    code_challenge_method : Text;
    audience : Text; // The resource server this session is for.
    resource : ?Text; // Optional resource URI, if specified.
    var status : AuthorizeSessionStatus;
    var user_principal : ?Principal; // The user principal after login, if available.
  };

  public type ConsentData = {
    client_name : Text;
    scope : Text;
    logo_uri : Text;
  };

  public type AuthFlowStep = {
    #consent; // User needs to consent to the requested scopes.
    #setup; // User needs to set up payment or other required actions.
  };

  public type LoginConfirmation = {
    next_step : AuthFlowStep;
    consent_data : ConsentData;
  };

  // A record to hold all the validated data from a /token request.
  public type ValidatedTokenRequest = {
    auth_code_record : AuthorizationCode;
    client : Client;
  };

  public type RefreshToken = {
    token : Text; // The refresh token string itself
    user_principal : Principal;
    client_id : Text;
    scope : Text;
    audience : Text;
    expires_at : Time.Time;
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
    clients : Map.Map<Text, Client>;
    resource_servers : Map.Map<Text, ResourceServer>;
    auth_codes : Map.Map<Text, AuthorizationCode>;
    authorize_sessions : Map.Map<Text, AuthorizeSession>;
    uri_to_rs_id : Map.Map<Text, Text>; // Maps resource server URIs to their IDs
    refresh_tokens : Map.Map<Text, RefreshToken>;
  };

  // Re-export HttpParser types that are not exported from the lib.
  public type File = {
    name : Text;
    filename : Text;

    mimeType : Text;
    mimeSubType : Text;

    start : Nat;
    end : Nat;
    bytes : Buffer.Buffer<Nat8>;
  };

  public type Form = {
    get : (Text) -> ?[Text];
    trieMap : TrieMap.TrieMap<Text, [Text]>;
    keys : [Text];

    fileKeys : [Text];
    files : (Text) -> ?[File];
  };

  // Re-export server types for convenience.
  public type Request = Server.Request;
  public type Response = Server.Response;
  public type ResponseClass = Server.ResponseClass;
};
