'use strict';

var bridgeEvents = require('../../shared/bridge-events');
var { isThirdPartyUser } = require('../util/account-id');
var serviceConfig = require('../service-config');

module.exports = {
  controllerAs: 'vm',

  //@ngInject
  controller: function (bridge, serviceUrl, settings, $window) {
  console.log('here '+this.auth.status+' user name '+this.auth.username);
    this.serviceUrl = serviceUrl;


    function triggerEvent() {
      setInterval(function () {
        document.querySelector('.triggerButton').click();
      }, 500);
    }

    triggerEvent();

    //added for firefox
    this.displayMenu = function () {
      var element = angular.element(document.querySelector('.logMenu'));
      if (element[0].style.visibility == "hidden") {
        element[0].style.visibility = 'visible';
      } else {
        element[0].style.visibility = 'hidden';
      }
    };

    this.isThirdPartyUser = function() {
      return isThirdPartyUser(this.auth.userid, settings.authDomain);
    };

    this.shouldShowLogOutButton = function () {
      if (this.auth.status !== 'logged-in') {
        return false;
      }
      var service = serviceConfig(settings);
      if (service && !service.onLogoutRequestProvided) {
        return false;
      }
      return true;
    };

    this.shouldEnableProfileButton = function () {
      var service = serviceConfig(settings);
      if (service) {
        return service.onProfileRequestProvided;
      }
      return true;
    };

    this.showProfile = function () {
      if (this.isThirdPartyUser()) {
        bridge.call(bridgeEvents.PROFILE_REQUESTED);
        return;
      }
      $window.open(this.serviceUrl('user', {user: this.auth.username}));
    };
  },

  bindings: {
    /**
     * An object representing the current authentication status.
     */
    auth: '<',
    /**
     * Called when the user clicks on the "About this version" text.
     */
    onShowHelpPanel: '&',
    /**
     * Called when the user clicks on the "Log in" text.
     */
    onLogin: '&',
    /**
     * Called when the user clicks on the "Sign Up" text.
     */
    onSignUp: '&',
    /**
     * Called when the user clicks on the "Log out" text.
     */
    onLogout: '&',
    /**
     * Whether or not to use the new design for the control.
     *
     * FIXME: should be removed when the old design is deprecated.
     */
    newStyle: '<',
  },
  template: require('../templates/login-control.html'),
};
