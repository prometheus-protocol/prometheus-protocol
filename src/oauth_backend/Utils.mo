import Text "mo:base/Text";
import Types "Types";
import Principal "mo:base/Principal";

module {
  // A helper function to ensure URIs are stored and looked up consistently.
  // It removes all trailing slashes from a URI.
  public func normalize_uri(uri : Text) : Text {
    // trimEnd is idempotent: it does nothing if the pattern is not at the end.
    // This is more robust than checking with endsWith first.
    return Text.trimEnd(uri, #char '/');
  };

  // A helper function to get the issuer URL for the OAuth2 server.
  public func get_issuer(context : Types.Context, req : Types.Request) : Text {
    let host = switch (req.headers.get("host")) {
      case (?values) {
        if (values.size() == 0) {
          Principal.toText(context.self) # "127.0.0.1";
        } else { values[0] };
      };
      case (_) Principal.toText(context.self) # "127.0.0.1";
    };
    let scheme = if (Text.contains(host, #text("127.0.0.1"))) "http" else "https";
    let issuer = scheme # "://" # Principal.toText(context.self) # "." # host;
    return issuer;
  };
};
