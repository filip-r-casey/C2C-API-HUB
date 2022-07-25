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
    spaced_string += array[i] + ",";
  }
  return spaced_string.trim();
}

function missingParameterMessage(params, res, endpoint_name) {
  var missing_params = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null) {
      missing_params.push(key);
    }
  }
  if (missing_params.length == Object.keys(params).length) {
    res.status(200);
    res.json({
      message: `Welcome to the C2C ${endpoint_name} endpoint. For information on using this endpoint, please address the documentation.`,
    });
  } else {
    res.status(400);
    res.json({
      errors: [
        {
          status: 400,
          title: "Missing parameters",
          detail: `Missing ${missing_params}`,
        },
      ],
    });
  }
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

module.exports = {
  yearRange: yearRange,
  spacedList: spacedList,
  missingParameterMessage: missingParameterMessage,
  isValidDate: isValidDate,
};
