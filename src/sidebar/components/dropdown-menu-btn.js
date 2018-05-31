'use strict';

// @ngInject
function DropdownMenuBtnController($timeout) {
  var self = this;


  //added for firefox
  function displayMenu() {
    var element = angular.element(document.querySelector('.publishMenu'));
    if (element[0].style.visibility == "hidden") {
      element[0].style.visibility = 'visible';
    } else {
      element[0].style.visibility = 'hidden';
    }
  }

  this.toggleDropdown = function($event) {
    displayMenu();
    $event.stopPropagation();
    $timeout(function () {
      self.onToggleDropdown();
    }, 0);
  };
}

module.exports = {
  controller: DropdownMenuBtnController,
  controllerAs: 'vm',
  bindings: {
    isDisabled: '<',
    label: '<',
    dropdownMenuLabel: '@',
    onClick: '&',
    onToggleDropdown: '&',
  },
  template: require('../templates/dropdown-menu-btn.html'),
};
