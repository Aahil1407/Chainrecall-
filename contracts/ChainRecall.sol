// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ChainRecall {

    address public owner;

    struct Product {
        string batchId;
        string productName;
        string manufacturer;
        uint256 manufactureDate;
        uint256 expiryDate;
        bool recalled;
    }

    mapping(string => Product) public products;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    function registerProduct(
        string memory _batchId,
        string memory _productName,
        string memory _manufacturer,
        uint256 _manufactureDate,
        uint256 _expiryDate
    ) public onlyOwner {

        products[_batchId] = Product(
            _batchId,
            _productName,
            _manufacturer,
            _manufactureDate,
            _expiryDate,
            false
        );
    }

    function updateRecallStatus(
        string memory _batchId,
        bool _recalled
    ) public onlyOwner {

        products[_batchId].recalled = _recalled;
    }

    function getProduct(
        string memory _batchId
    ) public view returns (Product memory) {

        return products[_batchId];
    }
}