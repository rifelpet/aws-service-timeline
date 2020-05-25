const defaultSlice = "us-east-1";

// Parse all dates into Date objects
if (window.JSON && !window.JSON.dateParser) {
  var reDate = /^(\d{4})-(\d{2})-(\d{2})$/;
 
  JSON.dateParser = function (key, value) {
      if (typeof value === 'string') {
          var a = reDate.exec(value);
          if (a)
              return new Date(value);
      }
      return value;
  };
}

function loadTimeline(cb) {
  let xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
     cb(JSON.parse(this.responseText,JSON.dateParser));
    }
  };
  xhttp.open("GET", "region_timeline.json", true);
  xhttp.send();
}

function populateDropdowns(regions, services) {
  let regionSelect = document.getElementById("regions");
  regions.forEach(function (region) {
    let option = document.createElement("option");
    let text = document.createTextNode(region);
    option.appendChild(text);
    if (region === defaultSlice) {
      option.setAttribute('selected', true);
    }
    regionSelect.appendChild(option);
  });
  let serviceSelect = document.getElementById("services");
  services.forEach(function (service) {
    let option = document.createElement("option");
    let text = document.createTextNode(service);
    option.appendChild(text);
    serviceSelect.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  loadTimeline(function(rawData) {
    let regionTimeline = rawData['ByRegion'];

    let serviceLaunchDates = rawData['ServiceLaunchDates'];
    let services = Object.keys(serviceLaunchDates).sort();

    let regionLaunchDates = rawData['RegionLaunchDates'];
    let regions = Object.keys(regionLaunchDates).sort();

    populateDropdowns(regions, services);
    let data = [];
    regions.forEach(function (region) {
      let regionLaunchDate = regionLaunchDates[region];
      
      let trace = {
        //x: [20, 14, 23],
        y: services,
        name: region,
        orientation: 'h',
        marker: {
          width: 1
        },
        type: 'bar'
      };
      let x = [];
      services.forEach(function (service){
        let serviceLaunchDate = serviceLaunchDates[service];
        if (service in regionTimeline[region]) {
          // We want the difference between the date the region or service was launched (whichever is greater)
          // and the date the service was expanded into this region
          let regionServiceLaunchDate = Math.max.apply(null, [regionLaunchDate, serviceLaunchDate]);
          let regionServiceExpansionDate = regionTimeline[region][service]["date"];
          let delayWeeks = Math.floor((regionServiceExpansionDate - regionServiceLaunchDate) / 1000 / 60 / 60 / 24 / 7);
          x.push(delayWeeks);
        } else {
          // The service hasnt been expanded into this region yet
          // TODO: handle this better
          x.push(-1);
        }
      });
      trace["x"] = x;
      if (x.length > 0) {
        data.push(trace);
      }
    });
    let layout = {
      showSendToCloud:false,
      yaxis: {
        categoryorder: "category descending"
      }
    };
    Plotly.newPlot('graph', data, layout, {displaylogo: false});
  })
})