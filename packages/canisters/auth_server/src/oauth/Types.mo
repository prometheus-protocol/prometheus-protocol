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

  public type PublicResourceServer = {
    resource_server_id : Text;
    name : Text;
    logo_uri : Text;
    uris : [Text];
    scopes : [(Text, Text)];
    accepted_payment_canisters : [Principal];
    service_principals : [Principal]; // List of trusted backend server identities.
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

  public type UpdateResourceServerArgs = {
    resource_server_id : Text; // Required to identify which server to update
    name : ?Text;
    logo_uri : ?Text;
    uris : ?[Text];
    service_principals : ?[Principal];
    scopes : ?[(Text, Text)];
    accepted_payment_canisters : ?[Principal];
    frontend_host : ?Text; // Optional custom frontend host for login redirects.
  };

  // Represents a registered application (a resource server).
  public type Client = {
    client_id : Text;
    owner : Principal;
    client_name : Text;
    logo_uri : Text;
    redirect_uris : [Text];
    status : {
      #active; // The client is fully registered and can be used.
      #pending_activation; // The client is registered but not yet activated.
    };
  };

  // A type to hold all the validated parameters from the original request.
  public type ValidatedAuthorizeRequestParams = {
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    state : ?Text;
    code_challenge : Text;
    code_challenge_method : Text;
    resource : Text;
  };

  // The rich object returned by a successful validation.
  public type ValidatedAuthorizeRequest = {
    params : ValidatedAuthorizeRequestParams;
    resource_server : ResourceServer; // The full, looked-up resource server record.
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
    resource : Text;
  };

  public type AuthorizeSessionStatus = {
    #awaiting_login;
    #awaiting_payment_setup;
    #awaiting_consent;
  };

  // Represents the temporary state during the login flow.
  public type AuthorizeSession = {
    client_id : Text;
    redirect_uri : Text;
    scope : Text;
    state : ?Text;
    expires_at : Time.Time;
    code_challenge : Text;
    code_challenge_method : Text;
    resource : Text;
    var status : AuthorizeSessionStatus;
    var user_principal : ?Principal;

    // Pre-fetched resource server details.
    resource_server_id : Text;
    resource_server_name : Text;
    resource_server_logo : Text;
    spender_principal : Principal;
    accepted_payment_canisters : [Principal];
  };

  public type SessionInfo = {
    resource_server_principal : Principal;
    client_name : Text;
  };

  public type ScopeData = {
    id : Text;
    description : Text;
  };

  public type ConsentData = {
    client_name : Text;
    scopes : [ScopeData]; // List of scopes with descriptions
    logo_uri : Text;
  };

  public type AuthFlowStep = {
    #consent; // User needs to consent to the requested scopes.
    #setup; // User needs to set up payment or other required actions.
  };

  public type LoginConfirmation = {
    next_step : AuthFlowStep;
    consent_data : ConsentData;
    accepted_payment_canisters : [Principal];
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

  // Track in-flight refresh operations to prevent race conditions
  public type PendingRefresh = {
    new_refresh_token : Text; // The newly generated refresh token
    new_access_token : Text; // The newly generated access token
    scope : Text;
    created_at : Time.Time; // When this pending refresh was created
  };

  // The data returned to a developer after successful client registration.
  public type RegistrationResponse = {
    client_id : Text;
    client_name : Text;
    redirect_uris : [Text];
    grant_types : [Text];
  };

  public type Grant = {
    user_principal : Principal;
    resource_server_id : Text;
    scopes : [Text]; // The specific scopes that were granted.
    granted_at : Time.Time;
  };

  // The set of resource server IDs a user has granted access to.
  // We use a Map<Text, Null> to simulate a Set of resource_server_ids
  public type UserGrants = Map.Map<Text, Null>;

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
    user_grants : Map.Map<Principal, UserGrants>;
    pending_refresh_operations : Map.Map<Text, PendingRefresh>; // Track in-flight refresh operations by old token
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
