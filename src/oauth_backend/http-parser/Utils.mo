import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Char "mo:base/Char";
import Debug "mo:base/Debug";
import Buffer "mo:base/Buffer";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Nat16 "mo:base/Nat16";
import Nat32 "mo:base/Nat32";
import Option "mo:base/Option";
import Text "mo:base/Text";
import Result "mo:base/Result";

import Hex "mo:gt-encoding/Hex";
import JSON "mo:gt-json/JSON";

module {
  public func textToNat(txt : Text) : Nat {
    assert (txt.size() > 0);
    let chars = txt.chars();
    var num : Nat = 0;
    for (v in chars) {
      let charToNum = Nat32.toNat(Char.toNat32(v) - 48);
      assert (charToNum >= 0 and charToNum <= 9);
      num := num * 10 + charToNum;
    };
    num;
  };

  func charToLowercase(c : Char) : Char {
    if (Char.isUppercase(c)) {
      let n = Char.toNat32(c);

      //difference between the nat32 values of 'a' and 'A'
      let diff : Nat32 = 32;
      return Char.fromNat32(n + diff);
    };

    return c;
  };

  public func toLowercase(text : Text) : Text {
    var lowercase = "";

    for (c in text.chars()) {
      lowercase := lowercase # Char.toText(charToLowercase(c));
    };

    return lowercase;
  };

  public func arrayToBuffer<T>(arr : [T]) : Buffer.Buffer<T> {
    let buffer = Buffer.Buffer<T>(arr.size());
    for (n in arr.vals()) {
      buffer.add(n);
    };
    return buffer;
  };

  public func arraySliceToBuffer<T>(arr : [T], start : Nat, end : Nat) : Buffer.Buffer<T> {
    var i = start;

    let buffer = Buffer.Buffer<T>(end - start);

    while (i < end) {
      buffer.add(arr[i]);
      i += 1;
    };

    return buffer;
  };

  public func arraySliceToText(arr : [Nat8], start : Nat, end : Nat) : Text {
    var i = start;

    var text = "";

    while (i < end) {
      text #= Char.toText(nat8ToChar(arr[i]));
      i += 1;
    };

    text;
  };

  public func nat8ToChar(n8 : Nat8) : Char {
    let n = Nat8.toNat(n8);
    let n32 = Nat32.fromNat(n);
    Char.fromNat32(n32);
  };

  public func charToNat8(char : Char) : Nat8 {
    let n32 = Char.toNat32(char);
    let n = Nat32.toNat(n32);
    let n8 = Nat8.fromNat(n);
  };

  public func enumerate<A>(iter : Iter.Iter<A>) : Iter.Iter<(Nat, A)> {
    var i = 0;
    return object {
      public func next() : ?(Nat, A) {
        let nextVal = iter.next();

        switch nextVal {
          case (?v) {
            let val = ?(i, v);
            i += 1;

            return val;
          };
          case (_) null;
        };
      };
    };
  };

  // A predicate for matching any char in the given text
  func matchAny(text : Text) : Text.Pattern {
    func pattern(c : Char) : Bool {
      Text.contains(text, #char c);
    };

    return #predicate pattern;
  };

  public func trimEOL(text : Text) : Text {
    return Text.trim(text, matchAny("\n\r"));
  };

  public func trimSpaces(text : Text) : Text {
    return Text.trim(text, matchAny("\t "));
  };

  public func trimQuotes(text : Text) : Text {
    return Text.trim(text, #text("\""));
  };

  public func textToBytes(text : Text) : [Nat8] {
    let blob = Text.encodeUtf8(text);
    Blob.toArray(blob);
  };

  public func bytesToText(bytes : [Nat8]) : ?Text {
    Text.decodeUtf8(Blob.fromArray(bytes));
  };

  /// Used to encode the whole URL avoiding avoiding characters that are needed for the URL structure
  public func encodeURI(t : Text) : Text {

    func safe_chars(c : Char) : Bool {
      let nat32_char = Char.toNat32(c);

      let is_safe = if (nat32_char == 45 or nat32_char == 46) {
        // '-' or '.'
        true;
      } else if (nat32_char >= 97 and nat32_char <= 122) {
        // 'a-z'
        true;
      } else if (nat32_char >= 65 and nat32_char <= 90) {
        // 'A-Z'
        true;
      } else if (nat32_char >= 48 and nat32_char <= 57) {
        // '0-9'
        true;
      } else if (nat32_char == 95 or nat32_char == 126) {
        // '_' or '~'
        true;
      } else if (
        //  ';', ',', '/', '?', ':', '@', '&', '=', '+', '$'
        nat32_char == 0x3B or nat32_char == 0x2C or nat32_char == 0x2F or nat32_char == 0x3F or nat32_char == 0x3A or nat32_char == 0x40 or nat32_char == 0x26 or nat32_char == 0x3D or nat32_char == 0x2B or nat32_char == 0x24,
      ) {
        true;
      } else {
        false;
      };

      is_safe;

    };

    var result = "";

    for (c in t.chars()) {
      if (safe_chars(c)) {
        result := result # Char.toText(c);
      } else {
        let utf8 = debug_show Text.encodeUtf8(Char.toText(c));
        let encoded_text = Text.replace(
          Text.replace(utf8, #text("\\"), "%"),
          #text("\""),
          "",
        );

        result := result # encoded_text;
      };
    };

    result;

  };

  public func encodeURIComponent(t : Text) : Text {

    func safe_chars(c : Char) : Bool {
      let nat32_char = Char.toNat32(c);

      let is_safe = if (97 >= nat32_char and nat32_char <= 122) {
        // 'a-z'
        true;
      } else if (65 >= nat32_char and nat32_char <= 90) {
        // 'A-Z'
        true;
      } else if (48 >= nat32_char and nat32_char <= 57) {
        // '0-9'
        true;
      } else if (nat32_char == 95 or nat32_char == 126 or nat32_char == 45 or nat32_char == 46) {
        // '_' or '~' or '-' or '.'
        true;
      } else {
        false;
      };

      is_safe;

    };

    var result = "";

    for (c in t.chars()) {
      if (safe_chars(c)) {
        result := result # Char.toText(c);
      } else {

        let utf8 = debug_show Text.encodeUtf8(Char.toText(c));
        let encoded_text = Text.replace(
          Text.replace(utf8, #text("\\"), "%"),
          #text("\""),
          "",
        );

        result := result # encoded_text;
      };
    };

    result;

  };

  public func subText(value : Text, indexStart : Nat, indexEnd : Nat) : Text {
    if (indexStart == 0 and indexEnd >= value.size()) {
      return value;
    };
    if (indexStart >= value.size()) {
      return "";
    };

    var result : Text = "";
    var i : Nat = 0;
    label l for (c in value.chars()) {
      if (i >= indexStart and i < indexEnd) {
        result := result # Char.toText(c);
      };
      if (i == indexEnd) {
        break l;
      };
      i += 1;
    };

    result;
  };

  public func decodeURIComponent(t : Text) : ?Text {
    let with_spaces = Text.replace(t, #char '+', " ");
    let buffer : Buffer.Buffer<Nat8> = Buffer.Buffer<Nat8>(t.size() * 4);
    let iter = Text.split(with_spaces, #char '%');
    let bytes = Blob.toArray(Text.encodeUtf8(Option.get(iter.next(), "")));
    for (byte in bytes.vals()) { buffer.add(byte) };

    var accumulated_hex = "";

    func extract_hex_bytes(accumulated_hex : Text, last_token : Text) : Bool {
      switch (Hex.decode(accumulated_hex)) {
        case (#ok(utf8_encoding)) {
          for (byte in utf8_encoding.vals()) { buffer.add(byte) };
          let non_decoded = if (last_token.size() < 2) "" else subText(last_token, 2, last_token.size());

          let bytes = Blob.toArray(Text.encodeUtf8(non_decoded));
          for (byte in bytes.vals()) { buffer.add(byte) };

          true; // passed

        };
        case (_) {
          false; // failed
        };
      };
    };

    label decoding_hex for (sp in iter) {
      if (sp.size() == 2) {
        accumulated_hex #= sp;
        continue decoding_hex;
      };

      let hex = subText(sp, 0, 2);
      accumulated_hex #= hex;

      if (not extract_hex_bytes(accumulated_hex, sp)) {
        return null;
      };

      accumulated_hex := "";

    };

    if (accumulated_hex.size() > 0) {
      if (not extract_hex_bytes(accumulated_hex, "")) {
        return null;
      };
    };

    Text.decodeUtf8(Blob.fromArray(Buffer.toArray(buffer)));
  };

  public func decodeURI(t : Text) : ?Text = decodeURIComponent(t);

};
