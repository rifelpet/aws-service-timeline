const defaultSlice = "us-east-1";

function loadTimeline(cb) {
  let xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
     cb(JSON.parse(this.responseText));
    }
  };
  xhttp.open("GET", "region_timeline.json", true);
  xhttp.send();
}

function populateDropdowns(regions, services, cb) {
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
  cb();
}

document.addEventListener('DOMContentLoaded', function() {
  loadTimeline(function(rawData) {
    let regionTimeline = rawData['ByRegion'];
    let serviceLaunchDates = rawData['ServiceLaunchDates'];
    let regionLaunchDates = rawData['RegionLaunchDates'];
    let regions = Object.keys(regionLaunchDates).sort();
    let services = Object.keys(serviceLaunchDates).sort();

    populateDropdowns(regions, services, function() {
      let data = [];
      regions.forEach(function (region) {
        if (region != 'eu-west-1') {
          return
        }
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
        let x = []
        // regionServices = [];
        services.forEach(function (service){
          let startDate = serviceLaunchDates[service];
          if (service in regionTimeline[region]) {
            let regionDate = Date.parse(regionTimeline[region][service]["date"])
            let delayWeeks = (regionDate - startDate) / 1000 / 60 / 60 / 24 / 7;
            x.push(delayWeeks)
          } else {
            x.push(-100)
          }
        });
        trace["x"] = x;
        if (x.length > 0) {
          data.push(trace);
        }
      });

      Plotly.newPlot('graph', data, {showSendToCloud:true});
    })
  })
})