'use strict';

module.exports = {
  controllerAs: 'vm',
  bindings: {
    icon: '<',
    src: '<',
    isDisabled: '<',
    label: '<',
    onClick: '&',
  },
  template: require('../templates/annotation-action-button.html'),
};
