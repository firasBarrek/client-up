'use strict';

module.exports = {
  controllerAs: 'vm',
  controller: function () {


    //added for firefox
    this.displayMenu = function () {
      var element = angular.element(document.querySelector('.sortMenu'));
      if (element[0].style.visibility == "hidden") {
        element[0].style.visibility = 'visible';
      } else {
        element[0].style.visibility = 'hidden';
      }
    };

},
  bindings: {
    /** The name of the currently selected sort key. */
    sortKey: '<',
    /** A list of possible keys that the user can opt to sort by. */
    sortKeysAvailable: '<',
    /** Called when the user changes the sort key. */
    onChangeSortKey: '&',
  },
  template: require('../templates/sort-dropdown.html'),
};
