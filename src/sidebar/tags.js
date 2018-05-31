'use strict';

/**
 * @typedef Tag
 * @property {string} text - The label of the tag
 * @property {number} count - The number of times this tag has been used.
 * @property {number} updated - The timestamp when this tag was last used.
 */

/**
 * Service for fetching tag suggestions and storing data to generate them.
 *
 * The `tags` service stores metadata about recently used tags to local storage
 * and provides a `filter` method to fetch tags matching a query, ranked based
 * on frequency of usage.
 */
// @ngInject
function tags(localStorage) {
console.log("tag .js");
  var TAGS_LIST_KEY = 'hypothesis.user.tags.list';
  var TAGS_MAP_KEY = 'hypothesis.user.tags.map';

var listTags;
var listTagsResult;

function cleanTags(){ 
	listTags = listTags.filter(function(elem, index, self) {
        return index === self.indexOf(elem);
        });
	console.log(listTags);
	listTags.forEach(function(element){
	listTagsResult.push({'text':element});
	})
	console.log(JSON.stringify(listTags));
    }

function getAllTags(store){
	listTags = [];
	listTagsResult = [];
	store.search({}).then(function(data){
	data.rows.forEach(function(element){
	  listTags = listTags.concat(element.tags);
	});
	console.log('data = '+JSON.stringify(listTags));
	setTimeout(cleanTags, 2000);
	});
}
    
  /**
   * Return a list of tag suggestions matching `query`.
   *
   * @param {string} query
   * @return {Tag[]} List of matching tags
   */
  function filter(query) {
    //var savedTags = localStorage.getObject(TAGS_LIST_KEY) || [];
    var savedTags = listTags || {};
	      for (var i=savedTags.length-1; i>=0; i--) {
		if(savedTags[i].substring(0, 17) == 'create new tag : '){
			savedTags.splice(i, 1);
 			break;
			}
		}
    console.log(savedTags);
    if(!(savedTags.indexOf(query.toLowerCase()) > -1)){
	savedTags.unshift('create new tag : '+query.toLowerCase());
    }
    console.log('filter '+listTags);
    return savedTags.filter((e) => {
      return e.toLowerCase().indexOf(query.toLowerCase()) !== -1;
    });
  }


  /**
   * Update the list of stored tag suggestions based on the tags that a user has
   * entered for a given annotation.
   *
   * @param {Tag} tags - List of tags.
   */
  function store(tags) {
    // Update the stored (tag, frequency) map.
    console.log('tags'+JSON.stringify(tags));
    //var savedTags = localStorage.getObject(TAGS_MAP_KEY) || {};
    var savedTags = listTagsResult || {};
    tags.forEach((tag) => {
      if (savedTags[tag.text]) {
        savedTags[tag.text].count += 1;
        savedTags[tag.text].updated = Date.now();
      } else {
        savedTags[tag.text] = {
          text: tag.text,
          count: 1,
          updated: Date.now(),
        };
      }
    });
    //localStorage.setObject(TAGS_MAP_KEY, savedTags);

    // Sort tag suggestions by frequency.
    var tagsList = Object.keys(savedTags).sort((t1, t2) => {
      if (savedTags[t1].count !== savedTags[t2].count) {
        return savedTags[t2].count - savedTags[t1].count;
      }
      return t1.localeCompare(t2);
    });
    //localStorage.setObject(TAGS_LIST_KEY, tagsList);
  }

  return {
    filter,
    store,
    getAllTags,
  };
}

module.exports = tags;
