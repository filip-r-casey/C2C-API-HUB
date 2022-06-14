const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const axios = require("axios");

require("dotenv").config();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.set("view engine", "ejs"); //setting view
app.get("/", function (req, res) {
  res.render("pages/index");
});
app.post("/api/search", function (req, res) {
  var lat = req.body.Latitude;
  var lon = req.body.Longitude;
  var height = req.body.HubHeight;
  var wind_surface = req.body.WindSurface;
  var start_date = req.body.start;
  var end_date = req.body.end;
  var begin_year = new Date(start_date).getFullYear();
  var end_year = new Date(end_date).getFullYear();

  // NASA POWER
  var formatted_start_date =
    start_date.slice(0, 4) + start_date.slice(5, 7) + start_date.slice(8, 10);
  var formatted_end_date =
    end_date.slice(0, 4) + end_date.slice(5, 7) + end_date.slice(8, 10);
  if (height < 6) {
    // Sets keyword based on where the height is closest to
    var param = "WS2M";
  } else {
    var param = "WS10M";
  }

  // Wind Toolkit
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
  var begin_year = new Date(start_date).getFullYear();
  var end_year = new Date(end_date).getFullYear();
  var heights = [10, 40, 60, 80, 100, 120, 140, 160, 200];
  var closest = heights.reduce(function (prev, curr) {
    return Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev;
  });

  var wind_key = process.env.WIND_TOOLKIT_API_KEY;
  var email = process.env.EMAIL;
  var nasa = axios.get(
    `https://power.larc.nasa.gov/api/temporal/hourly/point?community=RE&parameters=${param},WSC&latitude=${lat}&longitude=${lon}&start=${formatted_start_date}&end=${formatted_end_date}&format=JSON&wind-elevation=${height}&wind-surface=${wind_surface}`
  );
  var wind_toolkit = axios.get(
    `https://developer.nrel.gov/api/wind-toolkit/v2/wind/wtk-download.json?api_key=${wind_key}&wkt=POINT(${lat} ${lon})&attributes=windspeed_${closest}m,winddirection_${closest}m&names=${spacedList(
      yearRange(begin_year, end_year)
    )}&email=${email}`
  );

  // Open Weather
  var open_weather_key = process.env.OPEN_WEATHER_API_KEY;
  var open_weather = axios.get(
    `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${open_weather_key}`
  );

  // Find compatible sources
  var compatible_sources = [nasa, wind_toolkit, open_weather];
  if (begin_year < 2007 || end_year > 2014) {
    compatible_sources.pop(wind_toolkit);
  }
  if (begin_year < 2001 || wind_surface == "unknown") {
    compatible_sources.pop(nasa);
  }

  // API Call
  if (compatible_sources.length > 0) {
    Promise.allSettled(compatible_sources).then((responses) => {
      if (compatible_sources.indexOf(nasa) >= 0) {
        var nasa_data = responses[compatible_sources.indexOf(nasa)];
        if (nasa_data.status != "fulfilled") {
          var nasa_errors = nasa_data.reason.response.data.errors;
        } else {
          nasa_data =
            responses[compatible_sources.indexOf(nasa)].value.data.properties
              .parameter.WSC;
        }
      }
      if (compatible_sources.indexOf(wind_toolkit >= 0)) {
        var wind_toolkit_data =
          responses[compatible_sources.indexOf(wind_toolkit)];
        wind_toolkit_data = wind_toolkit_data.value.data.outputs.downloadUrl;
        if (wind_toolkit_data.status == "rejected") {
          var wind_toolkit_errors =
            wind_toolkit_data.reason.response.data.errors;
        }
      }
      if (compatible_sources.indexOf(open_weather >= 0)) {
        var open_weather_data =
          responses[compatible_sources.indexOf(open_weather)];
        console.log(open_weather_data);
      }
      res.render("pages/results", {
        NASA: nasa_data,
        NASA_ERR: nasa_errors,
        WIND: wind_toolkit_data,
        WIND_ERR: wind_toolkit_errors,
      });
    });
  } else {
    res.render("pages/errors", { NASA: null, WIND: null });
  }
});
app.listen(3000, function () {
  console.log("Server started on port 3000");
});
