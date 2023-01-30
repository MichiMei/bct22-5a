import React, { Component } from 'react';
//import createHash from 'crypto-js';

class Main extends Component {

	// called after gui creation
	// will refresh every 1000ms
	async componentDidMount() {
		
		this.timerID = setInterval(
			async () => {
				const key = this.state.selectedID
				if (key !== -1) {
					this.getAuctionData(key)
					this.loadBidValues(key)
					this.loadKeys(key)
				}
			},
			1000
		);
	}
	
	// called before gui destruction
	// removes timer (from componentDidMount())
	componentWillUnmount() {
		clearInterval(this.timerID);
	}
	
	formatWeiShort(value) {
		if (value === "n/A") {
			return value
		}
		value = parseInt(value)
		if (value >= Math.pow(10, 18)) {
			// ether
			value = value/Math.pow(10, 16)
			value = Math.round(value)/100
			return this.formatThousandDelim(value) + " Eth"
		} else if (value >= Math.pow(10, 9)) {
			// gwei
			value = value/Math.pow(10, 7)
			value = Math.round(value)/100
			return this.formatThousandDelim(value) + " Gwei"
		} else {
			// wei
			return this.formatThousandDelim(value) + " Wei"
		}	
	}
	
	formatWeiLong(value) {
		if (value === "n/A") {
			return value
		}
		value = parseInt(value)
		const shortValue = this.formatWeiShort(value)
		if (value < Math.pow(10, 9)) {
			return shortValue
		}
		return shortValue + " (" + this.formatThousandDelim(value) + " Wei)"
	}
	
	formatThousandDelim(value) {
		if (value === "n/A") {
			return value
		}
		return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
	}

	// translates phase "id" to name
	getPhaseName(phase) {
		switch(phase) {
			case "n/A":
				return "n/A"
			case "0":
				return "Bidding"
			case "1":
				return "Reveal"
			case "2":
				return "Closed"
			case "3":
				return "Can be killed"
			default:
				console.warn("Bad phase returned by blockchain")
				return "Non existent phase"
		}
	}

	getBetterAddress(address) {
		if (this.props.account === address) {
			return "You"
		} else if (address === "n/A" || address === "0x0000000000000000000000000000000000000000") {
			return "No valid bid revealed yet"
		} else {
			return address
		}
	}

	// user selected auction -> refresh selected auction and data
	selected(key) {
		this.loadBidValues(key)
		this.loadKeys(key)
		this.setState({ selectedID: key })
		this.getOwner(key)
		this.getAuctionData(key)
		this.setState({ randomNonce: null })
	}

	// fetches (changing) values for selected auction from bc
	// if values change, gui should update automatically
	getAuctionData(key) {
		// getPhase
		this.props.getPhase(this.props.auctionAddresses[key])
			.then((value)  => 	{
									if (this.state.phase !== value) {
										this.setState({ phase: value })
									}
								},
				  (reason) =>	{
									console.warn("could not get phase: " + reason)
									this.setState({ phase: "n/A" })
								});
		
		// get current max bet (only in phase 1)
		if (this.state.phase === "1") {
			this.props.getHighestBid(this.props.auctionAddresses[key])
				.then((value)  =>	{
										if (this.state.highestBid !== value[0] ||
												this.state.highestBidder !== value[1]) {
											this.setState({ highestBid: value[0] })
											this.setState({ highestBidder: value[1] })
										}
									},
					  (reason) =>	{
										console.warn("could not get highest bid: " + reason)
										this.setState({ highestBid: "n/A" })
										this.setState({ highestBidder: "n/A" })
									});
		} else {
			this.setState({ highestBid: "n/A" })
			this.setState({ highestBidder: "n/A" })
		}
		
		// get second highest bet (only in phases 2 and 3)
		if (this.state.phase === "2" || this.state.phase === "3") {
			this.props.getSecondHighestBid(this.props.auctionAddresses[key])
				.then((value)  => 	{
										if (this.state.secondBid !== value[0] ||
												this.state.secondBidder !== value[1]) {
											this.setState({ secondBid: value[0] })
											this.setState({ secondBidder: value[1] })
											this.setState({ pubKeyBidder: value[2] })
										}
									},
				      (reason) => 	{
										console.warn("could not get second highest bid: " + reason)
										this.setState({ secondBid: "n/A" })
										this.setState({ secondBidder: "n/A" })
										this.setState({ pubKeyBidder: "n/A" })
									});
		} else {
			this.setState({ secondBid: "n/A" })
			this.setState({ secondBidder: "n/A" })
			this.setState({ pubKeyBidder: "n/A" })
		}
		
		// get encrypted data (only in phase 2 and 3 and after upload)
		if (this.state.phase === "2" || this.state.phase === "3") {
			this.props.getEncData(this.props.auctionAddresses[key])
				.then((value)  => 	{
										var tmp = value
										if (tmp.length === 0) {
											tmp = "n/A"
										} 
										if (this.state.encData !== tmp) {
											this.setState({ encData: tmp })
										}
									},
				      (reason) => 	{
										console.warn("could not get encrypted Data: " + reason)
										this.setState({ encData: "n/A" })
									});
		} else {
			this.setState({ encData: "n/A" })
		}
	}

	getOwner(key) {
		this.props.getOwner(this.props.auctionAddresses[key]).then(
			(value) => 
			{
				this.setState({ owner: value })
			},
			(reason) => {
				console.warn("getOwner failed:")
				console.warn(reason)
			});
	}

	nextPhase(key) {
		this.props.nextPhase(this.props.auctionAddresses[key], this.state.phase)
	}

	sendData(key, unencData) {
		const pubKeyBidder = this.state.pubKeyBidder
		if (pubKeyBidder === "n/A") {
			window.alert("Send Data Failed!\nThe public key of the buyer could not be downloaded.\nPlease try again later.")
			console.warn("Send Data Failed, pubKey seller missing")
			return
		} else {
			var eccrypto = require("eccrypto");
			const pubKey = this.decodeKey(pubKeyBidder)
			eccrypto.encrypt(pubKey, Buffer.from(unencData)).then((encData) => {
				this.props.sendData(this.props.auctionAddresses[key], this.encodeMessage(encData))
			});
		}
	}

	destroyAuction(key) {
		this.props.destroyAuction(this.props.auctionAddresses[key])
	}
	
	// encodes a key to a json
	encodeKey(key) {
		return JSON.stringify(key.toString('hex'))
	}
	
	// decodes a json to a key
	decodeKey(key) {
		var decoded = JSON.parse(key);
		return decoded = Buffer.from(decoded, 'hex')
	}
	
	// encodes an encrypted message to a json
	encodeMessage(encrypted) {
		const json =  JSON.stringify({
			iv: encrypted.iv.toString('hex'),
			ciphertext: encrypted.ciphertext.toString('hex'),
			mac: encrypted.mac.toString('hex'),
			ephemPublicKey: encrypted.ephemPublicKey.toString('hex')
		});
		return json
	}
	
	// decodes a jsonto an encrypted message
	decodeMessage(json) {
		var encrypted = JSON.parse(json);
		encrypted = {
			iv: Buffer.from(encrypted.iv, 'hex'),
			ciphertext: Buffer.from(encrypted.ciphertext, 'hex'),
			mac: Buffer.from(encrypted.mac, 'hex'),
			ephemPublicKey: Buffer.from(encrypted.ephemPublicKey, 'hex')
		}
		return encrypted
	}
	
	// merges two Uint8Arrays
	concatArrays(array0, array1) {
		var mergedArray = new Uint8Array(array0.length + array1.length);
		mergedArray.set(array0);
		mergedArray.set(array1, array0.length);
		return mergedArray
	}
	
	// transforms a clean hexstring to a Uint8Array
	// if string is malformed returns null
	hexStringToUint8Array(hexStr) {
		// remove 0x if present
		if (hexStr.startsWith("0x")) {
			hexStr = hexStr.substring(2)
		}
		
		// transform hex string to byte array (Uint8Array)
		const fromHexString = (hexString) =>
			Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
		
		return fromHexString(hexStr)
	}
	
	// transforms a decimal string to a hex string
	// returns null if malformed
	decimalToHexString(str) {
		// check for valid chars
		if (/[^0-9]/u.test(str)) {
			//window.alert("The input number could not be parsed.\nPlease provide valid input in decimal or hexadecimal.")
			console.warn("input decimal string contains bad characters")
			return null
		}
		const tmp = parseInt(str)
		// check for to big numbers
		if (tmp >= Math.pow(2, 32*8)) {
			//window.alert("The input number is to big.")
			console.warn("input number is far too big")
			return null
		}
		var hexStr = tmp.toString(16)
		hexStr = hexStr.padStart(64, '0');
		return "0x"+hexStr;
	}
	
	// transforms a decimal or hex string to a 'clean' 32 bytes hex string
	// returns null if malformed
	mumberStringToHexString(str) {
		if (!/[^0-9]/u.test(str)) {	// is decimal
			return this.decimalToHexString(str)
		} else {					// try hex
			// remove 0x if present
			if (str.startsWith("0x")) {
				str = str.substring(2)
			}
			// check for length
			if (str.length === 0 || str.length > 64) {
				//window.alert("The input number is invalid.\nPlease try a (up to) 32 byte hexadecimal or decimal.")
				console.warn("Hex string empty or too long")
				return null
			}
			// check for valid chars
			if (/[^a-fA-F0-9]/u.test(str)) {
				//window.alert("The input number could not be parsed.\nPlease provide valid input in decimal or hexadecimal.")
				console.warn("input hex string contains bad characters")
				return null
			}
			// padd hex string to 32 byte
			str = str.padStart(64, '0')
			return "0x"+str
		}
	}
	
	bid(key, bid, nonce) {
		const bidHex = this.mumberStringToHexString(bid)
		if (bidHex === null) {
			window.alert("Invalid bid\nPlease provide a valid decimal or hexadecimal.")
			console.warn("could not parse bid")
			return
		}
		const bidBytes = this.hexStringToUint8Array(bidHex)
		
		const nonceHex = this.mumberStringToHexString(nonce)
		if (nonceHex === null) {
			window.alert("Invalid nonce\nPlease provide a valid decimal or hexadecimal.")
			console.warn("could not parse nonce")
			return
		}
		const nonceBytes = this.hexStringToUint8Array(nonceHex)
		
		const concat = this.concatArrays(bidBytes, nonceBytes)
		
		const { createHash } = require('crypto')
		const hash = createHash('sha256').update(concat).digest('hex');
		
		this.props.bid(this.props.auctionAddresses[key], "0x"+hash)
		
		this.props.storePersistentBid(this.props.auctionAddresses[key], this.props.account, bid, nonce)
	}
	
	reveal(key, bid, nonce, pubKeyBidder) {
		const nonceHex = this.mumberStringToHexString(nonce)
		
		this.props.reveal(this.props.auctionAddresses[key], bid, nonceHex, pubKeyBidder)
	}
	
	withdraw(key) {
		this.props.withdraw(this.props.auctionAddresses[key])
	}
	
	loadBidValues(key) {
		const value = this.props.loadPersistentBid(this.props.auctionAddresses[key], this.props.account)
		if (value === null) {
			this.setState({ restoredBid: "n/A" })
			this.setState({ restoredNonce: "n/A" })
		} else {
			const words = value.split(':')
			if (this.state.restoredBid !== words[0]) {
				this.setState({ restoredBid: words[0] })
			}
			if (this.state.restoredNonce !== words[1]) {
				this.setState({ restoredNonce: words[1] })
			}
		}
		
	}
	
	storeKeys(key, privatKey, publicKey) {
		this.props.storePersistentKeys(this.props.auctionAddresses[key], this.props.account, privatKey, publicKey)
	}
	
	loadKeys(key) {
		const value = this.props.loadPersistentKeys(this.props.auctionAddresses[key], this.props.account)
		if (value === null) {
			this.setState({ ownPrivateKey: null })
			this.setState({ ownPublicKey: null })
		} else {
			const words = value.split(':')
			const priKey = words[0]
			if (this.state.ownPrivateKey !== priKey) {
				this.setState({ ownPrivateKey: priKey })
			}
			const pubKey = words[1]
			if (this.state.ownPublicKey !== pubKey) {
				this.setState({ ownPublicKey: pubKey })
			}
		}
	}
	
	decrypt(privatKey) {
		const encData = this.state.encData
		if (encData === "n/A") {
			window.alert("Decrypting failed!\nPlease wait for the encrypted data.")
			console.log("decrypt failed! encData missing")
		} else {
			var eccrypto = require("eccrypto");
			const priKey = this.decodeKey(privatKey)
			eccrypto.decrypt(priKey, this.decodeMessage(encData)).then(
				(decData) => {
					decData = decData.toString()
					this.setState({ decData })
				},
				(reason) => {
					window.alert("Decryption Error!\nDo you have the correct decryption key?\nCheck log for more information.")
					console.log("decrypt failed! reason:")
					console.log(reason)
				});
		}
	}

	constructor(props) {
		super(props)

		this.state = {
			selectedID: -1,
			owner: "",
			phase: "n/A",
			highestBid: "n/A",
			highestBidder: "n/A",
			secondBid: "n/A",
			secondBidder: "n/A",
			pubKeyBidder: "n/A",
			encData: "n/A",
			decData: "n/A",
			restoredBid: "n/A",
			restoredNonce: "n/A",
			randomNonce: null,
			ownPrivateKey: null,
			ownPublicKey: null
		}
	}

	render() {
		return (
			<div id="content" className="pt-5 bg-secondary container">
			<div className="row justify-content-center">
			<div id="addAuctionDiv" className="col-md-3 p-3 bg-light rounded m-3">
				<h1 align="center">Add Auction</h1>
				<form onSubmit={(event) => {
					event.preventDefault()
					const title = this.auctionTitle.value.trim()
					const description = this.auctionDescription.value.trim()
					const bidding_dur = this.auctionBiddingDuration.value.trim()
					const reveal_dur = this.auctionRevealDuration.value.trim()
					const closed_dur = this.auctionClosedDuration.value.trim()
					const min_bid = this.auctionMinBid.value.trim()
					this.props.createAuction(title, description, bidding_dur, reveal_dur, closed_dur, min_bid)
				}}>
					<div className="form-group mr-sm-2 pb-2">
						<input
							id="auctionTitle"
							type="text"
							ref={(input) => { this.auctionTitle = input }}
							className="form-control"
							placeholder="Auction Title"
						required />
					</div>
					<div className="form-group mr-sm-2 pb-2">
						<input
							id="auctionDescription"
							type="text"
							ref={(input) => { this.auctionDescription = input }}
							className="form-control"
							placeholder="Auction Description"
						required />
					</div>
					<div className="form-group mr-sm-2 pb-2">
						<input
							id="auctionBiddingDuration"
							type="text"
							ref={(input) => { this.auctionBiddingDuration = input }}
							className="form-control"
							placeholder="Duration of Bidding Phase"
						required />
					</div>
					<div className="form-group mr-sm-2 pb-2">
						<input
							id="auctionRevealDuration"
							type="text"
							ref={(input) => { this.auctionRevealDuration = input }}
							className="form-control"
							placeholder="Duration of Reveal Phase"
						required />
					</div>
					<div className="form-group mr-sm-2 pb-2">
						<input
							id="auctionClosedDuration"
							type="text"
							ref={(input) => { this.auctionClosedDuration = input }}
							className="form-control"
							placeholder="Duration of Closed Phase"
						required />
					</div>
					<div className="form-group mr-sm-2 pb-2">
						<input
							id="auctionMinBid"
							type="text"
							ref={(input) => { this.auctionMinBid = input }}
							className="form-control"
							placeholder="Minimum Bid"
						required />
					</div>
					<button type="submit" className="btn btn-primary container-fluid">Add New Auction</button>
				</form>
				</div>

				<div id="auctionListDiv" className="col-md-8 p-3 m-3 bg-light rounded">
				<h1 align="center">Active Auctions</h1>
				<table className="table">
					<thead>
						<tr>
							<th scope="col">#</th>
							<th scope="col">Title</th>
							<th scope="col">Minimum Bid</th>
							<th scope="col">Auction Address</th>
							<th scope="col"></th>
						</tr>
					</thead>
					<tbody id="auctionList">
						{ this.props.auctionList.map((auction, key) => {
							return(
								<tr key={key}>
									<th scope="row">{key.toString()}</th>
									<td>{auction.auctionTitle}</td>
									<td>{this.formatWeiShort(auction.auctionMinimumBid)}</td>
									<td>{this.props.auctionAddresses[key]}</td>
									<td>
										<button className="bg-success text-light border border-success"
											onClick={(event) => {
												this.selected(key)
											}}
										>
											Select
										</button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
				</div>
				</div>
				<p> </p>

				<div id="auctionOverviewDiv" className="p-3 bg-light rounded m-3">
				<h1 align="center">Auction Overview</h1>
				{
					this.state.selectedID === -1
					? 	<p align="center">Please select an auction from the list above</p>

					:	<div>
							<p align="center">
								<b>Selected Auction</b> #{this.state.selectedID} - ({this.props.auctionAddresses[this.state.selectedID]})<br/>
								<b>Owner </b> {
									this.state.owner === this.props.account
									? "You"
									: this.state.owner
								}
							</p>
							<div>
							<h4>Auction Details</h4>
							<p><b>Title:</b> {this.props.auctionList[this.state.selectedID].auctionTitle}</p>
							<p><b>Description: </b>{this.props.auctionList[this.state.selectedID].auctionDescription}</p>
							<p><b>Phase: </b>{this.getPhaseName(this.state.phase)}</p>
							</div>

							{
								/* Current Highest Bid */
								this.state.phase === "1"
								?	<div>
										<h4>Current Highest Bid</h4>
										<p><b>Bid:</b> {this.formatWeiLong(this.state.highestBid)}</p>
										<p><b>Bidder:</b> {
											this.getBetterAddress(this.state.highestBidder)
											
											/*this.state.highestBidder === "0x0000000000000000000000000000000000000000"
											?	"No valid bid revealed yet"
											:	this.state.highestBidder*/
										}</p>
										<p>{}</p>
									</div>
								:	null
							}
							
							{
								/* Winning Bid */
								this.state.phase === "2" || this.state.phase === "3"
								?	<div>
										<h4>Winning Bid</h4>
										<p><b>Price:</b> {this.formatWeiLong(this.state.secondBid)}</p>
										<p><b>Bidder:</b> {
											this.getBetterAddress(this.state.secondBidder)
											
											/*this.state.secondBidder === "0x0000000000000000000000000000000000000000"
											?	"No valid bids. The auction was unsuccessful"
											:	this.state.secondBidder*/
										}</p>
										<p>{}</p>
									</div>
								:	null
							}

							{
								/* Bidding */
								this.state.phase === "0"
								?	<div>
										<h4>Bidding</h4>
										<p><b>Minimum bid:</b> {this.formatWeiLong(this.props.auctionList[this.state.selectedID].auctionMinimumBid)}</p>
										
										<form onSubmit={(event) => {
											event.preventDefault()
											const biddingBid = this.biddingBid.value.trim()
											const biddingNonce = this.biddingNonce.value.trim()
											this.bid(this.state.selectedID, biddingBid, biddingNonce)
										}}>
										
											<div className="form-group mr-sm-2 pb-2">
												<input
													id="biddingBid"
													type="text"
													ref={(input) => {this.biddingBid = input}}
													className="form-control"
													placeholder="input your bid"
												required />
											</div>
											<div className="input-group mr-sm-2 pb-2">
												<input
													id="biddingNonce"
													type="text"
													ref={(input) => {this.biddingNonce = input}}
													className="form-control"
													defaultValue={
														this.state.randomNonce === null
														?	""
														:	this.state.randomNonce
													}
													placeholder="input a nonce or generate"
												required />
												<span className="input-group-btn">
													<button className="btn btn-primary" type="button"
														onClick={(event) => {
															const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
															const random = "0x" + genRanHex(64)
															this.setState({ randomNonce: random })
														}}
													>
														Random
													</button>
												</span>
											</div>
											<button type="submit" className="bg-primary text-light border border-primary">Bid</button>
										</form>

									</div>
								:	null
							}
							
							{
								/* Reveal */
								this.state.phase === "1"
								?	<div>
										<h4>Reveal Bid</h4>
										<form onSubmit={(event) => {
											event.preventDefault()
											const revealBid = this.revealBid.value.trim()
											const revealNonce = this.revealNonce.value.trim()
											const revealPubKey = this.revealPubKey.value
											this.reveal(this.state.selectedID, revealBid, revealNonce, revealPubKey)
										}}>
										
											<div className="form-group mr-sm-2 pb-2">
												<input
													id="revealBid"
													type="text"
													ref={(input) => {this.revealBid = input}}
													className="form-control"
													defaultValue={
														this.state.restoredBid === "n/A"
														?	""
														:	this.state.restoredBid
													}
													placeholder="input your bid (must be the same!)"
												required />
											</div>
											<div className="form-group mr-sm-2 pb-2">
												<input
													id="revealNonce"
													type="text"
													ref={(input) => {this.revealNonce = input}}
													className="form-control"
													defaultValue={
														this.state.restoredNonce === "n/A"
														?	""
														:	this.state.restoredNonce
													}
													placeholder="input the nonce (must be the same!)"
												required />
											</div>
											<div className="input-group mr-sm-2 pb-2">
												<input
													id="revealPubKey"
													type="text"
													ref={(input) => {this.revealPubKey = input}}
													className="form-control"
													onChange={this.onTextChange}
													value={
														this.state.ownPublicKey === null
														?	""
														:	this.state.ownPublicKey
													}
													placeholder="input your public RSA key"
												required readOnly/>
												<span className="input-group-btn">
													<button className="btn btn-primary" type="button"
														onClick={(event) => {
															
															const eccrypto = require("eccrypto");
															const ownPrivateKeyArray = eccrypto.generatePrivate();
															const ownPublicKeyArray = eccrypto.getPublic(ownPrivateKeyArray);
															const ownPrivateKey = this.encodeKey(ownPrivateKeyArray);
															const ownPublicKey = this.encodeKey(ownPublicKeyArray);
															
															this.storeKeys(this.state.selectedID, ownPrivateKey, ownPublicKey)
															this.setState({ ownPrivateKey })
															this.setState({ ownPublicKey })
														}}
													>
														Generate
													</button>
												</span>
											</div>
										
											<button type="submit" className="bg-primary text-light border border-primary">Reveal</button>
										</form>
									</div>
								:	null
							}

							{
								/* Managing */
								this.props.account === this.state.owner
								?	<div>
										<h4>Manage Auction</h4>
										
										{
											/* next button */
											this.state.phase === '0' || this.state.phase === '1' || this.state.phase === '2'
											?	<div>
													<button className="bg-info text-light border border-info"
														onClick={(event) => {
															this.nextPhase(this.state.selectedID)
														}}
													>
														Next Phase
													</button>
												</div>	
											:	null
										}	
										
										<p></p>
										
										{
											/* send data */
											this.state.phase === "2"
											?	<div>
													<form onSubmit={(event) => {
														event.preventDefault()
														const unencData = this.unencData.value
														this.sendData(this.state.selectedID, unencData)
													}}>
													
													
														<div className="form-group mr-sm-2 pb-2">
															<input
																id="sendData"
																type="text"
																ref={(input) => {this.unencData = input}}
																className="form-control"
																placeholder="input unencrypted Data"
															required />
														</div>
														<button className="bg-primary text-light border border-primary">Send Data</button>
													</form>
												</div>
											:	null
										}
										
										<p></p>
										
										{
											/* kill button */
											this.state.phase === "3"
											?	<div>
													<button className="bg-danger text-light border border-danger"
														onClick={(event) => {
															this.destroyAuction(this.state.selectedID)
														}}
													>
														Destroy Auction
													</button>
												</div>
											:	null
										}
										
									</div>
								:	null
							}
							
							{
								/* Auction End */
								(this.state.phase === "2" || this.state.phase === "3")
								?	<div>
										<h4>Auction End</h4>
										{ /* withdraw button */ }
										<button className="bg-info text-light border border-info"
											onClick={(event) => {
												this.withdraw(this.state.selectedID)
											}}
										>
											Withdraw deposits
										</button>
										
										<p><b>Encrypted Data:</b> {
											this.state.encData !== "n/A"
											?	<span>{this.state.encData}</span>
											:	<span>Not yet published by seller</span>
										}</p>
										
										{ /* decrypt form */ }
										<form onSubmit={(event) => {
											event.preventDefault()
											const decPrivatKey = this.decPrivatKey.value
											this.decrypt(decPrivatKey)
										}}>
											<div className="form-group mr-sm-2 pb-2">
												<input
													id="decPrivatKey"
													type="text"
													ref={(input) => {this.decPrivatKey = input}}
													className="form-control"
													value={
														this.state.ownPrivateKey === null
														?	"keyIsNull"
														:	this.state.ownPrivateKey
													}
													placeholder="input the correct RSA private key"
												required readOnly/>
											</div>
											<button type="submit" className="bg-primary text-light border border-primary">Decrypt Data</button>
										</form>
										
										<p><b>Decrypted Data:</b> {
											this.state.decData !== "n/A"
											?	<span>{this.state.decData}</span>
											:	<span>Please wait for seller to publish encrypted data and decrypt</span>
										}</p>
										
									</div>
								:	null
								
							}
							
						</div>
				}
			</div>
			</div>
		);
	}

}

export default Main;
