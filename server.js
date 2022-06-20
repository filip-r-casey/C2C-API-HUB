const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const axios = require("axios");
const path = require("path");
const { response } = require("express");
const exp = require("constants");

require("dotenv").config();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());
app.use(
  "/static/scripts/",
  express.static(path.join(__dirname, "/src/scripts"))
);
app.use("/static/styles/", express.static(path.join(__dirname, "/src/styles")));
app.set("views", path.join(__dirname, "/src/views"));
app.set("view engine", "ejs"); //setting view
app.get("/", function (req, res) {
  res.render("pages/index");
});

app.post("/search", function (req, res) {
  var lat = req.body.Latitude;
  var lon = req.body.Longitude;
  var height = req.body.HubHeight;
  var wind_surface = req.body.WindSurface;
  var start_date = req.body.start;
  var end_date = req.body.end;
  var open_weather_bool = req.body.openWeather;
  var time_step = req.body.timeStep;
  axios
    .post("http://0.0.0.0:3000/api/search", {
      Latitude: lat,
      Longitude: lon,
      HubHeight: height,
      WindSurface: wind_surface,
      start: start_date,
      end: end_date,
      openWeather: open_weather_bool,
      timeStep: time_step,
    })
    .then((response) => {
      res.render("pages/results", response["data"]);
    });
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
  var open_weather_bool = req.body.openWeather;
  var time_step = req.body.timeStep;
  var wind_key = process.env.WIND_TOOLKIT_API_KEY;
  var email = process.env.EMAIL;
  var open_weather_key = process.env.OPEN_WEATHER_API_KEY;

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
  var nasa = axios.get(
    `https://power.larc.nasa.gov/api/temporal/hourly/point?community=RE&parameters=${param},WSC&latitude=${lat}&longitude=${lon}&start=${formatted_start_date}&end=${formatted_end_date}&format=JSON&wind-elevation=${height}&wind-surface=${wind_surface}`
  );
  var wind_toolkit = axios.get(
    `https://developer.nrel.gov/api/wind-toolkit/v2/wind/wtk-download.json?api_key=${wind_key}&wkt=POINT(${lon} ${lat})&attributes=windspeed_${closest}m,winddirection_${closest}m&names=${spacedList(
      yearRange(begin_year, end_year)
    )}&email=${email}`
  );
  // Open Weather
  if (open_weather_bool) {
    var first_date = new Date(start_date).getTime();
    var last_date = new Date(end_date).getTime();
    var diffTime = Math.abs(last_date - first_date);
    var increment_time = diffTime / time_step;
    var open_weather_requests = [];
    var open_weather_data = {};
    for (var i = first_date; i < last_date; i += increment_time) {
      open_weather_requests.push(
        axios.get(
          `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${
            i / 1000
          }&appid=${open_weather_key}`
        )
      );
    }
  }

  // National Weather Service
  nws = axios.get(
    `http://0.0.0.0:3000/api/nws?lat=${lat}&lon=${lon}&height=${height}&start_date=${start_date}&end_date=${end_date}`
  );

  // Find compatible sources
  var compatible_sources = { nasa: nasa, wind_toolkit: wind_toolkit, nws: nws };

  if (open_weather_bool) {
    for (let i = 0; i < open_weather_requests.length; i++) {
      compatible_sources["open_weather_" + i] = open_weather_requests[i];
    }
  }
  // API Call
  if (Object.keys(compatible_sources).length > 0) {
    Promise.allSettled(Array.from(Object.values(compatible_sources))).then(
      (responses) => {
        if ("nasa" in compatible_sources) {
          var nasa_idx = Object.keys(compatible_sources).indexOf("nasa");
          var nasa_data = responses[nasa_idx];
          if (nasa_data.status != "fulfilled") {
            var nasa_errors = nasa_data.reason.response.data.errors;
          } else {
            nasa_data = responses[nasa_idx].value.data.properties.parameter.WSC;
          }
        }
        if ("wind_toolkit" in compatible_sources) {
          var wind_toolkit_idx =
            Object.keys(compatible_sources).indexOf("wind_toolkit");
          var wind_toolkit_data = responses[wind_toolkit_idx];
          if (wind_toolkit_data.status == "fulfilled") {
            wind_toolkit_data =
              wind_toolkit_data.value.data.outputs.downloadUrl;
          } else {
            var wind_toolkit_errors =
              wind_toolkit_data.reason.response.data.errors;
          }
        }
        if (open_weather_bool) {
          var open_weather_promises = [];
          var open_weather_errors = [];
          for (var i = 0; i < responses.length; i++) {
            if (responses[i].status == "fulfilled") {
              if (responses[i].value.headers.server == "openresty") {
                open_weather_promises.push(responses[i]);
              }
            } else if (
              responses[i].reason.response.headers.server == "openresty"
            ) {
              open_weather_errors.push(responses[i]);
            }
          }
          for (var i = 0; i < open_weather_promises.length; i++) {
            open_weather_data[open_weather_promises[i].value.data.data[0].dt] =
              {
                wind_speed:
                  open_weather_promises[i].value.data.data[0].wind_speed,
                wind_direction:
                  open_weather_promises[i].value.data.data[0].wind_deg,
              };
          }
        }
        if ("nws" in compatible_sources) {
          var nws_err;
          var nws_data;
          var nws_idx = Object.keys(compatible_sources).indexOf("nws");
          if (responses[nws_idx].status == "rejected") {
            nws_err = responses[nws_idx].reason.response.data.errors;
          } else {
            nws_data = responses[nws_idx].value.data;
          }
        }
        json_response = {
          NASA: {
            data: nasa_data,
            errors: nasa_errors,
          },
          WIND: {
            data: wind_toolkit_data,
            errors: wind_toolkit_errors,
          },
          OPEN_WEATHER: {
            data: open_weather_data,
            errors: open_weather_errors,
          },
          NWS: {
            data: nws_data,
            errors: nws_err,
          },
        };
        res.json(json_response);
      }
    );
  } else {
    res.render("pages/errors", { NASA: null, WIND: null });
  }
});

app.get("/api/nws", function (req, res) {
  var lat = req.query.lat;
  var lon = req.query.lon;
  var height = req.query.heigh;
  var start_date = req.query.start_date + "T00:00:00Z";
  var end_date = req.query.end_date + "T00:00:00Z";
  var nws_wind_data = {};
  var nws = axios
    .get(`https://api.weather.gov/points/${lat},${lon}`)
    .then((response) => {
      axios
        .get(response.data.properties.observationStations)
        .then((station_response) => {
          var nws_stations = [];
          for (
            var i = 0;
            i < station_response.data.observationStations.length;
            i++
          ) {
            nws_stations.push(
              axios.get(
                `${station_response.data.observationStations[i]}/observations/?start=${start_date}&end=${end_date}`
              )
            );
          }
          Promise.allSettled(nws_stations).then((responses) => {
            var data_modified = false;
            for (let i = 0; i < responses.length; i++) {
              if (responses[i].value.data.features.length > 0) {
                data_modified = true;
                nws_wind_data[
                  responses[i].value.data.features[0].properties.station
                ] = {};
              }
              for (
                let j = 0;
                j < responses[i].value.data.features.length;
                j++
              ) {
                const nws_wind_direction =
                  responses[i].value.data.features[j].properties.windDirection
                    .value;
                const nws_wind_speed =
                  responses[i].value.data.features[j].properties.windSpeed
                    .value;
                nws_wind_data[
                  responses[i].value.data.features[j].properties.station
                ][responses[i].value.data.features[j].properties.timestamp] = {
                  wind_speed: nws_wind_speed,
                  wind_direction: nws_wind_direction,
                };
              }
            }
            res.type("application/vnd.api+json");
            if (data_modified) {
              res.status(200);
              res.json(nws_wind_data);
            } else {
              res.status(404);
              var nws_response = {
                errors: [
                  {
                    status: 404,
                    title: "No Data Found",
                    detail:
                      "The National Weather Service does not have data for this time period",
                  },
                ],
              };
              res.json(nws_response);
            }
          });
        })
        .catch((station_error) => {
          res.type("application/vnd.api+json");
          res.status(404);

          res.json(nws_response);
        });
    })
    .catch((error) => {
      nws_response = {
        errors: [
          {
            status: 404,
            title: error.response.data.title,
            detail: error.response.data.detail,
          },
        ],
      };
      res.type("application/vnd.api+json");
      res.status(404).json(nws_response);
    });
});

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
