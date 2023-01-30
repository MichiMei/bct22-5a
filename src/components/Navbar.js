import React, { Component } from 'react';

class Navbar extends Component {

  render() {
    return (
      <nav className="navbar navbar-dark fixed-top bg-secondary flex-md-nowrap p-0 shadow justify-content-center">
        <a className="navbar-brand col-sm-3 col-md-2 mr-0" href="http://localhost:3000/">
          A5 - Alex's Advanced Awesome Automated Auctions
        </a>
        <ul className="navbar-nav px-3">
          <li className="nav-item text-nowrap d-none d-sm-none d-sm-block">
            <small className="text-white"><span id="account">{this.props.account}</span></small>
          </li>
        </ul>
      </nav>
    );
  }
}
export default Navbar;
