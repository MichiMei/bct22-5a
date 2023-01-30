# 5a - Alex's Advanced Awesome Automated Auctions
## What is 5a
5a is a simple decentralized auction platform running on the ethereum blockchain. The project uses two different solidity contracts to hold the auctions, a *Spawner* which holds a list of the active auctions and can be used to spawn new ones and *Auction* which handles the process of a single auction and allows users to bid for the offered (virtual) product.
Additionally the project contains a simple react GUI to interact with the spawners.
## Why was it created
5a was created during a university lecture about blockchains at HU-Berlin (Blockchain Technologies 2022). The goal of the project was to create a simple working prototype for a distributed and independent application making use of any blockchain technologies. We had about 4 months for brainstorming, designing and programming our applications.
At the end of the lecture all projects were showcased and rated by the fellow students. In this contest 5a achieved second place.
## Who created it?
* Dániel B.
* Alexander B.
* Alexander H.
* Hans Michel Meissner
## How do the auctions work?
It starts by creating an *Auction* using the *Spawner* (calling *spawnAuction(..)*), giving it a title, description, durations for the auction phases and a minimum bid.

The auction then starts in bidding mode. In this phase a user can place a sealed bid using a sha256 hash of his bidding amount and a nonce. 

After the bidding-phase duration is over, users can reveal their bids, publishing their bid, the nonce and a public key. Additionally the bidder needs to deposit enough funds to the contract to pay for his bid. The auction contract now checks, if the revealed data corresponds to the sealed bid (by hashing the given values) and keeps track of the current highest (and second highest) bidder. 

After the revealing phase ends the closing phase starts. In this phase the seller can hand over the offered data, encrypted using the highest bidders public key (so no one else can use the data), and therefore receives the second highest bid. All other users (except the highest bidder) now can withdraw their deposits and the winner of the auction can get his data and decrypt it using his private key.

As soon as this last phase ends the seller can destroy the contract. During this process the seller gets all remaining deposits (including the value of the second highest bid) and possibly refunded gas for freeing up memory. 
## How to use it?
Connect the metamask browser plugin to the desired ethereum blockchain (e.g. local ganache instance using *truffle-config.js*) and deploy the spawner and auction to the blockchain.
Start the web-gui (using *npm start* or building and deploying it). For this it requires the (newly) created ABIs in the folder */src/abis/*.
Connect to the webpage and metamask should automatically find the spawner contract.
## Problems
During implementation some problems appeared:
1. The seller could cheat by not handing over the data ind the closing phase and instantly destroy the auction as the phase ends. This would hinder the highest bidder from retrieving his deposits (at least the value of the second highest bid). A solution could be to transfer the ownership of the auction to the highest bidder, if the seller does not hand over the data. 
2. The seller could bid (e.g. from different accounts) multiple amounts. In the reveal phase he could reveal a bid slightly below the highest bid and therefore force the highest bidder to pay the highest bid instead of the highest bid.
3. The seller could send over 'trash data'. In this case the highest bidder has no chance to get his bid back. This is hard to prevent without a global trust instance. If there is a way to get the money back as a bidder, this could be misused to get the 'real data' and the bid back. A solution for that could be a more complex system with other users getting involved, checking the data and deciding if the transaction was fine or should get reverted.
