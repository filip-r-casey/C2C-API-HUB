function yearRange(start_year, end_year) {
  var years = [];
  while (start_year <= end_year) {
    years.push(start_year++);
  }
  return years;
}

function spacedList(array) {
  var spaced_string = "";
  for (var i = 0; i < array.length; i++) {
    spaced_string += array[i] + " ";
  }
  return spaced_string.trim();
}

module.exports = {
  yearRange: yearRange,
  spacedList: spacedList,
};
