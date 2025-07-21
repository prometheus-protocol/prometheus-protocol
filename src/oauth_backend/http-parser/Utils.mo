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

  // Helper function to check if a character is a valid hexadecimal digit.
  private func isHexDigit(c : Char) : Bool {
    return (c >= '0' and c <= '9') or (c >= 'a' and c <= 'f') or (c >= 'A' and c <= 'F');
  };

  /**
   * A robust implementation of decodeURIComponent that correctly handles all edge cases,
   * including double-encoding (e.g., %25).
   *
   * It iterates through the source bytes, building a new buffer. When it encounters a '%',
   * it looks ahead two characters, validates them as hex, decodes them, and appends the
   * resulting byte. Otherwise, it appends characters literally.
   */
  public func decodeURIComponent(encoded : Text) : ?Text {
    let sourceBytes = Blob.toArray(Text.encodeUtf8(encoded));
    let decodedBuffer = Buffer.Buffer<Nat8>(sourceBytes.size());
    var i = 0;

    label parseBytes while (i < sourceBytes.size()) {
      let byte = sourceBytes[i];

      // MODIFIED: Compare the byte directly with the Nat8 value for '%', which is 37.
      if (byte == (37 : Nat8)) {
        // Check if there are at least two characters to look ahead.
        if (i + 2 < sourceBytes.size()) {
          // MODIFIED: Use Char.fromNat32 to convert bytes back to Chars for checking.
          let char1 = Char.fromNat32(Nat16.toNat32(Nat8.toNat16(sourceBytes[i + 1])));
          let char2 = Char.fromNat32(Nat16.toNat32(Nat8.toNat16(sourceBytes[i + 2])));

          // Check if both lookahead characters are valid hex digits.
          if (isHexDigit(char1) and isHexDigit(char2)) {
            // If they are, decode the two-character hex string.
            let hexString = Text.fromChar(char1) # Text.fromChar(char2);
            switch (Hex.decode(hexString)) {
              case (#ok(decodedByteBlob)) {
                if (decodedByteBlob.size() == 1) {
                  decodedBuffer.add(decodedByteBlob[0]);
                  i += 3; // Advance index past the '%' and the two hex digits.
                  continue parseBytes;
                };
              };
              case (#err(_)) { /* Unreachable */ };
            };
          };
        };
        // If the '%' is not followed by two valid hex digits, treat it as a literal character.
        decodedBuffer.add(byte);
        i += 1;
      } else {
        // Not a '%', so just add the byte literally.
        decodedBuffer.add(byte);
        i += 1;
      };
    };

    return Text.decodeUtf8(Blob.fromArray(Buffer.toArray(decodedBuffer)));
  };

  public func decodeURI(t : Text) : ?Text = decodeURIComponent(t);

};
