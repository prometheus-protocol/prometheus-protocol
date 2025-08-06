import Text "mo:base/Text";
import Types "Types";
import Principal "mo:base/Principal";
import Iter "mo:base/Iter";

module {

  type Environment = {
    #local; // Local development environment
    #production; // Production environment
  };

  // A helper function to ensure URIs are stored and looked up consistently.
  public func normalize_uri(uri : Text) : Text {
    return Text.trimEnd(uri, #char '/');
  };

  // --- PRIVATE HELPERS ---

  // Determines the environment based on the host header. This is the core decision-maker.
  private func get_environment(host : Text) : Environment {
    if (Text.contains(host, #text("127.0.0.1")) or Text.contains(host, #text("localhost"))) {
      return #local;
    } else {
      return #production;
    };
  };

  // Safely extracts the host from the request headers, with a fallback for local dev.
  private func get_host_from_req(req : Types.Request) : Text {
    switch (req.headers.get("host")) {
      case (?values) {
        if (values.size() == 0) {
          "127.0.0.1:4943"; // Default for local if header is empty
        } else { values[0] };
      };
      case (_) "127.0.0.1:4943"; // Default for local if header is missing
    };
  };

  // --- PUBLIC HELPERS ---

  /**
   * Builds the correct URL to a route within our SPA, automatically handling
   * the difference between local development and production environments.
   * @param context The canister's context, containing the frontend_canister_id.
   * @param req The incoming HTTP request, used to determine the host.
   * @param route The path within the SPA (e.g., "/login", "/setup").
   * @param session_id The session ID to include as a query parameter.
   * @returns A fully-formed URL.
   */
  public func build_frontend_url(context : Types.Context, req : Types.Request, route : Text, session_id : Text) : Text {
    let host = get_host_from_req(req);
    let frontend_id_text = Principal.toText(context.frontend_canister_id);

    switch (get_environment(host)) {
      case (#production) {
        // Production format: https://<frontend_id>.icp0.io/route?session_id=...
        let spa_host = "https://" # frontend_id_text # ".icp0.io";
        return spa_host # route # "?session_id=" # session_id;
      };
      case (#local) {
        // Local format: http://127.0.0.1:4943/route?canisterId=<frontend_id>&session_id=...
        let spa_host = "http://" # host;
        return spa_host # route # "?canisterId=" # frontend_id_text # "&session_id=" # session_id;
      };
    };
  };

  /**
   * A helper function to get the issuer URL for the OAuth2 server.
   * This version is robust enough to handle both production and local test environments.
   * @param context The canister's context, containing its own Principal (self).
   * @param req The incoming HTTP request, used to determine the host.
   * @returns The issuer URL (e.g., "https://<auth_server_id>.icp0.io").
   */
  public func get_issuer(context : Types.Context, req : Types.Request) : Text {
    let host_from_header = get_host_from_req(req);
    let self_canister_id_text = Principal.toText(context.self);
    var final_host : Text = "";

    switch (get_environment(host_from_header)) {
      case (#production) {
        // In production, the host header is already correct.
        final_host := host_from_header;
        return "https://" # final_host;
      };
      case (#local) {
        // In local dev, we might need to fix the host for E2E tests.
        let canister_id_is_missing = not Text.contains(host_from_header, #text(self_canister_id_text));
        if (canister_id_is_missing) {
          // Prepend the canister ID if it's not in the host string.
          final_host := self_canister_id_text # "." # host_from_header;
        } else {
          final_host := host_from_header;
        };
        return "http://" # final_host;
      };
    };
  };

  /**
   * Converts a canister ID into a "raw" URL for non-certified access.
   * This is useful for bypassing certificate validation when needed.
   * It correctly handles both production and local environments.
   * @param req The incoming HTTP request, used to determine the environment.
   * @param canister_id The Principal of the target canister.
   * @returns A fully-formed raw URL (e.g., "https://<canister_id>.raw.icp0.io").
   */
  public func to_raw_hostname(req : Types.Request) : Text {
    let host = get_host_from_req(req);
    let canister_id = switch (extract_canister_id_from_uri(host)) {
      case (?id) Principal.toText(id);
      case (_) "b77ix-eeaaa-aaaaa-qaada-cai"; // Default for local dev
    };

    switch (get_environment(host)) {
      case (#production) {
        // Production: Use the .raw subdomain.
        return "https://" # canister_id # ".raw.icp0.io";
      };
      case (#local) {
        return "https://" # canister_id # ".raw.localhost:4943";
      };
    };
  };

  /**
   * A private helper to extract a canister ID from a given URI.
   * Handles both production (e.g., https://canister-id.icp0.io) and
   * local (e.g., http://127.0.0.1/?canisterId=canister-id) formats.
   * @param uri The URI to parse.
   * @returns An optional Principal if found, otherwise null.
   */
  public func extract_canister_id_from_uri(uri : Text) : ?Principal {
    // Case 1: Local development format with a query parameter
    if (Text.contains(uri, #text("?canisterId="))) {
      // Split by "?canisterId=" and take the second part
      let parts = Iter.toArray(Text.split(uri, #char '='));
      if (parts.size() > 1) {
        // The canister ID might have other query params after it, so split by '&'
        let canister_id_text = Iter.toArray(Text.split(parts[parts.size() - 1], #char '&'))[0];
        ?Principal.fromText(canister_id_text);
      } else {
        return null;
      };
      // Case 2: Production format with a subdomain
    } else if (Text.contains(uri, #text(".icp0.io")) or Text.contains(uri, #text(".icp-api.io")) or Text.contains(uri, #text(".localhost"))) {
      // Remove the protocol part
      let host_part = Text.replace(Text.replace(uri, #text("https://"), ""), #text("http://"), "");
      // Split by '.' and take the first part
      let parts = Iter.toArray(Text.split(host_part, #char '.'));
      if (parts.size() > 0) {
        let canister_id_text = parts[0];
        return ?Principal.fromText(canister_id_text);
      } else {
        return null;
      };
    } else {
      // Could not determine format
      return null;
    };
  };
};
