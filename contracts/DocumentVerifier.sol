// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentVerifier {
    struct Document {
        bytes32 fileHash;
        bool isValid;
        address owner;
    }

    mapping(bytes32 => Document) public documents;

    function verifyDocument(bytes32 hash, bool validity) public {
        documents[hash] = Document(hash, validity, msg.sender);
    }

    function getDocument(bytes32 hash) public view returns (bytes32, bool, address) {
        Document memory doc = documents[hash];
        return (doc.fileHash, doc.isValid, doc.owner);
    }
}
