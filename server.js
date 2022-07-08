const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const axios = require("axios");
const path = require("path");
const { response } = require("express");
const exp = require("constants");
const { yearRange, spacedList } = require("./src/scripts/utilities");
const { stat } = require("fs");

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

// Front-end
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

// API
app.all("/api", function (req, res) {
  // Parameters: None
  // Returns: JSON
  res.status(200);
  res.json({
    message:
      "Welcome to the Communities to Clean API. For information on using this API, please address the documentation.",
  });
});

app.all("/api/search", function (req, res) {
  // Parameters: Latitude, Longitude, HubHeight, WindSurface, start, end, openWeather, timeStep
  // Returns: JSON
  if (req.method == "GET") {
    var lat = req.query.Latitude;
    var lon = req.query.Longitude;
    var height = req.query.HubHeight;
    var wind_surface = req.query.WindSurface;
    var start_date = req.query.start;
    var end_date = req.query.end;
    var open_weather_bool = req.query.openWeather === "true";
    var time_step = req.query.timeStep;
  } else if (req.method == "POST") {
    var lat = req.body.Latitude;
    var lon = req.body.Longitude;
    var height = req.body.HubHeight;
    var wind_surface = req.body.WindSurface;
    var start_date = req.body.start;
    var end_date = req.body.end;
    var open_weather_bool = req.body.openWeather === "true";
    var time_step = req.body.timeStep;
  } else {
    res.json({ error: "Incompatible method" });
  }
  var nasa = axios.get(
    `http://0.0.0.0:3000/api/search/nasa_power?Latitude=${lat}&Longitude=${lon}&HubHeight=${height}&WindSurface=${wind_surface}&start=${start_date}&end=${end_date}`
  );
  var wind_toolkit = axios.get(
    `http://0.0.0.0:3000/api/search/wind_toolkit?Latitude=${lat}&Longitude=${lon}&HubHeight=${height}&start=${start_date}&end=${end_date}`
  );
  var open_weather = axios.get(
    `http://0.0.0.0:3000/api/search/open_weather?Latitude=${lat}&Longitude=${lon}&HubHeight=${height}&start=${start_date}&end=${end_date}&timeStep=${time_step}`
  );
  var nws = axios.get(
    `http://0.0.0.0:3000/api/search/nws?lat=${lat}&lon=${lon}&start_date=${start_date}&end_date=${end_date}`
  );

  console.log(nws);
  // Alaska Energy Authority API
  // aea = axios.get(
  //   `172.17.0.3/api/search/aea?lat=${lat}&lon=${lon}&height=${height}&start_date=${start_date}&end_date=${end_date}`
  // );

  // Find compatible sources
  var compatible_sources = {
    nasa: nasa,
    wind_toolkit: wind_toolkit,
    nws: nws,
    ...(open_weather_bool && { open_weather: open_weather }),
    // aea: aea,
  };

  // API Call
  if (Object.keys(compatible_sources).length > 0) {
    Promise.allSettled(Array.from(Object.values(compatible_sources))).then(
      (promise_responses) => {
        if ("nasa" in compatible_sources) {
          var nasa_idx = Object.keys(compatible_sources).indexOf("nasa");
          if (promise_responses[nasa_idx].status == "rejected") {
            var nasa_errors =
              promise_responses[nasa_idx].reason.response.data.errors;
          } else {
            var nasa_data = promise_responses[nasa_idx].value.data;
          }
        }
        if ("wind_toolkit" in compatible_sources) {
          var wind_toolkit_idx =
            Object.keys(compatible_sources).indexOf("wind_toolkit");
          var wind_toolkit_data = promise_responses[wind_toolkit_idx];
          if (wind_toolkit_data.status == "fulfilled") {
            wind_toolkit_data = wind_toolkit_data.value.data.url;
          } else {
            var wind_toolkit_errors =
              wind_toolkit_data.reason.response.data.errors;
            wind_toolkit_data = null;
          }
        }
        if ("open_weather" in compatible_sources) {
          var open_weather_idx =
            Object.keys(compatible_sources).indexOf("open_weather");
          var open_weather_data = promise_responses[open_weather_idx];
          if (open_weather_data.status == "fulfilled") {
            open_weather_data = open_weather_data.value.data;
          } else {
            var open_weather_errors =
              open_weather_data.reason.response.data.errors;
            open_weather_errors = null;
          }
        }
        if ("nws" in compatible_sources) {
          var nws_idx = Object.keys(compatible_sources).indexOf("nws");
          if (promise_responses[nws_idx].status == "rejected") {
            var nws_err =
              promise_responses[nws_idx].reason.response.data.errors;
          } else {
            var nws_data = promise_responses[nws_idx].value.data;
          }
        }
        if ("aea" in compatible_sources) {
          var aea_idx = Object.keys(compatible_sources).indexOf("aea");
          if (promise_responses[aea_idx].status == "rejected") {
            var aea_err =
              promise_responses[aea_idx].reason.response.data.errors;
          } else {
            var aea_data = promise_responses[aea_idx].value.data;
          }
        }
        json_response = {
          data_sources: {
            ...((nasa_data != null || nasa_errors != null) && {
              NASA: {
                ...(nasa_data != null && {
                  data: {
                    wind_speed: nasa_data.nasa_speed,
                    wind_direction: nasa_data.nasa_direction,
                  },
                }),
                ...(nasa_errors != null && { errors: nasa_errors }),
              },
            }),
            ...((wind_toolkit_data != null || wind_toolkit_errors != null) && {
              WIND: {
                ...(wind_toolkit_data != null && { data: wind_toolkit_data }),
                ...(wind_toolkit_errors != null && {
                  errors: wind_toolkit_errors,
                }),
              },
            }),
            ...((open_weather_data != null || open_weather_errors != null) && {
              OPEN_WEATHER: {
                ...(open_weather_data != null && { data: open_weather_data }),
                ...(open_weather_errors != null && {
                  errors: open_weather_errors,
                }),
              },
            }),
            ...((nws_data != null || nws_err != null) && {
              NWS: {
                ...(nws_data != null && { data: nws_data }),
                ...(nws_err != null && { errors: nws_err }),
              },
            }),
            ...((aea_data != null || aea_data != null) && {
              AEA: {
                ...(aea_data != null && { data: aea_data }),
                ...(aea_error != null && { errors: aea_err }),
              },
            }),
          },
        };
        res.status(200);
        res.json(json_response);
      }
    );
  } else {
    res.status(400);
    res.json({
      errors: [
        {
          status: 400,
          title: "No compatible sources",
          message:
            "Check requested parameters and ensure that they are compatible with at least one data source",
        },
      ],
    });
  }
});

app.get("/api/search/nasa_power", function (req, res) {
  if (req.method == "GET") {
    var lat = req.query.Latitude;
    var lon = req.query.Longitude;
    var height = req.query.HubHeight;
    var wind_surface = req.query.WindSurface;
    var start_date = req.query.start;
    var end_date = req.query.end;
  } else if (req.method == "POST") {
    var lat = req.body.Latitude;
    var lon = req.body.Longitude;
    var height = req.body.HubHeight;
    var wind_surface = req.body.WindSurface;
    var start_date = req.body.start;
    var end_date = req.body.end;
  } else {
    res.json({ error: "Incompatible method" });
  }
  if (lat && lon && height && wind_surface && start_date && end_date) {
    var formatted_start_date =
      start_date.slice(0, 4) + start_date.slice(5, 7) + start_date.slice(8, 10);
    var formatted_end_date =
      end_date.slice(0, 4) + end_date.slice(5, 7) + end_date.slice(8, 10);
    if (height < 30) {
      // Sets keyword based on where the height is closest to
      var param = "WD50M";
    } else if (height < 6) {
      var param = "WD10M";
    } else {
      var param = "WD2M";
    }
    var nasa = axios.get(
      `https://power.larc.nasa.gov/api/temporal/hourly/point?community=RE&parameters=${param},WSC&latitude=${lat}&longitude=${lon}&start=${formatted_start_date}&end=${formatted_end_date}&format=JSON&wind-elevation=${height}&wind-surface=${wind_surface}`
    );
    nasa
      .then((nasa_response) => {
        var nasa_speed = {};
        var nasa_direction = {};
        if (nasa_response.status != 200) {
          var nasa_errors = nasa_response.reason.response.data.errors;
        } else {
          nasa_data = nasa_response.data.properties.parameter;
          for (const [key, value] of Object.entries(nasa_data.WSC)) {
            nasa_speed[
              new Date(
                parseInt(key.slice(0, 4)),
                parseInt(key.slice(4, 6)) - 1,
                parseInt(key.slice(6, 8)),
                parseInt(key.slice(8, 10))
              ).toISOString()
            ] = value;
            nasa_direction[
              new Date(
                parseInt(key.slice(0, 4)),
                parseInt(key.slice(4, 6)) - 1,
                parseInt(key.slice(6, 8)),
                parseInt(key.slice(8, 10))
              ).toISOString()
            ] = nasa_data[param][key];
          }
        }
        res.json({ nasa_speed: nasa_speed, nasa_direction: nasa_direction });
      })
      .catch((nasa_error) => {
        console.error(nasa_error);
      });
  } else {
    var params = {
      lat: lat,
      lon: lon,
      height: height,
      wind_surface: wind_surface,
      start_date: start_date,
      end_date: end_date,
    };
    var missing_params = [];
    for (const [key, value] of Object.entries(params)) {
      if (value == null) {
        missing_params.push(key);
      }
    }
    if (missing_params.length == Object.keys(params).length) {
      res.status(200);
      res.json({
        message:
          "Welcome to the C2C NASA POWER endpoint. For information on using this endpoint, please address the documentation.",
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
});

app.get("/api/search/wind_toolkit", function (req, res) {
  if (req.method == "GET") {
    var lat = req.query.Latitude;
    var lon = req.query.Longitude;
    var height = req.query.HubHeight;
    var start_date = req.query.start;
    var end_date = req.query.end;
  } else if (req.method == "POST") {
    var lat = req.body.Latitude;
    var lon = req.body.Longitude;
    var height = req.body.HubHeight;
    var start_date = req.body.start;
    var end_date = req.body.end;
  } else {
    res.json({ error: "Incompatible method" });
  }
  var begin_year = new Date(start_date).getFullYear();
  var end_year = new Date(end_date).getFullYear();
  var heights = [10, 40, 60, 80, 100, 120, 140, 160, 200];
  var closest = heights.reduce(function (prev, curr) {
    return Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev;
  });
  var wind_toolkit = axios.get(
    `https://developer.nrel.gov/api/wind-toolkit/v2/wind/wtk-download.json?api_key=${
      process.env.WIND_TOOLKIT_API_KEY
    }&wkt=POINT(${lon} ${lat})&attributes=windspeed_${closest}m,winddirection_${closest}m&names=${spacedList(
      yearRange(begin_year, end_year)
    )}&email=${process.env.EMAIL}`
  );
  wind_toolkit
    .then((wind_toolkit_response) => {
      res.json({ url: wind_toolkit_response.data.outputs.downloadUrl });
    })
    .catch((wind_toolkit_error) => {
      console.error(wind_toolkit_error);
    });
});

app.get("/api/search/open_weather", function (req, res) {
  if (req.method == "GET") {
    var lat = req.query.Latitude;
    var lon = req.query.Longitude;
    var height = req.query.HubHeight;
    var start_date = req.query.start;
    var end_date = req.query.end;
    var time_step = req.query.timeStep;
  } else if (req.method == "POST") {
    var lat = req.body.Latitude;
    var lon = req.body.Longitude;
    var height = req.body.HubHeight;
    var start_date = req.body.start;
    var end_date = req.body.end;
    var time_step = req.body.timeStep;
  } else {
    res.json({ error: "Incompatible method" });
  }
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
        }&appid=${process.env.OPEN_WEATHER_API_KEY}`
      )
    );
  }
  if (open_weather_requests.length > 0) {
    Promise.allSettled(open_weather_requests)
      .then((open_weather_response) => {
        var open_weather_promises = [];
        var open_weather_errors = [];
        for (var i = 0; i < open_weather_response.length; i++) {
          if (open_weather_response[i].status == "fulfilled") {
            if (open_weather_response[i].value.headers.server == "openresty") {
              open_weather_promises.push(open_weather_response[i]);
            }
          } else if (
            open_weather_response[i].reason.response.headers.server ==
            "openresty"
          ) {
            open_weather_errors.push(open_weather_response[i]);
          }
        }
        if (open_weather_errors.length <= 0) {
          open_weather_errors = null;
        }
        open_weather_data["wind_speed"] = {};
        open_weather_data["wind_direction"] = {};
        for (var i = 0; i < open_weather_promises.length; i++) {
          open_weather_data["wind_speed"][
            new Date(
              open_weather_promises[i].value.data.data[0].dt * 1000
            ).toISOString()
          ] = open_weather_promises[i].value.data.data[0].wind_speed;
          open_weather_data["wind_direction"][
            new Date(
              open_weather_promises[i].value.data.data[0].dt * 1000
            ).toISOString()
          ] = open_weather_promises[i].value.data.data[0].wind_deg;
        }
        res.json(open_weather_data);
      })
      .catch((open_weather_error) => {
        console.error(open_weather_error);
      });
  }
});

app.get("/api/search/aea", function (req, res) {
  var start = req.query.start;
  var end = req.query.end;
  var lat = parseInt(req.query.lat);
  var lon = parseInt(req.query.lon);
  var lat_threshold = parseInt(req.query.lat_threshold) || 0;
  var lon_threshold = parseInt(req.query.lon_threshold) || 0;

  axios
    .get(`http://0.0.0.0:8080/wind_speed?lat=${lat}&lon=${lon}`)
    .then((aea_response) => {
      res.json(aea_response);
    })
    .catch((aea_error) => {
      console.log(aea_error);
    });
});

app.all("/api/search/nws", function (req, res) {
  if (req.method == "GET") {
    var lat = req.query.lat;
    var lon = req.query.lon;
    if (req.query.start_date.at(-1) != "Z") {
      var start_date = req.query.start_date + "T00:00:00Z";
      var end_date = req.query.end_date + "T00:00:00Z";
    } else {
      var start_date = req.query.start_date;
      var end_date = req.query.end_date;
    }
  } else if (req.method == "POST") {
    var lat = req.body.lat;
    var lon = req.body.lon;
    if (req.body.start_date.at(-1) != "Z") {
      var start_date = req.body.start_date + "T00:00:00Z";
      var end_date = req.body.end_date + "T00:00:00Z";
    } else {
      var start_date = req.body.start_date;
      var end_date = req.body.end_date;
    }
  }
  var nws_wind_data = {};
  var nws = axios
    .get(`https://api.weather.gov/points/${lat},${lon}`)
    .then((response) => {
      axios
        .get(response.data.properties.observationStations)
        .then((station_response) => {
          var nws_stations_points = {};
          var nws_stations = [];
          for (
            var i = 0;
            i < station_response.data.observationStations.length;
            i++
          ) {
            nws_stations_points[
              station_response.data.features[i].properties.stationIdentifier
            ] =
              station_response.data.features[i].geometry.coordinates.reverse();
            nws_stations.push(
              axios.get(
                `${station_response.data.observationStations[i]}/observations?start=${start_date}&end=${end_date}`
              )
            );
          }
          Promise.allSettled(nws_stations).then((responses) => {
            for (let i = 0; i < responses.length; i++) {
              if (responses[i].status == "rejected") {
                var error_response = {
                  errors: [
                    {
                      status: 400,
                      title: responses[i].reason.response.title,
                      detail: {
                        parameterErrors:
                          responses[i].reason.response.parameterErrors,
                      },
                    },
                  ],
                };
                res.type("application/vnd.api+json");
                res.status(400);
                res.json(error_response);
                return;
              }
            }
            var data_modified = false;
            for (let i = 0; i < responses.length; i++) {
              if (responses[i].value.data.features.length > 0) {
                data_modified = true;
                nws_wind_data[
                  responses[i].value.data.features[0].properties.station
                ] = {};
                nws_wind_data[
                  responses[i].value.data.features[0].properties.station
                ]["wind_speed"] = {};
                nws_wind_data[
                  responses[i].value.data.features[0].properties.station
                ]["wind_direction"] = {};
                nws_wind_data[
                  responses[i].value.data.features[0].properties.station
                ]["proximity"] = [
                  lat -
                    nws_stations_points[
                      responses[
                        i
                      ].value.data.features[0].properties.station.slice(
                        responses[
                          i
                        ].value.data.features[0].properties.station.lastIndexOf(
                          "/"
                        ) + 1
                      )
                    ][0],
                  lon -
                    nws_stations_points[
                      responses[
                        i
                      ].value.data.features[0].properties.station.slice(
                        responses[
                          i
                        ].value.data.features[0].properties.station.lastIndexOf(
                          "/"
                        ) + 1
                      )
                    ][1],
                ];
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
                ]["wind_speed"][
                  new Date(
                    responses[i].value.data.features[j].properties.timestamp
                  ).toISOString()
                ] = nws_wind_speed;
                nws_wind_data[
                  responses[i].value.data.features[j].properties.station
                ]["wind_direction"][
                  new Date(
                    responses[i].value.data.features[j].properties.timestamp
                  ).toISOString()
                ] = nws_wind_direction;
              }
            }
            res.type("application/vnd.api+json");
            if (data_modified) {
              res.status(200);
              res.json({ stations: nws_wind_data });
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

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(3000, function () {
    console.log("Server started on port 3000");
  });
}
module.exports = app;
