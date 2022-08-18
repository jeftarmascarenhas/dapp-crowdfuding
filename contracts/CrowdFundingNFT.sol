// SPDX-License-Identifier: MINT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract CrowdFundingNFT is ERC721 {
    using Strings for uint256;

    address private owner;
    string baseUri =
        "https://ipfs.io/ipfs/QmdNw2KZNrdWLYFhjqu9v4d2cRqRRy5wsD6cF7TPVSvz4q/";
    uint256 tokendIds;

    constructor(string memory _name, string memory _symbol)
        ERC721(_name, _symbol)
    {
        owner = msg.sender;
    }

    function getOwner() external view returns (address) {
        return owner;
    }

    function mintNFT(address _contributer) public {
        tokendIds++;
        _mint(_contributer, tokendIds);
    }

    function totalSupply() public view returns (uint256) {
        return tokendIds;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseUri;
    }

    function tokenURI(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        string memory currentBaseURI = _baseURI();
        return
            bytes(currentBaseURI).length > 0
                ? string(
                    abi.encodePacked(
                        currentBaseURI,
                        _tokenId.toString(),
                        ".json"
                    )
                )
                : "";
    }
}
