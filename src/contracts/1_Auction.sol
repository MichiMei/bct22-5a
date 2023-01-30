// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "./2_Spawner.sol";

contract Auction {
    //Auktionsdaten
    string title;
    string description;
    uint minimumBid;

    //Besitzer
    address seller;
    address spawner_addr;
    Spawner spawner;
    bool dataReceived = false;

    //Höchstgebote
    address highestBidder;
    uint highestBid = 0;
    uint secondHighestBid;
    string highestPubKey;

    //Zeitverwaltung
    uint auctionClose;
    uint revealClose;
    uint closeClose;

    //Datenmappings
    mapping(address => bytes32) private bidHashes;
    mapping(address => uint256) private actualBids; //TEST
    //mapping(address => bytes32) private pubKeys; //TEST
    mapping(address => uint) private balances;

    //Verwaltung der Phase
    enum auctionPhase{Bidding, Reveal, Closed, Free2Kill}
    auctionPhase currentPhase = auctionPhase.Bidding;
    bool manualPhasing = false;

    //Vom seller übergebene Daten
    string soldData;

    //Prüft in welcher Phase die Aktion sich gerade befindet
    modifier inPhase(auctionPhase _phase){require(getCurrentPhase() == _phase, "Wrong auction phase!"); _;}
	modifier betweenPhase(auctionPhase _first, auctionPhase _last) {require(getCurrentPhase() >= _first && getCurrentPhase() <= _last, "Wrong auction phase!"); _;}

    constructor(string memory _title, string memory _description, 
    uint _bidding_duration, uint  _reveal_duration, uint  _closed_duration, 
    address _seller, uint _minimum_bid, address _spawner_addr)
    {
        require(_minimum_bid > 0, "The minimum bid must be 1 Wei");
		title = _title;
        description = _description;
        minimumBid = _minimum_bid;
		secondHighestBid = _minimum_bid;	// If only one bid -> minimumBid must be paied

        seller = _seller;
        spawner_addr = _spawner_addr;
        spawner = Spawner(_spawner_addr);

        //Falls in einer Zeit 0 angegeben wird für Präsentationszwecke,
        //Kann die Phase der Auktion manuell gesteuert werden
        if(_bidding_duration > 0 && _reveal_duration > 0 && _closed_duration > 0){
            auctionClose = block.timestamp + _bidding_duration;
            revealClose = auctionClose + _reveal_duration;
            closeClose = revealClose + _closed_duration;
        }else{
            manualPhasing = true;
        }
    }

    /*
        bidHash is sha256(bid_amount, nonce)
    */
    function bid(bytes32 bidHash) 
    inPhase(auctionPhase.Bidding)
    public returns(bool)
    {
        bidHashes[msg.sender] = bidHash;
        return true;
    }

    /*
        pubKey is the key, the user want's the data (or encryption key) encrypted with
    */
    function reveal(uint256 amount, string memory pubKey, bytes32 nonce)
    inPhase(auctionPhase.Reveal)
    public payable returns(bool)
    {
        
        //Hashprüfung
        bytes32 computedHash = sha256(bytes.concat(bytes32(amount), bytes32(nonce)));
        balances[msg.sender] += msg.value;

        
        require(computedHash == bidHashes[msg.sender], "Wrong bidHash!");
        require(amount >= minimumBid, "You bid too little!");
        require(amount <= balances[msg.sender], "Not enough money paid!");

        //Buchführung
        actualBids[msg.sender] = amount; // TEST
        //pubKeys[msg.sender] = pubKey; //TEST

        if (amount > highestBid){
            secondHighestBid = highestBid;
            highestBid = amount;
            highestBidder = msg.sender;
            highestPubKey = pubKey;

            return true;
        }else if(amount > secondHighestBid){
            secondHighestBid = amount;
        }

        return false;
    }

    /*
        kind of unnecessary
    */
    function placeDeposit() public payable returns(bool){
        balances[msg.sender] += msg.value;
        return true;
    }

    function withdrawDeposit() public 
    betweenPhase(auctionPhase.Closed, auctionPhase.Free2Kill)
    returns(bool){ 
        if(msg.sender == highestBidder){
            if (getCurrentPhase() == auctionPhase.Free2Kill && dataReceived == false) {
				// seller did not transfer data -> return all (remaining) money
				uint returnAmount = balances[msg.sender];
				balances[msg.sender] = 0;
				payable(msg.sender).transfer(returnAmount);
			} else {
				// still in phase closed or seller did transfer data -> return remainder
				uint returnAmount = balances[msg.sender] - secondHighestBid;
				require(balances[msg.sender] - returnAmount >= secondHighestBid, "This should NOT happen!");
				
				balances[msg.sender] -= returnAmount;
				payable(msg.sender).transfer(returnAmount);
				
				return false;
			}
        }else{
            uint returnAmount = balances[msg.sender];
            balances[msg.sender] = 0;
            payable(msg.sender).transfer(returnAmount);
        }

        return true;
    }

    /*
        _data should be encrypted with highestPubKey
    */
    function handOverData(string memory _data) public 
    inPhase(auctionPhase.Closed)
    returns(bool){
        require(msg.sender == seller, "You are not the seller!");	// TODO new
        require(secondHighestBid >= minimumBid, "No one want's to buy your shit!");
        require(dataReceived == false, "You already got your money!");
        dataReceived = true;
        soldData = _data;
        payable(seller).transfer(secondHighestBid);
        return true;
    }

    function retrieveData() public view
    betweenPhase(auctionPhase.Closed, auctionPhase.Free2Kill)
    returns(string memory){

		// commented out so everyone can see the encrypted data
        //require(msg.sender == highestBidder, "You're not the highest bidder!");
        require(dataReceived == true, "Data is not yet handed over!");

        return soldData;
    }
	
	// sends empty data instead of require (caused a error in gui...)
	function friendlyRetrieveData() public view
	betweenPhase(auctionPhase.Closed, auctionPhase.Free2Kill)
    returns(string memory){
		// commented out so everyone can see the encrypted data
		//require(msg.sender == highestBidder, "You're not the highest bidder!");

        return soldData;
	}

    function getCurrentPhase() public view returns(auctionPhase){
        if(manualPhasing){
            return currentPhase;
        }else if(block.timestamp <= auctionClose){
            return auctionPhase.Bidding;
        }else if(block.timestamp <= revealClose){
            return auctionPhase.Reveal;
        }else if(block.timestamp <= closeClose){
            return auctionPhase.Closed;
        }else{
            return auctionPhase.Free2Kill;
        }
    }
	
	// TODO new
	function isManualPhasing() public view returns(bool) {
		return manualPhasing;
	}

    function setPhase(auctionPhase _phase) public returns(bool){
		require(msg.sender == seller, "You are not the seller");	// TODO new
		require(_phase >= currentPhase, "Decreasing phase is forbidden! Could end in undefined behaviour!");	// TODO
        require(manualPhasing, "Not phasing manually!");
        currentPhase = _phase;
        return true;
    }

    function getTest() public view returns(uint){
        return block.timestamp;
    }

    function destroyContract() public 
    inPhase(auctionPhase.Free2Kill)
    {
		require(msg.sender == seller, "You are not the seller");	// TODO new
        spawner.removeAuctionFromList();
        selfdestruct(payable(spawner_addr));
    }

    function getAuctionTitle() public view returns(string memory){
        return title;
    }

    function getAuctionDescription() public view returns(string memory){
        return description;
    }

    function getAuctionMinimumBid() public view returns(uint){
        return minimumBid;
    }
	
	// TODO new
	function getOwner() public view returns(address) {
		return seller;
	}
	
	// TODO new
	// returns current highest bid and address
	function getCurrentHighestBid() public view 
	betweenPhase(auctionPhase.Reveal, auctionPhase.Free2Kill)
	returns(uint, address) {
		return (highestBid, highestBidder);
	}
	
	// TODO new
	// returns auction price (second highest bid) and address and pubKey of winner
	function getSecondHighestBid() public view
	betweenPhase(auctionPhase.Closed, auctionPhase.Free2Kill)
	returns(uint, address, string memory) {
		return (secondHighestBid, highestBidder, highestPubKey);
	}
}