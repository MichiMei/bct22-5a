// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "./1_Auction.sol";

contract Spawner {

    address[] auctionList;

    function spawnAuction(string memory _auctionTitle, string memory _description, 
    uint _lengthBid, uint  _lengthReveal, uint _lengthClose, uint _minimumBid) public {
        address _spawner = msg.sender;
        Auction auctionContract = new Auction(_auctionTitle, _description, _lengthBid, _lengthReveal, _lengthClose, _spawner, _minimumBid, address(this));
        address auctionAddress = address(auctionContract);
        auctionList.push(auctionAddress);
    }

    function returnMapping() public view returns(address[] memory){
        return auctionList;
    }

    function contains(address auctionAddress) public view returns(int) {
        for(int i = 0; i<int(auctionList.length); i++) {
            if (auctionList[uint(i)] == auctionAddress) {
                return i;
            } 
        }
        return -1;
    }

    function removeAuctionFromList() public {
        int index = contains(msg.sender);
        require(index >= 0, "Not an existing auction");
        auctionList[uint(index)] = auctionList[auctionList.length-1];
        auctionList.pop();
    }


    function retrieveAuctionData(address auctionAddress) public view returns(string memory auctionTitle, string memory auctionDescription, uint auctionMinimumBid){
        Auction auction;
        auction = Auction(auctionAddress);

        auctionTitle = auction.getAuctionTitle();
        auctionDescription = auction.getAuctionDescription();
        auctionMinimumBid = auction.getAuctionMinimumBid();

        return (auctionTitle, auctionDescription, auctionMinimumBid);
    }
	
	
}