'use strict';

// Selectors that calculate the annotation counts displayed in tab headings
// and determine which tab an annotation should be displayed in.

var countIf = require('./util/array-util').countIf;
var metadata = require('./annotation-metadata');
var uiConstants = require('./ui-constants');

/**
 * Return the tab in which an annotation should be displayed.
 *
 * @param {Annotation} ann
 */
function tabForAnnotation(ann) {
  if (metadata.isOrphan(ann)) {
    return uiConstants.TAB_ORPHANS;
  } else if (metadata.isPageNote(ann)) {
    return uiConstants.TAB_NOTES;
  } else {
    return uiConstants.TAB_ANNOTATIONS;
  }
}

/**
 * Return true if an annotation should be displayed in a given tab.
 *
 * @param {Annotation} ann
 * @param {number} tab - The TAB_* value indicating the tab
 */
function shouldShowInTab(ann, tab) {
  if (metadata.isWaitingToAnchor(ann)) {
    // Until this annotation anchors or fails to anchor, we do not know which
    // tab it should be displayed in.
    return false;
  }
  return tabForAnnotation(ann) === tab;
}

/**
 * Return the max and moy values for complexite, fraicheur and interet attributes.
 *
 * @param {Annotation[]} annotations - List of annotations to display
 */
function getMax(arr) {
    var max;
    var res = {}
    for(var key in arr) {
    //var value = arr[key];
	if (!max || parseInt(arr[key]) > parseInt(max)){
            max = arr[key];
	    res.max = max;
	    res.key = key
	}
    }
    return res;
}

function getMoyenne(arr){
   var somme = 0;
   var indices = 0;
	for(var i=0; i<arr.length; i++) {
	   if(arr[i]!=''){
		somme = somme + arr[i];
		indices = indices + 1;
	   }
	}
    var moyenne = Math.round(somme/indices);
    return moyenne;
}

function get_max_moy(annotations){
        var object_result = {};
	var complexites = [] ;
	var fraicheurs = [] ;
	var rates = [] ;
	var types = [] ;

	annotations.forEach(function(element){
		if(element.complexite != '')
		complexites.push(element.complexite)
		if(element.fraicheur != '')
		fraicheurs.push(element.fraicheur)
		types = types.concat(element.typesContenu);
		rates.push(element.rate);
	});
	var occurrences_complexites = complexites.reduce(function(obj, item) {
		 obj[item] = (obj[item] || 0) + 1;
		 return obj;
	}, {});
	var occurrences_fraicheurs = fraicheurs.reduce(function(obj, item) {
		 obj[item] = (obj[item] || 0) + 1;
		 return obj;
	}, {});
	var occurrences_types = types.reduce(function(obj, item) {
		 obj[item] = (obj[item] || 0) + 1;
		 return obj;
	}, {});

	var maxComplexite = getMax(occurrences_complexites);
	var maxFraicheur = getMax(occurrences_fraicheurs);
	var maxTypes = getMax(occurrences_types);
	var moyenneRate = getMoyenne(rates);
	if(moyenneRate !== parseInt(moyenneRate, 10)){moyenneRate = 0;}
        object_result.maxComplexite = maxComplexite.key;
        object_result.maxFraicheur = maxFraicheur.key;
        object_result.maxTypes = maxTypes.key;
        object_result.moyenneRate = moyenneRate;
	//console.log('object_result = '+JSON.stringify(object_result));
	return object_result;
}

/**
 * Return the counts for the headings of different tabs.
 *
 * @param {Annotation[]} annotations - List of annotations to display
 */
function counts(annotations) {
  var counts = {
    maxComplexite: get_max_moy(annotations).maxComplexite,
    maxFraicheur: get_max_moy(annotations).maxFraicheur,
    maxTypes: get_max_moy(annotations).maxTypes,
    moyenneRates: get_max_moy(annotations).moyenneRate,
    notes: countIf(annotations, metadata.isPageNote),
    annotations: countIf(annotations, metadata.isAnnotation),
    orphans: countIf(annotations, metadata.isOrphan),
    anchoring: countIf(annotations, metadata.isWaitingToAnchor),
  };

  return counts;
}

module.exports = {
  counts: counts,
  shouldShowInTab: shouldShowInTab,
  tabForAnnotation: tabForAnnotation,
};
