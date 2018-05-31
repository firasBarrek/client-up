'use strict';

// @ngInject
function TagEditorController(tags,store) {

  tags.getAllTags(store);

  //setTimeout(function(){console.log('getAllTags '+getAllTags);},8000);
  this.onTagsChanged = function () {

  //console.log('tags '+JSON.stringify(this.tagList));
  this.tagList.forEach(function(element){
    if (element.text.includes('create new tag')) {
        element.text = element.text.slice(17);
    }
  });
    tags.store(this.tagList);
    var newTags = this.tagList.map(function (item) { return item.text; });
    this.onEditTags({tags: newTags});
  };

  this.autocomplete = function (query) {
    return Promise.resolve(tags.filter(query));
  };

  this.$onChanges = function (changes) {
    if (changes.tags) {
      this.tagList = changes.tags.currentValue.map(function (tag) {
	if(tag.substring(0, 17) == 'create new tag : '){
	tag = tag.slice(17);
	}
        return {text: tag};
      });
    }
  };
}

module.exports = {
  controller: TagEditorController,
  controllerAs: 'vm',
  bindings: {
    tags: '<',
    onEditTags: '&',
  },
  template: require('../templates/tag-editor.html'),
};
