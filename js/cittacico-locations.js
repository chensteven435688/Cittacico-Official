/*
 * Cascading country → state / province / county / district selectors.
 * Used on registration, account profile, saved address, and checkout.
 */
(function () {
  "use strict";

  var COUNTRIES = [
    "United States",
    "Canada",
    "United Kingdom",
    "Australia",
    "Japan",
    "China",
    "Taiwan",
    "Hong Kong",
    "Singapore",
    "South Korea",
    "France",
    "Italy",
    "Germany",
    "Spain",
    "Netherlands",
    "Switzerland",
    "Mexico",
    "Brazil",
    "India",
    "United Arab Emirates",
    "New Zealand",
    "Ireland",
    "Sweden",
    "Norway",
    "Denmark",
    "Belgium",
    "Austria",
    "Portugal",
    "Thailand",
    "Vietnam",
    "Malaysia",
    "Indonesia",
    "Philippines",
    "Other"
  ];

  var SUBDIVISIONS = {
    "United States": {
      label: "State",
      options: [
        "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
        "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois",
        "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts",
        "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
        "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
        "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
        "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
        "West Virginia", "Wisconsin", "Wyoming"
      ]
    },
    "Canada": {
      label: "Province / Territory",
      options: [
        "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
        "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
        "Quebec", "Saskatchewan", "Yukon"
      ]
    },
    "United Kingdom": {
      label: "Country / Region",
      options: [
        "England", "Scotland", "Wales", "Northern Ireland",
        "Greater London", "South East", "South West", "East of England", "East Midlands",
        "West Midlands", "Yorkshire and the Humber", "North West", "North East"
      ]
    },
    "Australia": {
      label: "State / Territory",
      options: [
        "Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland",
        "South Australia", "Tasmania", "Victoria", "Western Australia"
      ]
    },
    "Japan": {
      label: "Prefecture",
      options: [
        "Hokkaido", "Aomori", "Iwate", "Miyagi", "Akita", "Yamagata", "Fukushima", "Ibaraki",
        "Tochigi", "Gunma", "Saitama", "Chiba", "Tokyo", "Kanagawa", "Niigata", "Toyama",
        "Ishikawa", "Fukui", "Yamanashi", "Nagano", "Gifu", "Shizuoka", "Aichi", "Mie",
        "Shiga", "Kyoto", "Osaka", "Hyogo", "Nara", "Wakayama", "Tottori", "Shimane",
        "Okayama", "Hiroshima", "Yamaguchi", "Tokushima", "Kagawa", "Ehime", "Kochi",
        "Fukuoka", "Saga", "Nagasaki", "Kumamoto", "Oita", "Miyazaki", "Kagoshima", "Okinawa"
      ]
    },
    "China": {
      label: "Province / Municipality",
      options: [
        "Beijing", "Shanghai", "Tianjin", "Chongqing", "Guangdong", "Zhejiang", "Jiangsu",
        "Shandong", "Henan", "Sichuan", "Hubei", "Hunan", "Fujian", "Anhui", "Hebei",
        "Shaanxi", "Liaoning", "Jiangxi", "Yunnan", "Guangxi", "Shanxi", "Heilongjiang",
        "Jilin", "Guizhou", "Gansu", "Inner Mongolia", "Xinjiang", "Hainan", "Ningxia",
        "Qinghai", "Tibet"
      ]
    },
    "Taiwan": {
      label: "City / County",
      options: [
        "Taipei City", "New Taipei City", "Taoyuan City", "Taichung City", "Tainan City",
        "Kaohsiung City", "Keelung City", "Hsinchu City", "Chiayi City", "Hsinchu County",
        "Miaoli County", "Changhua County", "Nantou County", "Yunlin County", "Chiayi County",
        "Pingtung County", "Yilan County", "Hualien County", "Taitung County", "Penghu County",
        "Kinmen County", "Lienchiang County"
      ]
    },
    "Hong Kong": {
      label: "District",
      options: [
        "Central and Western", "Eastern", "Southern", "Wan Chai", "Kowloon City", "Kwun Tong",
        "Sham Shui Po", "Wong Tai Sin", "Yau Tsim Mong", "Islands", "Kwai Tsing", "North",
        "Sai Kung", "Sha Tin", "Tai Po", "Tsuen Wan", "Tuen Mun", "Yuen Long"
      ]
    },
    "South Korea": {
      label: "Province / City",
      options: [
        "Seoul", "Busan", "Daegu", "Incheon", "Gwangju", "Daejeon", "Ulsan", "Sejong",
        "Gyeonggi", "Gangwon", "North Chungcheong", "South Chungcheong", "North Jeolla",
        "South Jeolla", "North Gyeongsang", "South Gyeongsang", "Jeju"
      ]
    },
    "France": {
      label: "Region",
      options: [
        "Île-de-France", "Auvergne-Rhône-Alpes", "Nouvelle-Aquitaine", "Occitanie",
        "Hauts-de-France", "Provence-Alpes-Côte d'Azur", "Grand Est", "Pays de la Loire",
        "Bretagne", "Normandie", "Bourgogne-Franche-Comté", "Centre-Val de Loire", "Corse"
      ]
    },
    "Italy": {
      label: "Region",
      options: [
        "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli-Venezia Giulia",
        "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Puglia", "Sardegna",
        "Sicilia", "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto"
      ]
    },
    "Germany": {
      label: "State",
      options: [
        "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse",
        "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate",
        "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"
      ]
    },
    "Spain": {
      label: "Autonomous community",
      options: [
        "Andalusia", "Aragon", "Asturias", "Balearic Islands", "Basque Country", "Canary Islands",
        "Cantabria", "Castile and León", "Castile-La Mancha", "Catalonia", "Extremadura", "Galicia",
        "La Rioja", "Madrid", "Murcia", "Navarre", "Valencian Community", "Ceuta", "Melilla"
      ]
    },
    "Mexico": {
      label: "State",
      options: [
        "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
        "Chihuahua", "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo",
        "Jalisco", "Mexico City", "México", "Michoacán", "Morelos", "Nayarit", "Nuevo León",
        "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora",
        "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"
      ]
    },
    "India": {
      label: "State / Territory",
      options: [
        "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
        "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
        "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
        "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
        "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry"
      ]
    },
    "United Arab Emirates": {
      label: "Emirate",
      options: [
        "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Fujairah", "Ras Al Khaimah", "Umm Al Quwain"
      ]
    },
    "New Zealand": {
      label: "Region",
      options: [
        "Auckland", "Bay of Plenty", "Canterbury", "Gisborne", "Hawke's Bay", "Manawatū-Whanganui",
        "Marlborough", "Nelson", "Northland", "Otago", "Southland", "Taranaki", "Tasman",
        "Waikato", "Wellington", "West Coast"
      ]
    },
    "Brazil": {
      label: "State",
      options: [
        "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
        "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul",
        "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro",
        "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina",
        "São Paulo", "Sergipe", "Tocantins"
      ]
    }
  };

  var FREE_TEXT_LABEL = {
    Singapore: "Area (optional)",
    Ireland: "County",
    Netherlands: "Province",
    Switzerland: "Canton",
    Sweden: "County",
    Norway: "County",
    Denmark: "Region",
    Belgium: "Region",
    Austria: "State",
    Portugal: "District",
    Thailand: "Province",
    Vietnam: "Province / City",
    Malaysia: "State",
    Indonesia: "Province",
    Philippines: "Province",
    Other: "State / region"
  };

  function emptyOption(label) {
    var option = document.createElement("option");
    option.value = "";
    option.textContent = label || "Select";
    return option;
  }

  function fillSelect(select, values, placeholder) {
    select.innerHTML = "";
    select.appendChild(emptyOption(placeholder || "Select"));
    values.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function refreshSubdivision(root) {
    var countrySelect = root.querySelector("[data-location-country]");
    var labelEl = root.querySelector("[data-location-subdivision-label]");
    var selectEl = root.querySelector("[data-location-subdivision]");
    var textEl = root.querySelector("[data-location-subdivision-text]");
    if (!countrySelect || !selectEl || !textEl) return;

    var country = countrySelect.value;
    var known = SUBDIVISIONS[country];

    if (known) {
      if (labelEl) labelEl.textContent = known.label;
      fillSelect(selectEl, known.options, "Select " + known.label.toLowerCase());
      selectEl.hidden = false;
      selectEl.disabled = false;
      selectEl.required = Boolean(root.getAttribute("data-location-require-subdivision") === "true");
      textEl.hidden = true;
      textEl.disabled = true;
      textEl.required = false;
      textEl.value = "";
    } else {
      var label = FREE_TEXT_LABEL[country] || "State / region";
      if (labelEl) labelEl.textContent = label;
      selectEl.innerHTML = "";
      selectEl.hidden = true;
      selectEl.disabled = true;
      selectEl.required = false;
      selectEl.value = "";
      textEl.hidden = false;
      textEl.disabled = false;
      textEl.required = false;
      textEl.placeholder = label;
    }
  }

  function bind(root) {
    if (!root || root.getAttribute("data-location-bound") === "1") return root;
    root.setAttribute("data-location-bound", "1");

    var countrySelect = root.querySelector("[data-location-country]");
    if (!countrySelect) return root;

    fillSelect(countrySelect, COUNTRIES, "Select country");
    countrySelect.addEventListener("change", function () {
      refreshSubdivision(root);
    });
    refreshSubdivision(root);
    return root;
  }

  function getSubdivisionValue(root) {
    var selectEl = root.querySelector("[data-location-subdivision]");
    var textEl = root.querySelector("[data-location-subdivision-text]");
    if (selectEl && !selectEl.disabled && !selectEl.hidden) {
      return (selectEl.value || "").trim();
    }
    if (textEl && !textEl.disabled && !textEl.hidden) {
      return (textEl.value || "").trim();
    }
    return "";
  }

  function getValues(root) {
    var countrySelect = root.querySelector("[data-location-country]");
    return {
      country: countrySelect ? (countrySelect.value || "").trim() : "",
      region: getSubdivisionValue(root)
    };
  }

  function setValues(root, values) {
    bind(root);
    values = values || {};
    var countrySelect = root.querySelector("[data-location-country]");
    var selectEl = root.querySelector("[data-location-subdivision]");
    var textEl = root.querySelector("[data-location-subdivision-text]");
    var country = values.country || "";
    var region = values.region || "";

    /* Profile may store "United States · New York" in a single region string. */
    if (!country && region && region.indexOf(" · ") !== -1) {
      var parts = region.split(" · ");
      country = parts[0];
      region = parts.slice(1).join(" · ");
    }

    if (countrySelect) {
      if (country && COUNTRIES.indexOf(country) === -1) {
        var extra = document.createElement("option");
        extra.value = country;
        extra.textContent = country;
        countrySelect.appendChild(extra);
      }
      countrySelect.value = country;
    }

    refreshSubdivision(root);

    if (selectEl && !selectEl.hidden) {
      if (region && !Array.prototype.some.call(selectEl.options, function (opt) {
        return opt.value === region;
      })) {
        var opt = document.createElement("option");
        opt.value = region;
        opt.textContent = region;
        selectEl.appendChild(opt);
      }
      selectEl.value = region;
    } else if (textEl) {
      textEl.value = region;
    }
  }

  function formatProfileRegion(country, region) {
    country = (country || "").trim();
    region = (region || "").trim();
    if (country && region) return country + " · " + region;
    return country || region || "";
  }

  window.CITTACICO_LOCATIONS = {
    countries: COUNTRIES,
    subdivisions: SUBDIVISIONS,
    bind: bind,
    getValues: getValues,
    setValues: setValues,
    formatProfileRegion: formatProfileRegion
  };
})();
