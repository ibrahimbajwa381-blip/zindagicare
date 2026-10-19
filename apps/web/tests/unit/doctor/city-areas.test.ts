/**
 * Practice locations carry a neighbourhood, picked from a list for cities we
 * have one for. Clients that predate the field (mobile app, admin editor) omit
 * it, which must not wipe a saved area.
 */
import { areaZonesForCity, hasAreaList } from "@zindagi/shared";
import { resolveHospitalArea } from "@/lib/doctors/hospital-area";

describe.each(["Lahore", "Islamabad", "Rawalpindi", "Karachi", "Peshawar", "Faisalabad", "Multan", "Sialkot", "Quetta", "Gujranwala", "Hyderabad", "Bahawalpur", "Sargodha", "Sukkur", "Larkana", "Sheikhupura", "Rahim Yar Khan", "Jhang", "Dera Ghazi Khan", "Gujrat", "Sahiwal",
  "Mardan", "Kasur", "Okara", "Mingora", "Nawabshah", "Chiniot", "Kotri", "Kamoke", "Hafizabad", "Muzaffargarh",
  "Dera Ismail Khan", "Turbat", "Muzaffarabad", "Abbottabad", "Mandi Bahauddin", "Jacobabad", "Layyah", "Pakpattan", "Haripur", "Charsadda",
  "Rawalakot", "Skardu", "Gilgit", "Bahawalnagar", "Vehari", "Shikarpur", "Wazirabad", "Burewala", "Kohat", "Jaranwala",
  "Sadiqabad", "Ahmedpur East", "Nowshera", "Chakwal", "Gojra", "Toba Tek Singh", "Mianwali", "Gwadar", "Swabi",
  "Wah Cantonment", "Khanewal", "Jhelum", "Khanpur", "Khairpur", "Chishtian", "Kot Addu", "Mirpur Khas", "Attock",
])("%s area list", (city) => {
  const zones = areaZonesForCity(city)!;
  const areas = zones.flatMap((z) => z.areas);

  test("exists, with no empty zones", () => {
    expect(zones.length).toBeGreaterThan(0);
    expect(zones.every((z) => z.areas.length > 0)).toBe(true);
  });

  test("lists each area once, case-insensitively", () => {
    const keys = areas.map((a) => a.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
});

test("numbered ranges expand into separate areas", () => {
  expect(areaZonesForCity("Lahore")!.flatMap((z) => z.areas)).toEqual(
    expect.arrayContaining(["DHA Phase 9", "Askari 11", "Gulberg III"]),
  );
  expect(areaZonesForCity("Rawalpindi")!.flatMap((z) => z.areas)).toEqual(
    expect.arrayContaining(["Bahria Town Phase 8", "Satellite Town Block F"]),
  );
  expect(areaZonesForCity("Karachi")!.flatMap((z) => z.areas)).toEqual(
    expect.arrayContaining([
      "Clifton Block 9",
      "DHA Phase 8",
      "Gulshan-e-Iqbal Block 20",
      "North Nazimabad Block T",
      "Federal B Area Block 22",
      "Orangi Town Sector 16",
    ]),
  );
  expect(areaZonesForCity("Peshawar")!.flatMap((z) => z.areas)).toEqual(
    expect.arrayContaining(["Hayatabad Phase 7", "Hayatabad Sector J-5", "Gulbahar Phase 4"]),
  );
});

describe("hasAreaList", () => {
  test.each([
    ["Lahore", true],
    [" islamabad ", true],
    ["RAWALPINDI", true],
    ["Karachi", true],
    [" multan ", true],
    ["Sialkot", true],
    ["Quetta", true],
    ["Gujranwala", true],
    ["Hyderabad", true],
    ["Bahawalpur", true],
    ["Sargodha", true],
    ["Sukkur", true],
    ["Larkana", true],
    ["Sheikhupura", true],
    [" Rahim Yar Khan ", true],
    ["Jhang", true],
    ["Dera Ghazi Khan", true],
    ["Gujrat", true],
    ["Sahiwal", true],
    ["Mardan", true],
    ["Muzaffargarh", true],
    ["Mandi Bahauddin", true],
    ["Khanewal", true],
    ["Hasilpur", false],
    ["", false],
    [undefined, false],
  ])("%p → %p", (city, expected) => expect(hasAreaList(city)).toBe(expected));
});

describe("resolveHospitalArea", () => {
  const saved = [{ name: "Ittefaq Hospital", city: "Lahore", area: "Model Town Block H" }];

  test("uses the area the client sent", () => {
    expect(resolveHospitalArea({ name: "Ittefaq Hospital", city: "Lahore", area: "Gulberg III" }, saved)).toBe(
      "Gulberg III",
    );
  });

  test("an explicit empty area clears it", () => {
    expect(resolveHospitalArea({ name: "Ittefaq Hospital", city: "Lahore", area: "" }, saved)).toBeUndefined();
  });

  test("an omitted area keeps the saved one for the same location", () => {
    expect(resolveHospitalArea({ name: " ittefaq hospital ", city: "LAHORE" }, saved)).toBe("Model Town Block H");
  });

  test("an omitted area on a different location stays empty", () => {
    expect(resolveHospitalArea({ name: "Ittefaq Hospital", city: "Karachi" }, saved)).toBeUndefined();
    expect(resolveHospitalArea({ name: "Other Clinic", city: "Lahore" }, saved)).toBeUndefined();
  });
});
