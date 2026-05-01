export const vehicleModelsByBrand: Record<string, string[]> = {
  Chevrolet: ["Onix", "Onix Plus", "Tracker", "S10", "Spin", "Cruze"],
  Fiat: ["Argo", "Cronos", "Mobi", "Pulse", "Strada", "Toro", "Uno"],
  Ford: ["EcoSport", "Fiesta", "Focus", "Ka", "Ranger", "Territory"],
  Honda: ["Civic", "City", "Fit", "HR-V", "WR-V"],
  Hyundai: ["Creta", "HB20", "HB20S", "Tucson"],
  Jeep: ["Compass", "Commander", "Renegade"],
  Nissan: ["Kicks", "March", "Sentra", "Versa", "Frontier"],
  Renault: ["Captur", "Duster", "Kwid", "Logan", "Sandero", "Oroch"],
  Toyota: ["Corolla", "Corolla Cross", "Etios", "Hilux", "SW4", "Yaris"],
  Volkswagen: ["Gol", "Jetta", "Nivus", "Polo", "Saveiro", "T-Cross", "Virtus"],
};

export const vehicleBrands = Object.keys(vehicleModelsByBrand);
