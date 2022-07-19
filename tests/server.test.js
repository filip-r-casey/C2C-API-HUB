const request = require("supertest");
const { response } = require("../server");
const app = require("../server");

function paramRemove(request_url, params) {
  var remove_param = params[Math.floor(Math.random() * params.length)];
  if (
    request_url.substring(request_url.indexOf(remove_param)).indexOf("&") > 0
  ) {
    request_url = request_url.replace(
      request_url.substring(
        request_url.indexOf(remove_param),
        request_url.substring(request_url.indexOf(remove_param)).indexOf("&") +
          request_url.indexOf(remove_param) +
          1
      ),
      ""
    );
  } else {
    request_url = request_url.replace(
      request_url.substring(
        request_url.indexOf(remove_param),
        request_url.length
      ),
      ""
    );
  }
  return request_url;
}
function daysAgo(days) {
  var today = new Date();
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - days,
    today.getHours(),
    today.getSeconds(),
    today.getMilliseconds()
  ).toISOString();
}

describe("General", () => {
  it("GET /api/ --> welcome message", () => {
    return request(app).get("/api/").expect(200).expect("Content-Type", /json/);
  });
});

// Tests concerning the implementation of the NASA POWER API
describe("NASA POWER API", () => {
  // Checks that when any random, necessary parameter is missing an error is returned
  it("GET /api/search/nasa_power --> missing parameters", () => {
    var params = [
      "Latitude",
      "Longitude",
      "HubHeight",
      "WindSurface",
      "start",
      "end",
    ];
    var request_url = paramRemove(
      "/api/search/nasa_power?Latitude=42&Longitude=-110&HubHeight=40&WindSurface=vegtype_2&start=2022-05-05T21:14:33Z&end=2022-07-07T21:14:33Z",
      params
    );
    return request(app)
      .get(request_url)
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body.errors[0]).toMatchObject({
          title: "Missing parameters",
        });
      });
  });

  // Any point that does not exist returns a message about an invalid point
  it("GET /api/search/nasa_power --> invalid point", () => {
    return request(app)
      .get(
        "/api/search/nasa_power?Latitude=400&Longitude=300&height=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z&HubHeight=50&WindSurface=vegtype_1"
      )
      .expect(422) // NASA sends Unprocessable Enitity for a non-existing coordinate
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 422,
                title:
                  "The POWER Hourly API failed to complete your request; please review the errors below and the POWER Docs (https://power.larc.nasa.gov/docs/).",
                detail: expect.stringMatching("^Please provide a correct"),
              }),
            ]),
          })
        );
      });
  });

  // Even points devoid of data will return information
  it("GET /api/search/nasa_power --> normally inaccessible point", () => {
    return request(app)
      .get(
        "/api/search/nasa_power?Latitude=-83&Longitude=5&height=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z&HubHeight=50&WindSurface=vegtype_1"
      )
      .expect(200)
      .expect("Content-Type", /json/);
  });

  // When data is requested for a time period that is not available through NASA, an error should be returned
  it("GET /api/search/nasa_power --> no available data for time period", () => {
    return request(app)
      .get(
        "/api/search/nasa_power?Latitude=39&Longitude=-105&height=50&start=1965-04-05T01:01:01Z&end=1970-06-06T01:01:01Z&HubHeight=50&WindSurface=vegtype_1"
      )
      .expect(422)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 422,
                title:
                  "The POWER Hourly API failed to complete your request; please review the errors below and the POWER Docs (https://power.larc.nasa.gov/docs/).",
                detail: expect.stringMatching("Your start date out of range."),
              }),
            ]),
          })
        );
      });
  });

  // Checks that error is returned when date parameter is incorrect.
  // Makes sure that the application doesn't just time out
  it("GET /api/search/nasa_power --> incorrect date format", () => {
    return request(app)
      .get(
        "/api/search/nasa_power?Latitude=39&Longitude=-105&height=50&start=2022-05-08T00Z&end=2022-5-09&HubHeight=50&WindSurface=vegtype_1"
      )
      .expect(422)
      .expect("Content-Type", /json/);
  });

  // Checks that when data should be available (usually within the past couple of months) that it is properly processed
  it("GET /api/search/nasa_power --> available data within the past month", () => {
    return request(app)
      .get(
        `/api/search/nasa_power?Latitude=39&Longitude=-105&HubHeight=50&start=${daysAgo(
          120
        )}&end=${daysAgo(110)}&WindSurface=vegtype_1`
      )
      .expect(200)
      .expect("Content-Type", /json/);
  });
});

// Tests concerning the implemenetation of the Wind Toolkit API
describe("Wind Toolkit", () => {
  // Checks that when any random, necessary parameter is missing an error is returned
  it("GET /api/search/wind_toolkit --> missing parameters", () => {
    var params = ["Latitude", "Longitude", "HubHeight", "start", "end"];
    const sleep = (ms) => new Promise((r) => setTimeout(r, 1000));
    var request_url = paramRemove(
      "/api/search/wind_toolkit?Latitude=42&Longitude=-110&HubHeight=40&WindSurface=vegtype_2&start=2007-05-05T21:14:33Z&end=2008-07-07T21:14:33Z",
      params
    );
    return request(app)
      .get(request_url)
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body.errors[0]).toMatchObject({
          title: "Missing parameters",
        });
      });
  });

  // Any point that does not exist returns a message about an invalid point
  it("GET /api/search/wind_toolkit --> invalid point", () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, 1000));
    return request(app)
      .get(
        "/api/search/wind_toolkit?Latitude=400&Longitude=300&HubHeight=50&start=2007-04-05T01:01:01Z&end=2008-06-06T01:01:01Z"
      )
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 400,
                title: "Coordinates out of range",
                detail:
                  "Latitude must be within -90 and 90, and Longitude must be within -180 and 180",
              }),
            ]),
          })
        );
      });
  });

  // Any point that is not proximal to any sites returns a message about data being unavailable at that point
  it("GET /api/search/wind_toolkit --> inaccesible point", () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, 1000));
    return request(app)
      .get(
        "/api/search/wind_toolkit?Latitude=-43&Longitude=-135&HubHeight=50&start=2007-04-05T01:01:01Z&end=2008-06-06T01:01:01Z"
      )
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 400,
                title: "Wind Toolkit Error",
                detail: "No data available at the provided location",
              }),
            ]),
          })
        );
      });
  });

  // When data is requested for a time period that is not available through Wind Toolkit, an error should be returned
  it("GET /api/search/wind_toolkit --> no available data for time period", () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, 1000));
    return request(app)
      .get(
        "/api/search/wind_toolkit?Latitude=39&Longitude=-105&HubHeight=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z"
      )
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 400,
                title: "Wind Toolkit Error",
                detail:
                  "The required 'names' or 'years' parameter must contain a list of comma separated numbers with values between 2007 and 2014",
              }),
            ]),
          })
        );
      });
  });

  // Checks that error is returned when date parameter is incorrect.
  // Makes sure that the application doesn't just time out
  it("GET /api/search/wind_toolkit --> incorrect date format", () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, 1000));
    return request(app)
      .get(
        "/api/search/wind_toolkit?Latitude=39&Longitude=-105&HubHeight=50&start=2007-05-08T00Z&end=2007-05-09"
      )
      .expect(400)
      .expect("Content-Type", /json/);
  });

  // Checks that when data should be available that it is properly processed
  it("GET /api/search/wind_toolkit --> available data within the past month", () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, 1000));
    return request(app)
      .get(
        `/api/search/wind_toolkit?Latitude=39&Longitude=-105&HubHeight=50&start=2007-04-05T01:01:01Z&end=2008-06-06T01:01:01Z`
      )
      .expect(200)
      .expect("Content-Type", /json/);
  });
});

// Tests concerning the implementation of the National Weather Service API
describe("NWS API", () => {
  // Checks that when any random, necessary parameter is missing an error is returned
  it("GET /api/search/nws --> missing parameters", () => {
    var params = [
      "Latitude",
      "Longitude",
      "HubHeight",
      "WindSurface",
      "start",
      "end",
    ];
    var request_url = paramRemove(
      "/api/search/nasa_power?Latitude=42&Longitude=-110&HubHeight=40&WindSurface=vegtype_2&start=2022-05-05T21:14:33Z&end=2022-07-07T21:14:33Z",
      params
    );
    return request(app)
      .get(request_url)
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body.errors[0]).toMatchObject({
          title: "Missing parameters",
        });
      });
  });

  // Any point that does not exist returns a message about an invalid point
  it("GET /api/search/nws --> invalid point", () => {
    return request(app)
      .get(
        "/api/search/nws?Latitude=400&Longitude=300&height=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z"
      )
      .expect(404)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 404,
                title: "Invalid Parameter",
                detail:
                  "Parameter \"point\" is invalid: '400,300' does not appear to be a valid coordinate",
              }),
            ]),
          })
        );
      });
  });

  // Any point that is not proximal to any sites returns a message about data being unavailable at that point
  it("GET /api/search/nws --> inaccesible point", () => {
    return request(app)
      .get(
        "/api/search/nws?Latitude=-43&Longitude=-135&height=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z"
      )
      .expect(404)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 404,
                title: "Data Unavailable For Requested Point",
                detail: "Unable to provide data for requested point -43,-135",
              }),
            ]),
          })
        );
      });
  });

  // When data is requested for a time period that is not available through the NWS, an error should be returned
  it("GET /api/search/nws --> no available data for time period", () => {
    return request(app)
      .get(
        "/api/search/nws?Latitude=39&Longitude=-105&height=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z"
      )
      .expect(404)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 404,
                title: "No Data Found",
                detail:
                  "The National Weather Service does not have data for this time period",
              }),
            ]),
          })
        );
      });
  });

  // Checks that error is returned when date parameter is incorrect.
  // Makes sure that the application doesn't just time out
  it("GET /api/search/nws --> incorrect date format", () => {
    return request(app)
      .get(
        "/api/search/nws?Latitude=39&Longitude=-105&height=50&start=2022-05-08T00Z&end=2022-05-09"
      )
      .expect(400)
      .expect("Content-Type", /json/);
  });

  // Checks that when data should be available (usually within the past month) that it is properly processed
  it("GET /api/search/nws --> available data within the past month", () => {
    return request(app)
      .get(
        `/api/search/nws?Latitude=39&Longitude=-105&height=50&start=${daysAgo(
          7
        )}&end=${daysAgo(1)}`
      )
      .expect(200)
      .expect("Content-Type", /json/);
  }, 20000);
});

// Tests concerning the implementation of the Open Weather API
describe("Open Weather API", () => {
  // Checks that when any random, necessary parameter is missing an error is returned
  it("GET /api/search/open_weather --> missing parameters", () => {
    var params = [
      "Latitude",
      "Longitude",
      "HubHeight",
      "WindSurface",
      "start",
      "end",
    ];
    var request_url = paramRemove(
      "/api/search/open_weather?Latitude=42&Longitude=-110&HubHeight=40&WindSurface=vegtype_2&start=2022-05-05T21:14:33Z&end=2022-07-07T21:14:33Z",
      params
    );
    return request(app)
      .get(request_url)
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body.errors[0]).toMatchObject({
          title: "Missing parameters",
        });
      });
  });

  // Any point that does not exist returns a message about an invalid point
  it("GET /api/search/open_weather --> invalid point", () => {
    return request(app)
      .get(
        "/api/search/open_weather?Latitude=400&Longitude=300&HubHeight=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z&timeStep=10"
      )
      .expect(400)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 400,
                title: "Bad Request",
                detail: expect.stringMatching("wrong"),
              }),
            ]),
          })
        );
      });
  });

  // Any point that is regularly not available will still return data as a result of Open Weather models
  it("GET /api/search/open_weather --> inaccesible point", () => {
    return request(app)
      .get(
        "/api/search/open_weather?Latitude=-43&Longitude=-135&HubHeight=50&start=2022-04-05T01:01:01Z&end=2022-06-06T01:01:01Z&timeStep=10"
      )
      .expect(200)
      .expect("Content-Type", /json/);
  });

  // When data is requested for a time period that is not available through Open Weather, an error should be returned
  // Apparently Open Weather sends a response as an Internal Server Error and not a Bad Request
  it("GET /api/search/open_weather --> no available data for time period", () => {
    return request(app)
      .get(
        "/api/search/open_weather?Latitude=39&Longitude=-105&HubHeight=50&start=1975-04-05T01:01:01Z&end=1975-06-06T01:01:01Z&timeStep=5"
      )
      .expect(500)
      .expect("Content-Type", /json/)
      .then((response) => {
        expect(response.body).toEqual(
          expect.objectContaining({
            errors: expect.arrayContaining([
              expect.objectContaining({
                status: 500,
                title: "Internal Server Error",
                detail: "Internal error: 500001",
              }),
            ]),
          })
        );
      });
  });

  // Checks that error is returned when date parameter is incorrect.
  // Makes sure that the application doesn't just time out
  it("GET /api/search/open_weather --> incorrect date format", () => {
    return request(app)
      .get(
        "/api/search/open_weather?Latitude=39&Longitude=-105&HubHeight=50&start=2022-05-08T00Z&end=2022-05-09?timeStep=5"
      )
      .expect(400)
      .expect("Content-Type", /json/);
  });

  // Checks that when data should be available (usually within the past month) that it is properly processed
  it("GET /api/search/open_weather --> available data within the past month", () => {
    return request(app)
      .get(
        `/api/search/open_weather?Latitude=39&Longitude=-105&HubHeight=50&start=${daysAgo(
          7
        )}&end=${daysAgo(1)}&timeStep=5`
      )
      .expect(200)
      .expect("Content-Type", /json/);
  }, 20000);
});
