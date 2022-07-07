const request = require("supertest");
const { response } = require("../server");
const app = require("../server");

describe("General", () => {
  it("GET /api/ --> welcome message", () => {
    return request(app).get("/api/").expect(200).expect("Content-Type", /json/);
  });
});

describe("NASA POWER API", () => {
  it("GET /api/search/nasa_power --> missing parameters", () => {
    var params = [
      "Latitude",
      "Longitude",
      "HubHeight",
      "WindSurface",
      "start",
      "end",
    ];
    var remove_param = params[Math.floor(Math.random() * params.length)];
    var request_url =
      "/api/search/nasa_power?Latitude=42&Longitude=-110&HubHeight=40&WindSurface=vegtype_2&start=2022-05-05T21:14:33Z&end=2022-07-07T21:14:33Z";
    request_url = request_url.replace(
      request_url.substring(
        request_url.indexOf(remove_param),
        request_url.substring(request_url.indexOf(remove_param)).indexOf("&") +
          request_url.indexOf(remove_param) +
          1
      ),
      ""
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
});
// Tests concerning the implementation of the National Weather Service API
describe("NWS API", () => {
  // Any point that does not exist returns a message about an invalid point
  it("GET /api/search/nws --> invalid point", () => {
    return request(app)
      .get(
        "/api/search/nws?lat=400&lon=300&height=50&start_date=2022-04-05T01:01:01Z&end_date=2022-06-06T01:01:01Z"
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
        "/api/search/nws?lat=-43&lon=-135&height=50&start_date=2022-04-05T01:01:01Z&end_date=2022-06-06T01:01:01Z"
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
  it("GET /api/search/nws --> no available data", () => {
    return request(app)
      .get(
        "/api/search/nws?lat=39&lon=-105&height=50&start_date=2022-04-05T01:01:01Z&end_date=2022-06-06T01:01:01Z"
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

  // Checks that when data should be available (usually within the past month) that it is properly processed
  it("GET /api/search/nws --> available data within the past month", () => {
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
    return request(app)
      .get(
        `/api/search/nws?lat=39&lon=-105&height=50&start_date=${daysAgo(
          7
        )}&end_date=${daysAgo(1)}`
      )
      .expect(200)
      .expect("Content-Type", /json/);
  });

  // Checks that error is returned when date parameter is incorrect.
  // Makes sure that the application doesn't just time out
  it("GET /api/search/nws --> available data within the past month", () => {
    function daysAgo(days) {
      var today = new Date();
      return new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - days,
        today.getHours(),
        today.getSeconds(),
        today.getMilliseconds()
      );
    }
    return request(app)
      .get(
        `/api/search/nws?lat=39&lon=-105&height=50&start_date=${daysAgo(
          7
        )}&end_date=${daysAgo(1)}`
      )
      .expect(400)
      .expect("Content-Type", /json/);
  });
});
