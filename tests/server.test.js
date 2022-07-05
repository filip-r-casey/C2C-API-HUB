const request = require("supertest");
const app = require("../server");

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
});
