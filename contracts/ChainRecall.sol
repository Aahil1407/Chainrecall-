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
        require(
            msg.sender == owner,
            "Only owner can perform this action"
        );
        _;
    }

    function registerProduct(
        string memory _batchId,
        string memory _productName,
        string memory _manufacturer,
        uint256 _manufactureDate,
        uint256 _expiryDate
    ) public onlyOwner {

        // 1. Batch ID cannot be empty
        require(
            bytes(_batchId).length > 0,
            "Batch ID cannot be empty"
        );

        // 2. Product name cannot be empty
        require(
            bytes(_productName).length > 0,
            "Product name cannot be empty"
        );

        // 3. Manufacturer cannot be empty
        require(
            bytes(_manufacturer).length > 0,
            "Manufacturer cannot be empty"
        );

        // 4. Expiry date must be after manufacture date
        require(
            _expiryDate > _manufactureDate,
            "Expiry date must be after manufacture date"
        );

        // 5. Batch ID must be unique
        require(
            bytes(products[_batchId].batchId).length == 0,
            "Batch ID already exists"
        );

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

        require(
            bytes(products[_batchId].batchId).length > 0,
            "Product does not exist"
        );

        products[_batchId].recalled = _recalled;
    }

    function getProduct(
        string memory _batchId
    ) public view returns (Product memory) {

        return products[_batchId];
    }
}