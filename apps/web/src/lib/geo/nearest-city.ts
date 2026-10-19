import { haversineKm } from "./distance";

/** Approximate city-centre coordinates, used to work out which city a pin falls in. */
const CITY_CENTRES: readonly { city: string; lat: number; lng: number }[] = [
  { city: "Lahore", lat: 31.5204, lng: 74.3587 },
  { city: "Karachi", lat: 24.8607, lng: 67.0011 },
  { city: "Islamabad", lat: 33.6844, lng: 73.0479 },
  { city: "Rawalpindi", lat: 33.5651, lng: 73.0169 },
  { city: "Faisalabad", lat: 31.4504, lng: 73.135 },
  { city: "Multan", lat: 30.1575, lng: 71.5249 },
  { city: "Peshawar", lat: 34.0151, lng: 71.5249 },
  { city: "Quetta", lat: 30.1798, lng: 66.975 },
  { city: "Sialkot", lat: 32.4945, lng: 74.5229 },
  { city: "Gujranwala", lat: 32.1877, lng: 74.1945 },
  { city: "Hyderabad", lat: 25.396, lng: 68.3578 },
  { city: "Bahawalpur", lat: 29.3956, lng: 71.6836 },
  { city: "Sargodha", lat: 32.0836, lng: 72.6711 },
  { city: "Sukkur", lat: 27.7052, lng: 68.8574 },
  { city: "Larkana", lat: 27.557, lng: 68.2264 },
  { city: "Sheikhupura", lat: 31.7167, lng: 73.985 },
  { city: "Rahim Yar Khan", lat: 28.4202, lng: 70.2952 },
  { city: "Jhang", lat: 31.2681, lng: 72.3181 },
  { city: "Dera Ghazi Khan", lat: 30.0459, lng: 70.6403 },
  { city: "Gujrat", lat: 32.5731, lng: 74.0789 },
  { city: "Sahiwal", lat: 30.6682, lng: 73.1114 },
  { city: "Wah Cantonment", lat: 33.7715, lng: 72.7511 },
  { city: "Mardan", lat: 34.1989, lng: 72.0231 },
  { city: "Kasur", lat: 31.1187, lng: 74.4507 },
  { city: "Okara", lat: 30.8138, lng: 73.4534 },
  { city: "Mingora", lat: 34.7717, lng: 72.36 },
  { city: "Nawabshah", lat: 26.2442, lng: 68.41 },
  { city: "Chiniot", lat: 31.72, lng: 72.9789 },
  { city: "Khanewal", lat: 30.3017, lng: 71.9321 },
  { city: "Hafizabad", lat: 32.0709, lng: 73.688 },
  { city: "Muzaffargarh", lat: 30.0703, lng: 71.1933 },
  { city: "Dera Ismail Khan", lat: 31.8314, lng: 70.9019 },
  { city: "Muzaffarabad", lat: 34.37, lng: 73.4711 },
  { city: "Abbottabad", lat: 34.1688, lng: 73.2215 },
  { city: "Mandi Bahauddin", lat: 32.5861, lng: 73.4917 },
  { city: "Jhelum", lat: 32.9405, lng: 73.7276 },
  { city: "Kohat", lat: 33.5869, lng: 71.4429 },
  { city: "Nowshera", lat: 34.0153, lng: 71.9747 },
  { city: "Charsadda", lat: 34.1453, lng: 71.7308 },
  { city: "Swabi", lat: 34.1201, lng: 72.47 },
];

/** A pin further than this from every known city centre is not assigned a city. */
const MAX_CITY_DISTANCE_KM = 30;

/** The city whose centre is nearest the pin, or undefined when none is close enough. */
export function nearestCity(origin: { lat: number; lng: number }): string | undefined {
  let best: { city: string; km: number } | undefined;
  for (const c of CITY_CENTRES) {
    const km = haversineKm(origin.lng, origin.lat, c.lng, c.lat);
    if (km <= MAX_CITY_DISTANCE_KM && (!best || km < best.km)) best = { city: c.city, km };
  }
  return best?.city;
}
