const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const axios = require("axios");
const path = require("path");
const { response: prevailing_response } = require("express");
const exp = require("constants");
const pgp = require("pg-promise")();
const swaggerUI = require("swagger-ui-express");
const YAML = require("yamljs");
const swaggerDocument = YAML.load("./api/swagger/swagger.yaml");
const {
  yearRange,
  spacedList,
  missingParameterMessage,
  isValidDate,
} = require("./src/scripts/utilities");
const {
  nasa_power_call,
  nasa_power_response_parse,
  nasa_power_error_parse,
  wind_toolkit_call,
  wind_toolkit_response_parse,
  wind_toolkit_error_parse,
  open_weather_call,
  open_weather_response_parse,
} = require("./src/scripts/endpoints");
const { stat } = require("fs");

import { createApp } from "vue";
import App from "./src/App.vue";

createApp(App).mount("#app");

const HOST = "0.0.0.0";
const credentials = {
  host: HOST,
  port: 5432,
  database: "root",
  user: "root",
  password: "root",
};
const db = pgp(credentials);

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
app.use("/docs", swaggerUI.serve, swaggerUI.setup(swaggerDocument));

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
    })
    .catch((error) => {
      console.error(error);
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
    var start_date = new Date(req.query.start).toISOString();
    var end_date = new Date(req.query.end).toISOString();
    var open_weather_bool = req.query.openWeather === "true";
    var time_step = req.query.timeStep;
  } else if (req.method == "POST") {
    var lat = String(req.body.Latitude);
    var lon = String(req.body.Longitude);
    var height = String(req.body.HubHeight);
    var wind_surface = req.body.WindSurface;
    var start_date = new Date(req.body.start).toISOString();
    var end_date = new Date(req.body.end).toISOString();
    var open_weather_bool = req.body.openWeather === "true";
    var time_step = req.body.timeStep;
  } else {
    res.json({ error: "Incompatible method" });
  }

  // NASA
  nasa_promise = nasa_power_call(
    lat,
    lon,
    height,
    wind_surface,
    start_date,
    end_date,
    res
  );

  // var wind_toolkit = axios.get(
  //   `http://0.0.0.0:3000/api/search/wind_toolkit?Latitude=${lat}&Longitude=${lon}&HubHeight=${height}&start=${start_date}&end=${end_date}`
  // );
  // var open_weather = axios.get(
  //   `http://0.0.0.0:3000/api/search/open_weather?Latitude=${lat}&Longitude=${lon}&HubHeight=${height}&start=${start_date}&end=${end_date}&timeStep=${time_step}`
  // );
  // var nws = axios.get(
  //   `http://0.0.0.0:3000/api/search/nws?Latitude=${lat}&Longitude=${lon}&start=${start_date}&end=${end_date}`
  // );

  // //Alaska Energy Authority API
  // aea = axios.get(
  //   `http://0.0.0.0:3000/api/search/aea/wind_speed?lat=${lat}&lon=${lon}&height=${height}&start_date=${start_date}&end_date=${end_date}`
  // );

  // Find compatible sources
  var compatible_sources = {
    nasa: nasa_promise,
    // wind_toolkit: wind_toolkit,
    // nws: nws,
    // ...(open_weather_bool && { open_weather: open_weather }),
    // aea: aea,
  };

  // // console.log(
  // //   `http://0.0.0.0:3000/api/search/nasa_power?Latitude=${lat}&Longitude=${lon}&HubHeight=${height}&WindSurface=${wind_surface}&start=${start_date}&end=${end_date}`
  // // );
  // // console.log(
  // //   `http://0.0.0.0:3000/api/search/wind_toolkit?Latitude=${lat}&Longitude=${lon}&HubHeight=${height}&start=${start_date}&end=${end_date}`
  // // );
  // // console.log(
  // //   `http://0.0.0.0:3000/api/search/nws?Latitude=${lat}&Longitude=${lon}&start=${start_date}&end=${end_date}`
  // // );
  // // console.log(
  // //   `http://0.0.0.0:3000/api/search/aea/wind_speed?lat=${lat}&lon=${lon}&height=${height}&start_date=${start_date}&end_date=${end_date}`
  // // );

  // API Call
  if (Object.keys(compatible_sources).length > 0) {
    Promise.allSettled(Array.from(Object.values(compatible_sources))).then(
      (promise_responses) => {
        if ("nasa" in compatible_sources) {
          var nasa_idx = Object.keys(compatible_sources).indexOf("nasa");
          if (promise_responses[nasa_idx] == "rejected") {
            nasa_error = nasa_power_error_parse(
              promise_responses[nasa_idx].reason
            );
          } else {
            nasa_data = nasa_power_response_parse(response);
          }
          // var nasa_idx = Object.keys(compatible_sources).indexOf("nasa");
          // if (promise_responses[nasa_idx].status == "rejected") {
          //   var nasa_errors =
          //     promise_responses[nasa_idx].reason.response.data.errors;
          // } else {
          //   var nasa_data = promise_responses[nasa_idx].value.data;
          // }
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
          var aea_data = null;
          var aea_err = null;
          if (promise_responses[aea_idx].status == "rejected") {
            aea_err = promise_responses[aea_idx].reason.response.data.errors;
          } else {
            aea_data = promise_responses[aea_idx].value.data;
          }
        }
        json_response = {
          data_sources: {
            ...((nasa_data != null || nasa_errors != null) && {
              NASA: {
                ...(nasa_data != null && {
                  data: {
                    wind_speed: nasa_data.wind_speed,
                    wind_direction: nasa_data.wind_direction,
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
                ...(aea_err != null && { errors: aea_err }),
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
    var req_path = "query";
  } else if (req.method == "POST") {
    var req_path = "body";
  } else {
    res.json({ error: "Incompatible method" });
  }
  var lat = req[req_path].Latitude;
  var lon = req[req_path].Longitude;
  var height = req[req_path].HubHeight;
  var wind_surface = req[req_path].WindSurface;
  var start_date = req[req_path].start;
  var end_date = req[req_path].end;
  params = {
    Latitude: lat,
    Longitude: lon,
    HubHeight: height,
    WindSurface: wind_surface,
    start: start_date,
    end: end_date,
  };
  if (!(lat && lon && height && wind_surface && start_date && end_date)) {
    missingParameterMessage(params, res, "/nasa_power");
    return;
  }
  nasa_promise = nasa_power_call(
    lat,
    lon,
    height,
    wind_surface,
    start_date,
    end_date,
    res
  );
  if (nasa_promise) {
    nasa_promise
      .then((response) => {
        json_response = nasa_power_response_parse(response);
        res.status(json_response["status"]);
        res.json(json_response["response"]);
      })
      .catch((error) => {
        json_error = nasa_power_error_parse(error);
        res.status(json_error["status"]);
        res.json(json_error["response"]);
      });
  } else {
    return;
  }
});

app.get("/api/search/wind_toolkit", function (req, res) {
  if (req.method == "GET") {
    var req_path = "query";
  } else if (req.method == "POST") {
    var req_path = "body";
  } else {
    res.json({ error: "Incompatible method" });
  }
  var lat = req[req_path].Latitude;
  var lon = req[req_path].Longitude;
  var height = req[req_path].HubHeight;
  var start_date = req[req_path].start;
  var end_date = req[req_path].end;
  var params = {
    Latitude: lat,
    Longitude: lon,
    HubHeight: height,
    start: start_date,
    end: end_date,
  };
  if (!(lat && lon && height && start_date && end_date)) {
    missingParameterMessage(params, res, "/nasa_power");
    return;
  }

  if (isValidDate(new Date(start_date)) && isValidDate(new Date(start_date))) {
    if (lat > -90 && lat < 90 && lon > -180 && lon < 180) {
      var wind_toolkit = wind_toolkit_call(
        lat,
        lon,
        height,
        start_date,
        end_date
      );
    } else {
      res.status(400);
      res.json({
        errors: [
          {
            status: 400,
            title: "Coordinates out of range",
            detail:
              "Latitude must be within -90 and 90, and Longitude must be within -180 and 180",
          },
        ],
      });
    }
  } else {
    res.status(400);
    res.json({
      errors: [
        {
          status: 400,
          title: "Invalid Date",
          detail: "Date must be in the format YYYY-MM-DDT00:00:00Z",
        },
      ],
    });
    return;
  }
  wind_toolkit
    .then((wind_toolkit_response) => {
      json_response = wind_toolkit_response_parse(wind_toolkit_response);
      res.status(json_response["status"]);
      res.json(json_response["response"]);
    })
    .catch((wind_toolkit_error) => {
      json_error = wind_toolkit_error_parse(wind_toolkit_error);
      res.status(json_error["status"]);
      res.json(json_error["response"]);
    });
});

app.get("/api/search/open_weather", function (req, res) {
  if (req.method == "GET") {
    var req_path = "query";
  } else if (req.method == "POST") {
    var req_path = "body";
  } else {
    res.json({ error: "Incompatible method" });
  }
  var lat = req[req_path].Latitude;
  var lon = req[req_path].Longitude;
  var height = req[req_path].HubHeight;
  var start_date = req[req_path].start;
  var end_date = req[req_path].end;
  var time_step = req[req_path].timeStep;

  if (!(lat && lon && height && start_date && end_date && time_step)) {
    var params = {
      Latitude: lat,
      Longitude: lon,
      HubHeight: height,
      start: start_date,
      end: end_date,
      timeStep: time_step,
    };
    missingParameterMessage(params, res);
    return;
  }
  var open_weather_data = {};
  open_weather_requests = open_weather_call(
    lat,
    lon,
    height,
    start_date,
    end_date,
    time_step
  );
  if (open_weather_requests.length > 0) {
    Promise.allSettled(open_weather_requests).then((open_weather_response) => {
      var json_response = open_weather_response_parse(open_weather_response);
      res.status(json_response["status"]);
      res.json(json_response["response"]);
    });
  }
});

// Alaska Energy Authority
app.get("/api/search/aea/sites/coord_search", (req, res) => {
  var lat = parseInt(req.query.lat);
  var lon = parseInt(req.query.lon);
  var lat_threshold = parseInt(req.query.lat_threshold);
  var lon_threshold = parseInt(req.query.lon_threshold);
  var site_response = {};

  db.any(
    "SELECT * FROM aea_sites WHERE (latitude BETWEEN $1 and $2) AND (longitude BETWEEN $3 AND $4)",
    [
      lat - lat_threshold,
      lat + lat_threshold,
      lon - lon_threshold,
      lon + lon_threshold,
    ]
  )
    .then((response) => {
      site_response = response;
      res.setHeader("Content-Type", "application/json");
      res.status(200);
      res.json({ sites: site_response });
    })
    .catch((error) => {
      res.status(404);
      res.json(error);
    });
});

app.get("/api/search/aea/sites/name_search", (req, res) => {
  var name = req.query.name;
  db.any("SELECT * FROM aea_sites WHERE site_name = $1", [name])
    .then((response) => {
      var site_response = response;
      res.setHeader("Content-Type", "application/json");
      res.status(200);
      res.json({ sites: site_response });
    })
    .catch((error) => {
      res.status(404);
      res.json(error);
    });
});

app.get("/api/search/aea/wind_speed", (req, res) => {
  function parseWindResponse(prevailing_response, historic_response) {
    var response_json = {};
    var months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    for (let i = 0; i < prevailing_response.length; i++) {
      if (!(prevailing_response[i]["site_name"] in response_json)) {
        response_json[prevailing_response[i]["site_name"]] = {
          latitude: prevailing_response[i]["latitude"],
          longitude: prevailing_response[i]["longitude"],
          elevation: prevailing_response[i]["elevation"],
          altitude: prevailing_response[i]["altitude"],
          prevailing_data: {
            prevailing_direction: {
              January: {},
              February: {},
              March: {},
              April: {},
              May: {},
              June: {},
              July: {},
              August: {},
              September: {},
              October: {},
              November: {},
              December: {},
            },
            speed_for_prevailing: {
              January: {},
              February: {},
              March: {},
              April: {},
              May: {},
              June: {},
              July: {},
              August: {},
              September: {},
              October: {},
              November: {},
              December: {},
            },
          },
        };
      } else {
        response_json[prevailing_response[i]["site_name"]]["prevailing_data"][
          "prevailing_direction"
        ][months[prevailing_response[i]["month"] - 1]][
          prevailing_response[i]["hour"]
        ] = prevailing_response[i]["prevailing_direction"];
        response_json[prevailing_response[i]["site_name"]]["prevailing_data"][
          "speed_for_prevailing"
        ][months[prevailing_response[i]["month"] - 1]][
          prevailing_response[i]["hour"]
        ] = prevailing_response[i]["speed_for_prevailing"];
      }
    }
    for (let i = 0; i < historic_response.length; i++) {
      if (
        !("historic_data" in response_json[historic_response[i]["site_name"]])
      ) {
        response_json[historic_response[i]["site_name"]]["historic_data"] = {
          wind_speed: {},
        };
      }
      if (
        !(
          historic_response[i].year in
          response_json[historic_response[i]["site_name"]]["historic_data"][
            "wind_speed"
          ]
        )
      ) {
        response_json[historic_response[i]["site_name"]]["historic_data"][
          "wind_speed"
        ][historic_response[i].year] = {};
      }
      response_json[historic_response[i]["site_name"]]["historic_data"][
        "wind_speed"
      ][historic_response[i].year][months[historic_response[i].month - 1]] =
        historic_response[i].wind_speed;
    }
    return response_json;
  }
  if (req.query.sites == null && req.query.lat == null) {
    res.setHeader("Content-Type", "application/json");
    res.status(400);
    res.json({
      status: 400,
      title: "Insufficient request",
      message:
        "A request must include either a list of sites, or a location with latitude and longitude",
    });
  }
  if (req.query.sites != null) {
    var sites = req.query.sites.split(",");
  }
  var start = req.query.start;
  var end = req.query.end;
  var lat = parseInt(req.query.lat);
  var lon = parseInt(req.query.lon);
  var lat_threshold = parseInt(req.query.lat_threshold) || 1;
  var lon_threshold = parseInt(req.query.lon_threshold) || 1;

  if (sites == null && lat != null && lon != null) {
    // Condition to search for sites if they are not provided
    db.multi(
      `SELECT * FROM aea_sites
    INNER JOIN aea_prevailing_direction_data ON aea_sites.site_name = aea_prevailing_direction_data.site_name
    WHERE (latitude BETWEEN $1 and $2) AND (longitude BETWEEN $3 and $4);SELECT * FROM aea_sites
    INNER JOIN aea_historic_wind_data ON aea_sites.site_name = aea_historic_wind_data.site_name
    WHERE (latitude BETWEEN $1 and $2) AND (longitude BETWEEN $3 and $4);`,
      [
        lat - lat_threshold,
        lat + lat_threshold,
        lon - lon_threshold,
        lon + lon_threshold,
      ]
    )
      .then((responses) => {
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({ sites: parseWindResponse(responses[0], responses[1]) });
      })
      .catch((error) => {
        console.error(error);
      });
  } else if (sites != null) {
    db.multi(
      `SELECT * FROM aea_sites INNER JOIN aea_prevailing_direction_data ON aea_sites.site_name = aea_prevailing_direction_data.site_name WHERE aea_sites.site_name IN ($1:list); SELECT * FROM aea_sites INNER JOIN aea_historic_wind_data ON aea_sites.site_name = aea_historic_wind_data.site_name WHERE aea_sites.site_name IN ($1:list);`,
      [sites]
    )
      .then((responses) => {
        res.setHeader("Content-Type", "application/json");
        res.status(200);
        res.json({ sites: parseWindResponse(responses[0], responses[1]) });
      })
      .catch((error) => {
        console.error(error);
      });
  }
});

app.all("/api/search/nws", function (req, res) {
  if (req.method == "GET") {
    var lat = req.query.Latitude;
    var lon = req.query.Longitude;
    if (req.query.start.charAt(req.query.start.length - 1) != "Z") {
      var start_date = req.query.start + "T00:00:00Z";
      var end_date = req.query.end + "T00:00:00Z";
    } else {
      var start_date = req.query.start;
      var end_date = req.query.end;
    }
  } else if (req.method == "POST") {
    var lat = req.body.Latitude;
    var lon = req.body.Longitude;
    if (req.body.start.charAt(req.body.start.length - 1) != "Z") {
      var start_date = req.body.start + "T00:00:00Z";
      var end_date = req.body.end + "T00:00:00Z";
    } else {
      var start_date = req.body.start;
      var end_date = req.body.end;
    }
  }
  if (lat && lon && start_date && end_date) {
    var nws_wind_data = {};
    var config = {
      headers: {
        header1: "application/geo+json",
      },
    };
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
                station_response.data.features[
                  i
                ].geometry.coordinates.reverse();
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
                            responses[i].reason.response.data.parameterErrors,
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
  } else {
    var params = {
      Latitude: lat,
      Longitude: lon,
      start: start_date,
      end: end_date,
    };
    missingParameterMessage(params, res);
  }
});

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(3000, function () {
    console.log("Server started on port 3000");
  });
}
module.exports = app;
