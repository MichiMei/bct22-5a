import React, { Component } from 'react';
import './App.css';
import Web3 from 'web3'
import Spawner from '../abis/Spawner.json'
import Auction from '../abis/Auction.json'
import Navbar from './Navbar'
import Main from './Main'

class App extends Component {

	// is called after the component was created
	async componentDidMount() {
		await this.loadWeb3()
		// will check the blockchain every second for updates
		this.timerID = setInterval(
			async () => await this.loadBlockchainData(),
			1000
		);
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

	componentWillUnmount() {
		clearInterval(this.timerID);
	}

	// tries to connect to blockchain via metamask (needs to be active)
	async loadWeb3() {
		if (window.ethereum) {
			window.web3 = new Web3(window.ethereum)
			await window.ethereum.enable()
		} else if (window.web3) {
			window.web3 = new Web3(window.web3.currentProvider)
		} else {
			window.alert('Non-Ethereum browser detected. You should consider trying MetaMask!')
		}
	}

	// gets all necessary data from the blockchain
	async loadBlockchainData() {
		try {
			const web3 = window.web3
			this.setState({ web3 })
			// Load account
			const accounts = await web3.eth.getAccounts()
			this.setState({ account: accounts[0] })
			// Load Spawner
			const networkId = await web3.eth.net.getId()
			const networkData = Spawner.networks[networkId]
			if(networkData) {
				const spawner = new web3.eth.Contract(Spawner.abi, networkData.address)
				this.setState({ spawner })	// Saves spawner to state
				await this.loadAuctions()
				
				this.setState({ loading: false})
			} else {
				window.alert('Spawner contract not deployed to detected network.')
			}
		} catch (e) {
			console.warn("loadBlockchainData:")
			console.warn(e)
		}
	}

	async loadAuctions() {
		// Load auction address list
		var auctionAddresses = await this.state.spawner.methods.returnMapping().call()
		if (auctionAddresses == null) {
			auctionAddresses = []
		}
		var auctionCount = auctionAddresses.length

		if (!this.arraysEqual(this.state.auctionAddresses, auctionAddresses)) {
			this.setState({ auctionCount })
			this.setState({ auctionAddresses })
			// Load action data
			this.setState({ auctionList: [] })
			for (var i = 0; i < auctionCount; i++) {
				const auction = await this.state.spawner.methods.retrieveAuctionData(auctionAddresses[i]).call()
				this.setState({ auctionList: [...this.state.auctionList, auction] })
			}
		}
	}

	arraysEqual(a, b) {
		if (a === b) return true;
		if (a == null || b == null) return false;
		if (a.length !== b.length) return false;

		for (var i = 0; i < a.length; ++i) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	// creates a new auction using the spawner
	createAuction(title, description, bidding_dur, reveal_dur, closed_dur, min_bid) {
		this.setState({ loading: true })
		this.state.spawner.methods.spawnAuction(title, description, bidding_dur, reveal_dur, closed_dur, min_bid)
				.send({ from: this.state.account }).then(
				(value) => {
					this.setState({ loading: false })
				},
				(reason) => {
					window.alert("Create Auction failed!\nCheck log for more information.")
					console.warn("createAuction failed:")
					console.warn(reason)
					this.setState({ loading: false })
				});
		
	}
	
	nextPhase(address, currentPhase) {
		const tmp = parseInt(currentPhase)
		if (isNaN(tmp)) {
			console.warn("Phase " + currentPhase + " could not be parsed")
		} else if (tmp === -1) {
			console.warn("Phase -1 cannot be set")
		} else if (tmp+1 > 3) {
			console.warn("Phase " + currentPhase + " cannot be set")
		} else {
			this.setState({ loading: true })
			const auction = new this.state.web3.eth.Contract(Auction.abi, address)
			auction.methods.setPhase(tmp+1)
					.send({ from: this.state.account }).then(
					(value) => {
						this.setState({ loading: false })
					},
					(reason) => {
						window.alert("Next Phase failed!\nCheck log for more information.")
						console.warn("nextPhase failed:")
						console.warn(reason)
						this.setState({ loading: false })
					})
		}
	}
	
	sendData(address, encData) {
		this.setState({ loading: true })
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		auction.methods.handOverData(encData)
				.send({ from: this.state.account }).then(
				(value) => {
					this.setState({ loading: false })
				},
				(reason) => {
					window.alert("Send Data failed!\nCheck log for more information.")
					console.warn("sendData failed:")
					console.warn(reason)
					this.setState({ loading: false })
				})
	}

	destroyAuction(address) {
		this.setState({ loading: true })
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		auction.methods.destroyContract()
				.send({ from: this.state.account }).then(
				(value) => {
					this.setState({ loading: false })
				},
				(reason) => {
					window.alert("Destroy Auction failed!\nCheck log for more information.")
					console.warn("destroyAuction failed:")
					console.warn(reason)
					this.setState({ loading: false })
				})
	}
	
	bid(address, hash) {
		this.setState({ loading: true })
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		auction.methods.bid(hash)
				.send({ from: this.state.account }).then(
				(value) => {
					this.setState({ loading: false })
				},
				(reason) => {
					window.alert("Bid failed!\nCheck log for more information.")
					console.warn("bid failed:")
					console.warn(reason)
					this.setState({ loading: false })
				})
	}
	
	reveal(address, bid, nonce, pubKey) {
		this.setState({ loading: true })
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		auction.methods.reveal(bid, pubKey, nonce)
				.send({ from: this.state.account, value: bid }).then(
				(value) => {
					this.setState({ loading: false })
				},
				(reason) => {
					window.alert("Reveal failed!\nCheck log for more information.")
					console.warn("reveal failed:")
					console.warn(reason)
					this.setState({ loading: false })
				})
	}
	
	withdraw(address) {
		this.setState({ loading: true })
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		auction.methods.withdrawDeposit()
				.send({ from: this.state.account }).then(
				(value) => {
					this.setState({ loading: false })
				},
				(reason) => {
					window.alert("Withdraw failed!\nCheck log for more information.")
					console.warn("withdraw failed:")
					console.warn(reason)
					this.setState({ loading: false })
				})
	}

	async getHighestBid(address) {
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		const highestBid = await auction.methods.getCurrentHighestBid().call()
		return highestBid
	}

	async getSecondHighestBid(address) {
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		const secondHighestBid = await auction.methods.getSecondHighestBid().call()
		return secondHighestBid
	}

	async getOwner(address) {
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		const owner = await auction.methods.getOwner().call()
		return owner
	}

	async getPhase(address) {
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		const phase = await auction.methods.getCurrentPhase().call()
		return phase
	}
	
	async getEncData(address) {
		const auction = new this.state.web3.eth.Contract(Auction.abi, address)
		const encData = await auction.methods.friendlyRetrieveData().call()
		return encData
	}

	constructor(props) {
		super(props)

		this.state = {
			account: '',
			// implicit spawner
			loading: true,
			auctionCount: 0,
			auctionAddresses: [],
			auctionList: []
		}

		// method bindings to call from form
		this.createAuction = this.createAuction.bind(this)
		this.nextPhase = this.nextPhase.bind(this)
		this.sendData = this.sendData.bind(this)
		this.destroyAuction = this.destroyAuction.bind(this)
		this.bid = this.bid.bind(this)
		this.reveal = this.reveal.bind(this)
		this.withdraw = this.withdraw.bind(this)
		
		this.getHighestBid = this.getHighestBid.bind(this)
		this.getSecondHighestBid = this.getSecondHighestBid.bind(this)
		this.getOwner = this.getOwner.bind(this)
		this.getPhase = this.getPhase.bind(this)
		this.getEncData = this.getEncData.bind(this)
		
		this.loadPersistentBid = this.loadPersistentBid.bind(this)
		this.storePersistentBid = this.storePersistentBid.bind(this)
		this.storePersistentKeys = this.storePersistentKeys.bind(this)
		this.loadPersistentKeys = this.loadPersistentKeys.bind(this)
	}

	storePersistentBid(addressContract, addressOwn, bid, nonce) {
		const key = addressContract + ":" + addressOwn
		const value = bid + ":" + nonce
		
		localStorage.setItem(key, value);
	}
	
	loadPersistentBid(addressContract, addressOwn) {
		const key = addressContract + ":" + addressOwn
		
		const value = localStorage.getItem(key)
		
		return value
	}
	
	storePersistentKeys(addressContract, addressOwn, priKey, pubKey) {
		const key = addressContract + ":" + addressOwn + ":keys"
		const value = priKey + ":" + pubKey
		
		localStorage.setItem(key, value);
	}
	
	loadPersistentKeys(addressContract, addressOwn) {
		const key = addressContract + ":" + addressOwn + ":keys"
		
		const value = localStorage.getItem(key)
		
		return value
	}

	render() {
		return (
			<div>
				<Navbar account={this.state.account} />
				<div className="container-fluid mt-5">
					<div className="row">
						<main role="main" className="col-lg-12 d-flex">
							{ this.state.loading
								? <div id="loader" className="text-center container-fluid"><p className="text-center">
									Loading...<br />Please wait
									</p></div>
								: <Main
									createAuction={this.createAuction}
									nextPhase={this.nextPhase}
									sendData={this.sendData}
									destroyAuction={this.destroyAuction}
									bid={this.bid}
									reveal={this.reveal}
									withdraw={this.withdraw}
									
									getHighestBid={this.getHighestBid}
									getSecondHighestBid={this.getSecondHighestBid}
									getOwner={this.getOwner}
									getPhase={this.getPhase}
									getEncData={this.getEncData}
									
									loadPersistentBid={this.loadPersistentBid}
									storePersistentBid={this.storePersistentBid}
									storePersistentKeys={this.storePersistentKeys}
									loadPersistentKeys={this.loadPersistentKeys}
									
									auctionAddresses={this.state.auctionAddresses}
									auctionList={this.state.auctionList}
									account={this.state.account}
									web3={this.state.web3}/>
							}
						</main>
					</div>
				</div>
			</div>
		);
	}
}

export default App;
