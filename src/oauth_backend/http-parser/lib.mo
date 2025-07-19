import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import TrieMap "mo:base/TrieMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat16 "mo:base/Nat16";
import Option "mo:base/Option";
import Text "mo:base/Text";
import Result "mo:base/Result";

import JSON "mo:gt-json/JSON";

import Types "Types";
import Utils "Utils";
import FormData "form-data";
import MultiValueMap "MultiValueMap";

module HttpRequestParser {

    public type HeaderField = Types.HeaderField;
    public type HttpRequest = Types.HttpRequest;
    public type HttpResponse = Types.HttpResponse;
    public type ParsedHttpRequest = Types.ParsedHttpRequest;

    public type File = Types.File;
    public type FormDataType = Types.FormDataType;

    func defaultPort(protocol : Text) : Nat16 {
        if (protocol == "http") { 80 } else { 443 };
    };

    /// Decodes an encoded URL string and returns a `MultiValueMap` with the stored data
    public func parseURLEncodedPairs(encodedStr : Text) : MultiValueMap.MultiValueMap<Text, Text> {
        let encodedPairs = Iter.toArray(Text.tokens(encodedStr, #text("&")));

        let mvMap = MultiValueMap.MultiValueMap<Text, Text>(Text.equal, Text.hash);

        for (encodedPair in encodedPairs.vals()) {
            let pair : [Text] = Iter.toArray(Text.split(encodedPair, #char '='));
            if (pair.size() == 2) {
                let key = pair[0];
                let val = pair[1];

                let decodedKey = Option.get(Utils.decodeURIComponent(key), key);
                let decodedVal = Option.get(Utils.decodeURIComponent(val), val);

                mvMap.add(decodedKey, decodedVal);
            };
        };

        return mvMap;
    };

    /// A key/value interface for parsing URL query strings
    public class SearchParams(queryString : Text) {
        public let original = Text.trimStart(queryString, #char('?'));

        let params : MultiValueMap.MultiValueMap<Text, Text> = parseURLEncodedPairs(original);

        public let trieMap = params.toSingleValueMap();
        public let get = trieMap.get;
        public let keys = Iter.toArray(trieMap.keys());
    };

    public class Headers(headers : [HeaderField]) {
        public let original = headers;
        let mvMap = MultiValueMap.MultiValueMap<Text, Text>(Text.equal, Text.hash);

        for ((_key, value) in headers.vals()) {
            let key = Utils.toLowercase(_key);

            // split and trim comma seperated values
            let valuesIter = Iter.map<Text, Text>(
                Text.split(value, #char ','),
                func(text) {
                    Text.trim(text, #char ' ');
                },
            );

            let values = Iter.toArray(valuesIter);
            mvMap.addMany(key, values);
        };

        public let trieMap : TrieMap.TrieMap<Text, [Text]> = mvMap.freezeValues();

        public func get(_key : Text) : ?[Text] {
            let key = Utils.toLowercase(_key);
            return trieMap.get(key);
        };

        public let keys = Iter.toArray(trieMap.keys());
    };

    public class URL(raw_url : Text, headers : Headers) {

        let raw_domain = switch (headers.get("host")) {
            case (?host_array) if (host_array.size() > 0) host_array[0] else "";
            case (_) "";
        };

        var domain = Option.get(Utils.decodeURIComponent(raw_domain), raw_domain);
        var url = Option.get(Utils.decodeURIComponent(raw_url), raw_url);

        public let original = if (Text.startsWith(url, #text("http")) or not Text.startsWith(url, #char('/'))) {
            url;
        } else {
            domain # url;
        };

        let p = Iter.toArray(Text.tokens(url, #char('#')));

        public let anchor = if (p.size() > 1) {
            url := p[0];
            p[1];
        } else if (p.size() == 1) {
            url := p[0];
            "";
        } else {
            "";
        };

        let re = Iter.toArray(Text.tokens(url, #char('?')));

        let queryString : Text = switch (re.size()) {
            case (0) {
                "";
            };
            case (1) {
                url := re[0];
                "";
            };

            case (_) {
                url := re[0];
                re[1];
            };

        };

        public let queryObj : SearchParams = SearchParams(queryString);

        public let protocol = if (Text.startsWith(url, #text("http://"))) {
            "http";
        } else { "https" };

        if (Text.startsWith(url, #text("https://")) or Text.startsWith(url, #text("http://"))) {
            let split_text = Text.split(url, #char('/'));

            ignore split_text.next(); // "https:" or "http:"
            ignore split_text.next(); // ""

            switch (split_text.next()) {
                case (?_domain) {
                    domain := _domain;
                };
                case (_) { Debug.trap("Improper URL format: " # url) };
            };

            url := "/" # Text.join("/", split_text);

        };

        let authority = Iter.toArray(Text.tokens(domain, #char(':')));
        let (_host, _port) : (Text, Nat16) = switch (authority.size()) {
            case (0) ("", defaultPort(protocol));
            case (1) (authority[0], defaultPort(protocol));
            case (_) (authority[0], Nat16.fromNat(Utils.textToNat(authority[1])));
        };

        public let port = _port;

        public let host = object {
            public let original = _host;
            public let array = Iter.toArray(Text.tokens(_host, #char('.')));
        };

        public let path = object {
            if (Text.startsWith(url, #char('/'))) {
                switch (Text.stripStart(url, #char('/'))) {
                    case (?_url) url := _url;
                    case (_) {};
                };
            };

            let path_iter = Text.split(url, #char('/'));

            public let array = Iter.toArray(path_iter);
            public let original = "/" # Text.join("/", array.vals());
        };

    };

    /// Parses both `url-encoded` and `multipart/form-data` forms
    public func parseForm(blob : Blob, formType : FormDataType) : Result.Result<Types.Form, ()> {
        switch (formType) {
            case (#multipart(boundary)) {

                let parsedForm = FormData.parse(blob, boundary);

                switch (parsedForm) {
                    case (#ok(formObj)) {
                        return #ok(formObj);
                    };

                    case (#err(errorType)) {
                        let errorMsg = switch (errorType) {
                            case (#MissingExitBoundary) "MissingExitBoundary";
                            case (#BoundaryNotDetected) "BoundaryNotDetected";
                            case (#IncorrectBoundary) "IncorrectBoundary";
                            case (#MissingContentName) "MissingContentName";
                            case (#UTF8DecodeError) "UTF8DecodeError";
                        };

                        Debug.print("Error Message: " # errorMsg);

                        #err;
                    };
                };
            };

            case (#urlencoded) {
                let blobText = Text.decodeUtf8(blob);
                switch (blobText) {
                    case (?text) {
                        let result = object {
                            let pairs = parseURLEncodedPairs(text);

                            public let trieMap = pairs.freezeValues();
                            public let keys = Iter.toArray(pairs.keys());
                            public let get = trieMap.get;

                            public let fileKeys : [Text] = [];
                            public func files(key : Text) : ?[File] {
                                return null;
                            };
                        };

                        #ok(result);
                    };
                    case (_) {
                        #err;
                    };
                };
            };
        };
    };

    func isFormData(_contentType : Text) : Bool {
        let contentType = Utils.toLowercase(_contentType);
        Text.startsWith(contentType, #text("multipart/form-data"));
    };

    func isURLEncoded(_contentType : Text) : Bool {
        let contentType = Utils.toLowercase(_contentType);
        Text.startsWith(contentType, #text("application/x-www-form-urlencoded"));
    };

    /// An interface with utility methods for accessing data sent through HTTP Request
    /// #### Inputs
    /// - `blob` - The HTTP Request data stored as a Blob data type
    /// - `contentType` - The content-type value in the HTTP Request headers
    public class Body(blob : Blob, contentType : ?Text) : Types.Body {
        let blobArray = Blob.toArray(blob);

        public let original = blob;
        public let size = blob.size();

        public func text() : Text {
            Option.get(Text.decodeUtf8(blob), "");
        };

        public func bytes(start : Nat, end : Nat) : Buffer.Buffer<Nat8> {
            Utils.arraySliceToBuffer(blobArray, start, end);
        };

        public func deserialize() : ?JSON.JSON {
            JSON.parse(text());
        };

        let formType : ?FormDataType = switch (contentType) {
            case (?conType) {
                if (isFormData(conType)) {
                    let splitText = Iter.toArray(Text.tokens(conType, #text("boundary=")));
                    let boundary = if (splitText.size() == 2) {
                        ?Text.trim(splitText[1], #text("\""));
                    } else {
                        null;
                    };

                    ?#multipart(boundary);
                } else {
                    if (isURLEncoded(conType)) {
                        ?#urlencoded;
                    } else {
                        null;
                    };
                };
            };
            case (_) {
                null;
            };
        };

        let defaultForm = object {
            public let keys : [Text] = [];
            public let trieMap = TrieMap.TrieMap<Text, [Text]>(Text.equal, Text.hash);
            public let get = trieMap.get;

            public let fileKeys : [Text] = [];
            public func files(t : Text) : ?[File] {
                return null;
            };
        };

        var isForm = false;

        public let form : Types.FormObjType = switch (formType) {
            case (?formType) {
                switch (parseForm(blob, formType)) {
                    case (#ok(formObj)) {
                        isForm := true;
                        formObj;
                    };
                    case (_) {
                        defaultForm;
                    };
                };
            };
            case (_) {
                defaultForm;
            };
        };

        /// Returns the blob data as bytes if the data is not a valid form
        public func file() : ?Buffer.Buffer<Nat8> {
            switch (isForm) {
                case (true) {
                    return null;
                };
                case (false) {
                    return ?Utils.arrayToBuffer(blobArray);
                };
            };
        };
    };

    /// Main function for parsing incoming http request in a canister
    public func parse(req : HttpRequest) : Types.ParsedHttpRequest = object {

        public let method = req.method;
        public let headers : Headers = Headers(req.headers);
        public let url : URL = URL(req.url, headers);

        public let body : ?Body = if (method != "GET") {
            let contentTypeValues = headers.get("Content-Type");
            let contentType = switch (contentTypeValues) {
                case (?values) {
                    Array.find<Text>(
                        values,
                        func(val) {
                            if (isFormData(val) or isURLEncoded(val)) {
                                return true;
                            };
                            return false;
                        },
                    );
                };
                case (_) {
                    null;
                };
            };

            ?Body(req.body, contentType);
        } else {
            null;
        };
    };

    public func encodeURIComponent(t : Text) : Text {
        Utils.encodeURIComponent(t);
    };

    public func decodeURIComponent(t : Text) : ?Text {
        Utils.decodeURIComponent(t);
    };

    public func encodeURI(t : Text) : Text {
        Utils.encodeURI(t);
    };

    public func decodeURI(t : Text) : ?Text {
        Utils.decodeURI(t);
    };
};
