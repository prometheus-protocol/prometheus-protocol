import ArrayModule "mo:array/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Char "mo:base/Char";
import Debug "mo:base/Debug";
import Iter "mo:base/Iter";
import MultiValueMap "MultiValueMap";
import Nat "mo:base/Bool";
import Result "mo:base/Result";
import T "Types";
import Text "mo:base/Text";
import Utils "Utils";

module {

    type Buffer<A> = Buffer.Buffer<A>;

    type File = T.File;
    type ParsingError = {
        #MissingExitBoundary;
        #BoundaryNotDetected;
        #IncorrectBoundary;
        #MissingContentName;
        #UTF8DecodeError;
    };

    let NEWLINE : Nat8 = 10;
    let CARRIAGE_RETURN : Nat8 = 13;
    let DASH : Nat8 = 45;

    func trimQuotesAndSpaces(text : Text) : Text {
        Utils.trimQuotes(Utils.trimSpaces((text)));
    };

    // Format
    // Content-Disposition: form-data; name="myFile"; filename="test.txt"
    func parseContentDisposition(buffer : Buffer<Nat8>) : (Text, Text) {
        var line = "";

        var i = 31;
        while (i < buffer.size()) {
            line #= Char.toText(Utils.nat8ToChar(buffer.get(i)));
            i += 1;
        };

        let splitTextArr = Iter.toArray(Text.tokens(line, #char ';'));
        let n = splitTextArr.size();

        var name = "";
        let arr = Iter.toArray(Text.split(splitTextArr[0], #text("name=")));
        if (arr.size() == 2) {
            name := trimQuotesAndSpaces(arr[1]);
        };
        var filename = "";
        if (n > 1) {
            let arr = Iter.toArray(Text.split(splitTextArr[1], #text("filename=")));
            if (arr.size() == 2) {

                filename := trimQuotesAndSpaces(arr[1]);
            };
        };
        (name, filename);
    };

    // Format
    // Content-Type: text/plain
    func parseContentType(buffer : Buffer<Nat8>) : (Text, Text) {
        var line = "";

        var i = 13;
        while (i < buffer.size()) {
            line #= Char.toText(Utils.nat8ToChar(buffer.get(i)));
            i += 1;
        };

        let mime = Iter.toArray(Text.tokens(trimQuotesAndSpaces(line), #char '/'));
        
        if (mime.size() == 0) return ("", "");
        let mimeType = mime[0];
        let mimeSubType = if (mime.size() > 1) {
            mime[1];
        } else { "" };

        (mimeType, mimeSubType);
    };

    func startsWith(a : Buffer<Nat8>, b : Buffer<Nat8>) : Bool {
        if (a.size() < b.size()) return false;

        var i = 0;

        while (i < b.size()) {
            if (a.get(i) != b.get(i)) return false;
            i += 1;
        };

        return true;
    };

    func equals(a : Buffer<Nat8>, b : Buffer<Nat8>) : Bool {
        if (a.size() != b.size()) return false;

        var i = 0;

        while (i < a.size()) {
            if (a.get(i) != b.get(i)) return false;
            i += 1;
        };

        return true;
    };

    func trimEOL(buffer : Buffer<Nat8>) {
        let n = buffer.size();
        if (n == 0) return;

        var i = n;

        while (i > 0 and (buffer.get(i - 1) == NEWLINE or buffer.get(i - 1) == CARRIAGE_RETURN)) {
            ignore buffer.removeLast();
            i -= 1;
        };

    };

    public func parse(blob : Blob, _boundary : ?Text) : Result.Result<T.FormObjType, ParsingError> {
        let blobArray = Blob.toArray(blob);

        let filesMVMap = MultiValueMap.MultiValueMap<Text, File>(Text.equal, Text.hash);
        let fields = MultiValueMap.MultiValueMap<Text, Text>(Text.equal, Text.hash);

        let delim = Buffer.fromArray<Nat8>([DASH, DASH]);

        let boundary = switch (_boundary) {
            case (?bound) {
                let b = Buffer.clone(delim);
                for (c in bound.chars()) {
                    let n8 = Utils.charToNat8(c);
                    b.add(n8);
                };
                b;
            };
            case (_) Buffer.Buffer<Nat8>(32);
        };

        let exitBoundary = if (boundary.size() != 0) {
            let b = Buffer.clone(boundary);
            b.add(DASH);
            b.add(DASH);
            b;
        } else { Buffer.Buffer<Nat8>(32) };

        let line = Buffer.Buffer<Nat8>(100);

        let content_disposition = Buffer.fromArray<Nat8>([0x43, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x2d, 0x44, 0x69, 0x73, 0x70, 0x6f, 0x73, 0x69, 0x74, 0x69, 0x6f, 0x6e, 0x3a]);
        let content_type = Buffer.fromArray<Nat8>([0x43, 0x6f, 0x6e, 0x74, 0x65, 0x6e, 0x74, 0x2d, 0x54, 0x79, 0x70, 0x65, 0x3a]);

        var lineIndexFromBoundary = 0;
        var includesContentType = false;
        var canConcat = true;

        var name = "";
        var filename = "";

        var mimeType = "";
        var mimeSubType = "";

        var start = 0;
        var end = 0;

        var prevLineEnd = 0;
        var is_EOL_LF_CR = false;

        var i = 0;
        var j = 0;

        label l while (j < blobArray.size()) {
            i := j;
            j += 1;

            let char : Nat8 = blobArray[i];
            let isIndexBeforeContent = lineIndexFromBoundary >= 0 and lineIndexFromBoundary <= 2;

            line.add(char);
            let isBoundary = startsWith(boundary, line);
            let isExitBoundary = equals(line, exitBoundary);

            let store = isIndexBeforeContent or isBoundary or isExitBoundary;

            if (canConcat and store) {
                trimEOL(line);
            } else {
                ignore line.removeLast();
                canConcat := false;
            };

            if (char == NEWLINE or char == CARRIAGE_RETURN or equals(line, exitBoundary)) {
                // skips the next char if EOL == '\r\n'
                if (char == CARRIAGE_RETURN and blobArray[i +1] == NEWLINE) {
                    if (is_EOL_LF_CR == false) {
                        is_EOL_LF_CR := true;
                    };

                    j += 1;
                };

                // Get's the boundary from the first line if it wasn't specified
                if (lineIndexFromBoundary == 0) {

                    if (boundary.size() == 0) {
                        if (startsWith(line, delim)) {
                            boundary.append(line);

                            exitBoundary.append(boundary);
                            exitBoundary.append(delim);
                        } else {
                            return #err(#BoundaryNotDetected);
                        };
                    } else {
                        if (not equals(boundary, line)) {
                            return #err(#IncorrectBoundary);
                        };
                    };
                };

                if (lineIndexFromBoundary == 1) {

                    if (startsWith(line, content_disposition)) {
                        let (_name, _filename) = parseContentDisposition(line);
                        name := _name;
                        filename := _filename;
                    } else {
                        return #err(#MissingContentName);
                    };
                };

                if (lineIndexFromBoundary == 2) {

                    if (startsWith(line, content_type)) {
                        let (_mimeType, _mimeSubType) = parseContentType(line);
                        mimeType := _mimeType;
                        mimeSubType := _mimeSubType;

                        includesContentType := true;
                    };
                };

                if (lineIndexFromBoundary == 3 or lineIndexFromBoundary == 4) {

                    if ((not includesContentType) and start == 0) {
                        start := prevLineEnd + (if (is_EOL_LF_CR) { 2 } else { 1 });
                    };
                    includesContentType := false;
                };

                if (lineIndexFromBoundary > 1 and (equals(line, boundary) or equals(line, exitBoundary))) {
                    end := prevLineEnd;

                    // If the field has a filename, add it to files
                    // if it doesn't, add it to fields
                    if (filename != "") {
                        filesMVMap.add(
                            filename,
                            {
                                name = name;
                                filename = filename;

                                mimeType = mimeType;
                                mimeSubType = mimeSubType;

                                start = start;
                                end = end;
                                bytes = Utils.arraySliceToBuffer<Nat8>(blobArray, start, end);
                            },
                        );
                    } else {
                        let value = Utils.arraySliceToText(blobArray, start, end);
                        fields.add(name, value);
                    };

                    lineIndexFromBoundary := 0;

                    name := "";
                    filename := "";

                    mimeType := "";
                    mimeSubType := "";

                    start := 0;
                    end := 0;
                };

                if (equals(line, exitBoundary)) { break l };

                line.clear();
                prevLineEnd := i;
                lineIndexFromBoundary += 1;
                canConcat := true;
            };

        };

        return #ok(
            object {
                public let trieMap = fields.freezeValues();
                public let keys = Iter.toArray(trieMap.keys());
                public let get = trieMap.get;

                let filesMap = filesMVMap.freezeValues();
                public let fileKeys = Iter.toArray(filesMap.keys());
                public func files(name : Text) : ?[File] {
                    filesMap.get(name);
                };
            }
        );
    };
};
