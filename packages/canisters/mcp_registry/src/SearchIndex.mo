module {
  public type Service = actor {
    update_index : (namespace : Text, content : Text) -> async ();
  };
};
